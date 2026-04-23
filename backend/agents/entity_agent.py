"""Entity Agent — extracts entities and relationships using structured output."""

import json
import logging
from typing import Callable, Optional

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.1,
    max_tokens=2048,
    model_kwargs={"response_format": {"type": "json_object"}}
)

_extract_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an entity extraction expert for investigative journalism.
Extract ALL named entities and relationships from the text.

Entity types: person, organization, location, financial, date, event

Return ONLY valid JSON:
{{
  "entities": [
    {{"name": "...", "type": "person|organization|location|financial|date|event", "description": "brief desc", "aliases": []}}
  ],
  "relationships": [
    {{"entity_a": "...", "entity_b": "...", "label": "relationship description", "confidence": 0.8}}
  ]
}}

Be thorough — extract every entity mentioned. No markdown, no explanation."""),
    ("human", "Extract entities and relationships from:\n\n{text}")
])

_extract_chain = _extract_prompt | _llm


async def extract_from_batch(text: str) -> dict:
    """Extract entities and relations from a text batch."""
    try:
        response = await _extract_chain.ainvoke({"text": text})
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(content)
        return {
            "entities": result.get("entities", []),
            "relationships": result.get("relationships", []),
        }
    except json.JSONDecodeError:
        logger.warning("Entity extraction JSON parse error")
        return {"entities": [], "relationships": []}
    except Exception as e:
        logger.error(f"Entity extraction error: {e}")
        return {"entities": [], "relationships": []}


def _deduplicate_entities(entities: list[dict]) -> list[dict]:
    """Deduplicate entities by normalized name."""
    seen = {}
    for entity in entities:
        key = entity["name"].lower().strip()
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
