"""Ingestion Agent — classifies documents using structured output."""

import json
import logging
from typing import Callable, Optional

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings

logger = logging.getLogger(__name__)

# llama-3.3-70b-versatile for structured JSON output
_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.1,
    max_tokens=512,
    model_kwargs={"response_format": {"type": "json_object"}}
)

_classify_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a document classification expert for investigative journalism.
Analyze the text preview and return ONLY valid JSON with these keys:
- document_type: one of [financial_record, legal_filing, corporate_registration, correspondence, report, news_article, other]
- time_period: estimated date range mentioned
- jurisdiction: country/region if identifiable
- key_topic: one-sentence summary
- entities_hint: list of likely entity names spotted

Return ONLY the JSON object, no markdown, no explanation."""),
    ("human", "Classify this document:\n\n{text_preview}")
])

_classify_chain = _classify_prompt | _llm


async def classify_document(text_preview: str) -> dict:
    """Classify a document. Returns structured metadata."""
    try:
        response = await _classify_chain.ainvoke({"text_preview": text_preview[:2000]})
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(content)
        logger.info(f"Document classified as: {result.get('document_type', 'unknown')}")
        return result
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON for classification, using defaults")
        return {
            "document_type": "other",
            "time_period": "unknown",
            "jurisdiction": "unknown",
            "key_topic": "Unable to classify",
            "entities_hint": [],
        }
    except Exception as e:
        logger.error(f"Ingestion agent error: {e}")
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
