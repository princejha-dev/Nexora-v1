"""Entity Agent — extracts entities and relationships using structured output."""

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
    max_tokens=2048,
)

_JSON_SCHEMA = '''{"entities": [{"name": "...", "type": "person|organization|location|financial|date|event", "description": "brief desc", "aliases": []}], "relationships": [{"entity_a": "...", "entity_b": "...", "label": "relationship description", "confidence": 0.8}]}'''

_extract_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an entity extraction expert for investigative journalism.
Extract ALL named entities and relationships from the text.

Entity types: person, organization, location, financial, date, event

Return ONLY valid JSON matching this schema:
{schema}

Rules:
- Be thorough — extract every entity mentioned.
- Return only valid JSON with double quotes.
- No markdown, no commentary.
- Use the exact allowed type values only.
- If there are no entities, return {{"entities": [], "relationships": []}}."""),
    ("human", "Extract entities and relationships from:\n\n{text}")
])

_extract_chain = _extract_prompt | _llm


def _clean_json_response(content: str) -> str:
    """Normalize LLM JSON output into a parseable object string."""
    text = (content or "").strip()
    if not text:
        raise ValueError("Empty response from model")

    # Remove markdown fences such as ```json ... ```
    fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    # If the model adds extra explanatory text before/after the JSON, keep only the first JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    return text


async def extract_from_batch(text: str) -> dict:
    """Extract entities and relations from a text batch."""
    try:
        response = await _extract_chain.ainvoke({"text": text, "schema": _JSON_SCHEMA})
        content = _clean_json_response(response.content)
        result = json.loads(content)
        return {
            "entities": result.get("entities", []),
            "relationships": result.get("relationships", []),
        }
    except json.JSONDecodeError as exc:
        logger.warning("Entity extraction JSON parse error: %s", exc)
        logger.debug("Raw model output: %s", getattr(response, "content", ""))
        return {"entities": [], "relationships": []}
    except Exception as e:
        logger.error("Entity extraction error: %s", e)
        return {"entities": [], "relationships": []}


def _deduplicate_entities(entities: list[dict]) -> list[dict]:
    """Deduplicate entities by normalized name."""
    seen = {}
    for entity in entities:
        name = (entity.get("name") or "").strip()
        if not name:
            continue

        key = name.lower()
        if key in seen:
            existing = seen[key]
            existing["mention_count"] = existing.get("mention_count", 1) + 1
            if entity.get("aliases"):
                existing.setdefault("aliases", []).extend(entity["aliases"])
        else:
            entity["mention_count"] = 1
            seen[key] = entity
    return list(seen.values())


async def run(
    chunks: list[str],
    emit: Optional[Callable] = None,
) -> dict:
    """Run entity extraction on chunks in batches of 3."""
    if emit:
        await emit("status", {"message": "🔍 Extracting entities...", "stage": "extracting"})

    all_entities = []
    all_relationships = []
    batch_size = 3

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        combined_text = "\n\n---\n\n".join(batch)

        result = await extract_from_batch(combined_text)
        all_entities.extend(result["entities"])
        all_relationships.extend(result["relationships"])

        if emit:
            for entity in result["entities"]:
                await emit("graph_update", {"type": "node", "data": entity})
            for rel in result["relationships"]:
                await emit("graph_update", {"type": "edge", "data": rel})

    unique_entities = _deduplicate_entities(all_entities)

    if emit:
        await emit("status", {
            "message": f"🔍 Extracted {len(unique_entities)} entities, {len(all_relationships)} relationships",
            "stage": "extracting",
        })

    return {"entities": unique_entities, "relationships": all_relationships}
