"""Project CRUD routes — create investigations, upload files, get results."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from api.auth import get_current_user
from db.supabase import supabase
from core.parser import detect_file_type

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["projects"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILES = 5
ALLOWED_TYPES = {"pdf", "txt"}


@router.post("/", status_code=201)
async def create_project(
    name: str = Form(...),
    description: str = Form(...),
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    """Create a new investigation project with uploaded files."""
    # Validate file count
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"Maximum {MAX_FILES} files allowed")
    if len(files) == 0:
        raise HTTPException(400, "At least one file is required")

    # Validate files
    for f in files:
        try:
            detect_file_type(f.filename)
        except ValueError:
            raise HTTPException(400, f"Unsupported file: {f.filename}. Only PDF and TXT accepted.")

    # Create project in DB
    try:
        result = supabase.table("projects").insert({
            "user_id": user["user_id"],
            "name": name,
            "description": description,
            "status": "pending",
        }).execute()
        project = result.data[0]
        project_id = project["id"]
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(500, "Failed to create project")

    # Read files and create document records
    documents = []
    for f in files:
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(400, f"File {f.filename} exceeds 10MB limit")

        file_type = detect_file_type(f.filename)
        try:
            doc_result = supabase.table("documents").insert({
                "project_id": project_id,
                "filename": f.filename,
                "file_type": file_type,
            }).execute()
            documents.append({
                "filename": f.filename,
                "content": content,
                "document_id": doc_result.data[0]["id"],
            })
        except Exception as e:
            logger.error(f"Failed to save document {f.filename}: {e}")

    # Start pipeline as background task
    from core.orchestrator import run_pipeline
    from api.stream import create_queue, get_emit_fn

    create_queue(project_id)
    emit = get_emit_fn(project_id)

    asyncio.create_task(run_pipeline(project_id, documents, description, emit=emit))

    return {"project_id": project_id, "status": "pending", "message": "Pipeline started"}


@router.get("/")
async def list_projects(user: dict = Depends(get_current_user)):
    """List all projects for the current user."""
    try:
        result = supabase.table("projects") \
            .select("id, name, description, status, entity_count, finding_count, created_at, completed_at") \
            .eq("user_id", user["user_id"]) \
            .order("created_at", desc=True) \
            .execute()
        return result.data
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(500, "Failed to list projects")


@router.get("/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    """Get a single project with stats."""
    try:
        result = supabase.table("projects") \
            .select("*") \
            .eq("id", project_id) \
            .eq("user_id", user["user_id"]) \
            .single() \
            .execute()
        if not result.data:
            raise HTTPException(404, "Project not found")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project: {e}")
        raise HTTPException(500, "Failed to get project")


@router.get("/{project_id}/graph")
async def get_graph(project_id: str, user: dict = Depends(get_current_user)):
    """Return entities + relationships for graph rendering."""
    try:
        # Verify ownership
        proj = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user["user_id"]).single().execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")

        entities = supabase.table("entities").select("*").eq("project_id", project_id).execute()
        relationships = supabase.table("relationships").select("*").eq("project_id", project_id).execute()

        nodes = [
            {
                "id": e["id"],
                "name": e["name"],
                "type": e["type"],
                "description": e.get("description", ""),
                "suspicion_score": e.get("suspicion_score", 0),
                "mention_count": e.get("mention_count", 1),
            }
            for e in (entities.data or [])
        ]

        links = [
            {
                "source": r["entity_a_id"],
                "target": r["entity_b_id"],
                "label": r["relation_label"],
                "confidence": r.get("confidence_score", 0.7),
            }
            for r in (relationships.data or [])
        ]

        return {"nodes": nodes, "links": links}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get graph: {e}")
        raise HTTPException(500, "Failed to get graph data")


@router.get("/{project_id}/findings")
async def get_findings(project_id: str, user: dict = Depends(get_current_user)):
    """Return all findings sorted by suspicion score."""
    try:
        proj = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user["user_id"]).single().execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")

        result = supabase.table("findings") \
            .select("*") \
            .eq("project_id", project_id) \
            .order("suspicion_score", desc=True) \
            .execute()
        return result.data or []

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get findings: {e}")
        raise HTTPException(500, "Failed to get findings")


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    """Delete a project and all related data (cascading)."""
    try:
        proj = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user["user_id"]).single().execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")

        supabase.table("projects").delete().eq("id", project_id).execute()
        logger.info(f"Deleted project {project_id}")
        return {"message": "Project deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete project: {e}")
        raise HTTPException(500, "Failed to delete project")
