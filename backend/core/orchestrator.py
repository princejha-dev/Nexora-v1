"""
Orchestrator — coordinates the 5-agent sequential pipeline.

Pipeline: ingest → embed → extract → pattern → factcheck → draft

This is the central coordination module. It runs each agent in sequence,
emits SSE events for live frontend updates, saves results to Supabase,
and handles per-agent errors gracefully.
"""

import asyncio
import json
import logging
import time
from typing import Callable, Optional

from agents import ingestion_agent, entity_agent, pattern_agent, factcheck_agent, narrative_agent
from core.parser import chunk_text
from core.embedder import embed_and_store
from db.supabase import supabase

logger = logging.getLogger(__name__)


async def _update_project_status(project_id: str, status: str):
    """Update project status in the database."""
    try:
        update_data = {"status": status}
        if status == "complete":
            update_data["completed_at"] = "now()"
        supabase.table("projects").update(update_data).eq("id", project_id).execute()
    except Exception as e:
        logger.error(f"Failed to update project status to '{status}': {e}")


async def _save_entities(project_id: str, entities: list[dict], emit: Optional[Callable] = None) -> dict:
    """Save entities to DB and return a name→id mapping, emitting each node via SSE."""
    name_to_id = {}
    for entity in entities:
        try:
            row = {
                "project_id": project_id,
                "name": entity["name"],
                "type": entity.get("type", "other"),
                "description": entity.get("description", ""),
                "aliases": entity.get("aliases", []),
                "suspicion_score": entity.get("suspicion_score", 0),
                "mention_count": entity.get("mention_count", 1),
            }
            result = supabase.table("entities").insert(row).execute()
            if result.data:
                entity_id = result.data[0]["id"]
                name_to_id[entity["name"]] = entity_id
                if emit:
                    await emit("node", {
                        "id": entity_id,
                        "name": entity["name"],
                        "type": entity.get("type", "other"),
                        "description": entity.get("description", ""),
                        "suspicion_score": entity.get("suspicion_score", 0)
                    })
                    await asyncio.sleep(0.4)
        except Exception as e:
            logger.error(f"Failed to save entity '{entity['name']}': {e}")
    return name_to_id


async def _save_relationships(project_id: str, relationships: list[dict], name_to_id: dict, emit: Optional[Callable] = None):
    """Save relationships to DB using entity name→id mapping, emitting each edge via SSE."""
    for rel in relationships:
        try:
            entity_a_id = name_to_id.get(rel.get("entity_a"))
            entity_b_id = name_to_id.get(rel.get("entity_b"))
            if not entity_a_id or not entity_b_id:
                continue
            row = {
                "project_id": project_id,
                "entity_a_id": entity_a_id,
                "entity_b_id": entity_b_id,
                "relation_label": rel.get("label", "related_to"),
                "confidence_score": rel.get("confidence", 0.7),
            }
            supabase.table("relationships").insert(row).execute()
            if emit:
                await emit("edge", {
                    "source": entity_a_id,
                    "target": entity_b_id,
                    "label": row["relation_label"]
                })
                await asyncio.sleep(0.3)
        except Exception as e:
            logger.error(f"Failed to save relationship: {e}")


async def _save_findings(project_id: str, findings: list[dict]):
    """Save findings to DB."""
    for finding in findings:
        try:
            row = {
                "project_id": project_id,
                "title": finding.get("title", "Untitled Finding"),
                "description": finding.get("description", ""),
                "pattern_type": finding.get("pattern_type", ""),
                "suspicion_score": finding.get("suspicion_score", 5),
                "verified": finding.get("verified", False),
                "confidence": finding.get("confidence", "low"),
                "supporting_evidence": finding.get("supporting_evidence", ""),
                "gaps": finding.get("gaps", ""),
                "legal_risk": finding.get("legal_risk", "low"),
                "entities_involved": finding.get("entities_involved", []),
            }
            supabase.table("findings").insert(row).execute()
        except Exception as e:
            logger.error(f"Failed to save finding '{finding.get('title')}': {e}")


