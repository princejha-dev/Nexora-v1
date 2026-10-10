"""Ingestion Agent — classifies documents using structured output."""

import json
import logging
import re
from typing import Callable, Optional

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model_name="openai/gpt-oss-120b",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.1,
    max_tokens=512,
)

_CLASSIFY_SCHEMA = '''{"document_type": "financial_record|legal_filing|corporate_registration|correspondence|report|news_article|other", "time_period": "estimated date range mentioned", "jurisdiction": "country/region if identifiable", "key_topic": "one-sentence summary", "entities_hint": ["likely entity names spotted"]}'''

_classify_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a document classification expert for investigative journalism.
Analyze the text preview and return ONLY valid JSON matching this schema:
{schema}

Rules:
- Return only valid JSON with double quotes.
- No markdown, no explanation.
- Classify using the exact document_type values provided."""),
    ("human", "Classify this document:\n\n{text_preview}")
])

_classify_chain = _classify_prompt | _llm


def _clean_json_response(content: str) -> str:
    """Normalize model output to a parseable JSON object."""
    text = (content or "").strip()
    if not text:
        raise ValueError("Empty response from model")

    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    return text


async def classify_document(text_preview: str) -> dict:
    """Classify a document. Returns structured metadata."""
    response = None
    try:
        response = await _classify_chain.ainvoke({
            "text_preview": text_preview[:2000],
            "schema": _CLASSIFY_SCHEMA,
        })
        content = _clean_json_response(response.content)
        result = json.loads(content)
        logger.info("Document classified as: %s", result.get("document_type", "unknown"))
        return result
    except json.JSONDecodeError as exc:
        logger.warning("LLM returned non-JSON for classification, using defaults: %s", exc)
        if response is not None:
            logger.debug("Raw model output: %s", response.content)
        return {
            "document_type": "other",
            "time_period": "unknown",
            "jurisdiction": "unknown",
            "key_topic": "Unable to classify",
            "entities_hint": [],
        }
    except Exception as e:
        logger.error("Ingestion agent error: %s", e)
        return {
            "document_type": "error",
            "time_period": "unknown",
            "jurisdiction": "unknown",
            "key_topic": f"Classification failed: {str(e)}",
            "entities_hint": [],
        }


async def run(
    texts: list[dict],
    emit: Optional[Callable] = None,
) -> list[dict]:
    """Run ingestion on all documents."""
    if emit:
        await emit("status", {"message": "📄 Ingesting documents...", "stage": "ingesting"})

    results = []
    for doc in texts:
        preview = doc["content"][:2000]
        classification = await classify_document(preview)
        results.append({
            **doc,
            "classification": classification,
            "content_preview": doc["content"][:1000],
        })

    if emit:
        await emit("status", {"message": f"📄 Ingested {len(results)} documents", "stage": "ingesting"})

    return results
