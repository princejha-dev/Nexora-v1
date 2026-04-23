"""Factcheck Agent — verifies findings using RAG with structured output."""

import json
import logging
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

        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]

        verification = json.loads(content)

        return {
            **finding,
            "verified": verification.get("verified", False),
            "confidence": verification.get("confidence", "low"),
            "supporting_evidence": verification.get("supporting_evidence", ""),
            "gaps": verification.get("gaps", ""),
            "legal_risk": verification.get("legal_risk", "low"),
        }

    except json.JSONDecodeError:
        logger.warning(f"Factcheck JSON parse error for: {finding.get('title')}")
        return {**finding, "verified": False, "confidence": "low"}
    except Exception as e:
        logger.error(f"Factcheck error: {e}")
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
