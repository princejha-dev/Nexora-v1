"""Pattern Agent — detects suspicious patterns using structured output."""

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
    temperature=0.3,
    max_tokens=4096,
)

_pattern_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an investigative analyst detecting suspicious patterns.
Analyze the entity graph for these pattern types:
- circular_ownership: A owns B owns A
- unusual_timing: events happening suspiciously close together
- hidden_intermediary: same person in many unrelated deals
- financial_mismatch: amounts that don't add up
- geographic_anomaly: offshore entities with local directors
- recurring_actor: same professional in multiple suspicious deals

Return ONLY valid JSON:
{{
  "findings": [
    {{
      "title": "short title",
      "description": "detailed explanation",
      "pattern_type": "one of the types above",
      "suspicion_score": 1-10,
      "entities_involved": ["entity names"],
      "legal_risk": "low|medium|high"
    }}
  ]
}}

Score genuinely suspicious patterns higher. No markdown, no explanation."""),
    ("human", "Analyze this entity graph for suspicious patterns:\n\nENTITIES:\n{entities}\n\nRELATIONSHIPS:\n{relationships}")
])

_pattern_chain = _pattern_prompt | _llm


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


async def analyze(entities: list[dict], relationships: list[dict]) -> list[dict]:
    """Detect suspicious patterns in the entity graph."""
    response = None
    try:
        response = await _pattern_chain.ainvoke({
            "entities": json.dumps(entities, indent=2),
            "relationships": json.dumps(relationships, indent=2),
        })

        content = _clean_json_response(response.content)
        result = json.loads(content)
        findings = result.get("findings", [])
        logger.info("Pattern agent found %s suspicious patterns", len(findings))
        return findings

    except json.JSONDecodeError as exc:
        logger.warning("Pattern agent returned non-JSON output: %s", exc)
        if response is not None:
            logger.debug("Raw model output: %s", response.content)
        return []
    except Exception as e:
        logger.error("Pattern agent error: %s", e)
        return []


async def run(
    entities: list[dict],
    relationships: list[dict],
    emit: Optional[Callable] = None,
) -> list[dict]:
    """Run pattern detection on the full entity graph."""
    if emit:
        await emit("status", {"message": "🕸️ Detecting patterns...", "stage": "analyzing"})

    max_entities_per_call = 50
    all_findings = []

    if len(entities) <= max_entities_per_call:
        all_findings = await analyze(entities, relationships)
    else:
        for i in range(0, len(entities), max_entities_per_call - 10):
            batch_entities = entities[i:i + max_entities_per_call]
            batch_names = {e["name"] for e in batch_entities}
            batch_rels = [r for r in relationships if r.get("entity_a") in batch_names or r.get("entity_b") in batch_names]
            findings = await analyze(batch_entities, batch_rels)
            all_findings.extend(findings)

    if emit:
        await emit("status", {"message": f"🕸️ Detected {len(all_findings)} suspicious patterns", "stage": "analyzing"})

    return all_findings