async def run_pipeline(
    project_id: str,
    documents: list[dict],
    project_description: str,
    emit: Optional[Callable] = None,
):
    """
    Run the full 5-agent pipeline for a project.

    Args:
        project_id: UUID of the project.
        documents: List of {"filename": str, "content": bytes, "document_id": str}.
        project_description: User-provided investigation description.
        emit: Async callback for SSE events — emit(event_type, data).
    """
    start_time = time.time()

    async def safe_emit(event: str, data: dict):
        if emit:
            try:
                await emit(event, data)
            except Exception as e:
                logger.error(f"SSE emit error: {e}")

    try:
        # ── STAGE 1: Ingestion (10%) ──
        await _update_project_status(project_id, "ingesting")
        await safe_emit("progress", {"percent": 10})

        parsed_docs = []
        for doc in documents:
            from core.parser import parse_file
            text = parse_file(doc["content"], doc["filename"])
            parsed_docs.append({
                "filename": doc["filename"],
                "content": text,
                "document_id": doc["document_id"],
            })

        ingested = await ingestion_agent.run(parsed_docs, emit=safe_emit)

        # ── STAGE 2: Embedding (25%) ──
        await _update_project_status(project_id, "embedding")
        await safe_emit("progress", {"percent": 25})
        await safe_emit("status", {"message": "🧮 Generating embeddings... building search index", "stage": "embedding"})

        all_chunks = []
        for doc in ingested:
            chunks = chunk_text(doc["content"])
            for idx, chunk in enumerate(chunks):
                all_chunks.append({
                    "content": chunk,
                    "document_id": doc["document_id"],
                    "chunk_index": idx,
                })
            # Update document chunk count
            try:
                supabase.table("documents").update({"chunk_count": len(chunks)}).eq("id", doc["document_id"]).execute()
            except Exception:
                pass

        stored = await embed_and_store(all_chunks, project_id)
        await safe_emit("status", {"message": f"🧮 Embedded {stored} chunks into vector store", "stage": "embedding"})

        # ── STAGE 3: Entity Extraction (40%) ──
        await _update_project_status(project_id, "extracting")
        await safe_emit("progress", {"percent": 40})

        chunk_texts = [c["content"] for c in all_chunks]
        graph_data = await entity_agent.run(chunk_texts, emit=safe_emit)

        # Save entities and relationships and emit them via SSE one by one
        entities = graph_data["entities"]
        relationships = graph_data["relationships"]
        name_to_id = await _save_entities(project_id, entities, emit=safe_emit)
        await _save_relationships(project_id, relationships, name_to_id, emit=safe_emit)

        # Update entity count
        try:
            supabase.table("projects").update({"entity_count": len(entities)}).eq("id", project_id).execute()
        except Exception:
            pass

        # ── STAGE 4: Pattern Detection (60%) ──
        await _update_project_status(project_id, "analyzing")
        await safe_emit("progress", {"percent": 60})

        findings = await pattern_agent.run(entities, relationships, emit=safe_emit)

        # ── STAGE 5: Fact Checking (75%) ──
        await _update_project_status(project_id, "factchecking")
        await safe_emit("progress", {"percent": 75})

        verified_findings = await factcheck_agent.run(findings, project_id, emit=safe_emit)
        await _save_findings(project_id, verified_findings)

        # Update finding count
        try:
            supabase.table("projects").update({"finding_count": len(verified_findings)}).eq("id", project_id).execute()
        except Exception:
            pass

        # ── STAGE 6: Narrative (90%) ──
        await _update_project_status(project_id, "drafting")
        await safe_emit("progress", {"percent": 90})

        story = await narrative_agent.run(verified_findings, entities, project_description, emit=safe_emit)

        # Save story draft
        try:
            supabase.table("projects").update({"story_draft": story}).eq("id", project_id).execute()
        except Exception:
            pass

        # ── COMPLETE (100%) ──
        await _update_project_status(project_id, "complete")
        await safe_emit("progress", {"percent": 100})

        elapsed = time.time() - start_time
        await safe_emit("complete", {
            "message": f"🎉 Investigation complete in {elapsed:.1f}s",
            "entity_count": len(entities),
            "finding_count": len(verified_findings),
            "verified_count": sum(1 for f in verified_findings if f.get("verified")),
            "elapsed_seconds": round(elapsed, 1),
        })

        logger.info(f"Pipeline complete for project {project_id} in {elapsed:.1f}s")

    except Exception as e:
        logger.error(f"Pipeline failed for project {project_id}: {e}", exc_info=True)
        await _update_project_status(project_id, "error")
        await safe_emit("error", {"message": f"Pipeline failed: {str(e)}"})
