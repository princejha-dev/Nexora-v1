"""Factcheck Agent — verifies findings using RAG with structured output."""

import json
import logging
import re
from typing import Callable, Optional

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from config import get_settings
from core.embedder import similarity_search

logger = logging.getLogger(__name__)

_llm = ChatGroq(
    model_name="openai/gpt-oss-20b",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.1,
    max_tokens=1024,
)

_verify_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a fact-checking editor for investigative journalism.
Given a finding and source document evidence, verify the finding.

Return ONLY valid JSON:
{{
  "verified": true/false,
  "confidence": "high|medium|low",
  "supporting_evidence": "quote or reference from documents",
  "gaps": "what information is missing",
  "legal_risk": "low|medium|high",
  "assessment": "brief explanation"
}}

Be conservative — only mark verified if evidence clearly supports it."""),
    ("human", "FINDING TO VERIFY:\n{finding}\n\nSOURCE DOCUMENT EVIDENCE:\n{evidence}")
])

_verify_chain = _verify_prompt | _llm


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


async def verify_finding(finding: dict, evidence_chunks: list[dict]) -> dict:
    """Verify a single finding against retrieved document chunks."""
    try:
        evidence_text = "\n\n---\n\n".join([
            f"[Similarity: {c.get('similarity', 'N/A'):.3f}]\n{c['content']}"
            for c in evidence_chunks
        ])

        response = await _verify_chain.ainvoke({
            "finding": json.dumps(finding),
            "evidence": evidence_text,
        })

        content = _clean_json_response(response.content)
        verification = json.loads(content)

        return {
            **finding,
            "verified": verification.get("verified", False),
            "confidence": verification.get("confidence", "low"),
            "supporting_evidence": verification.get("supporting_evidence", ""),
            "gaps": verification.get("gaps", ""),
            "legal_risk": verification.get("legal_risk", "low"),
        }

    except json.JSONDecodeError as exc:
        logger.warning("Factcheck JSON parse error for: %s | %s", finding.get("title"), exc)
        logger.debug("Raw model output: %s", getattr(response, "content", ""))
        return {**finding, "verified": False, "confidence": "low"}
    except Exception as e:
        logger.error("Factcheck error: %s", e)
        return {**finding, "verified": False, "confidence": "low"}


async def run(
    findings: list[dict],
    project_id: str,
    emit: Optional[Callable] = None,
) -> list[dict]:
    """Run fact-checking on all findings using RAG retrieval."""
    if emit:
        await emit("status", {"message": "✅ Fact checking...", "stage": "factchecking"})

    verified_findings = []

    for i, finding in enumerate(findings):
        query = f"{finding.get('title', '')} {finding.get('description', '')}"
        evidence = await similarity_search(query, project_id, top_k=5)

        verified = await verify_finding(finding, evidence)
        verified_findings.append(verified)

        if emit:
            await emit("status", {
                "message": f"✅ Verified {i+1}/{len(findings)}: {finding.get('title', '')}",
                "stage": "factchecking",
            })

    verified_count = sum(1 for f in verified_findings if f.get("verified"))
    if emit:
        await emit("status", {"message": f"✅ Fact-check: {verified_count}/{len(findings)} verified", "stage": "factchecking"})

    return verified_findings
