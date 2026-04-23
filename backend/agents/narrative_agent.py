"""Narrative Agent — writes investigation brief (free-form text, no structured output needed)."""

import logging
from typing import Callable, Optional

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings

logger = logging.getLogger(__name__)

# Uses llama for free-form text generation (not structured output)
_llm = ChatGroq(
    model_name="llama-3.3-70b-versatile",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.4,
    max_tokens=4096,
)

_narrative_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a senior investigative journalist writing a brief.
Write a clear, professional investigation brief covering:
1. Executive summary
2. Key entities and their roles
3. Suspicious patterns detected
4. Verified findings with evidence
5. Unverified leads requiring further investigation
6. Recommended next steps

Write in a factual, journalistic tone. Cite specific evidence where available."""),
    ("human", """Write an investigation brief based on:

ENTITIES:
{entities}

FINDINGS:
{findings}

DOCUMENT CONTEXT:
{context}""")
])

_narrative_chain = _narrative_prompt | _llm


async def run(
    entities: list[dict],
    findings: list[dict],
    context: str,
    emit: Optional[Callable] = None,
) -> str:
    """Generate investigation brief."""
    if emit:
        await emit("status", {"message": "📝 Writing investigation brief...", "stage": "drafting"})

    try:
        import json
        response = await _narrative_chain.ainvoke({
            "entities": json.dumps(entities[:30], indent=2),
            "findings": json.dumps(findings, indent=2),
            "context": context[:3000],
        })

        story = response.content.strip()
        logger.info(f"Narrative generated: {len(story)} chars")

        if emit:
            await emit("status", {"message": "📝 Investigation brief complete", "stage": "drafting"})

        return story

    except Exception as e:
        logger.error(f"Narrative agent error: {e}")
        if emit:
            await emit("status", {"message": f"📝 Brief generation failed: {e}", "stage": "drafting"})
        return f"Brief generation failed: {str(e)}"
