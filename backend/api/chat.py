"""RAG-powered chat endpoint — streams answers from uploaded documents and investigation graph."""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langchain_groq import ChatGroq

from api.auth import get_current_user
from config import get_settings
from core.embedder import similarity_search
from db.supabase import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

_MODEL_NAME = "openai/gpt-oss-120b"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


@router.post("/{project_id}")
async def chat(project_id: str, body: ChatRequest, user: dict = Depends(get_current_user)):
    # 1. Verify project ownership
    try:
        proj = supabase.table("projects").select("id, name, description").eq("id", project_id).eq("user_id", user["user_id"]).single().execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Project check failed: {e}")
        raise HTTPException(404, "Project not found")

    project_info = proj.data

    # 2. Build contextual search query using recent user messages to preserve references
    search_query = body.message
    if body.history:
        recent_user_turns = [m.content for m in body.history if m.role == "user"][-2:]
        if recent_user_turns:
            search_query = f"{' '.join(recent_user_turns)} {body.message}"

    # 3. Retrieve document chunks via similarity search
    try:
        relevant = await similarity_search(search_query, project_id, top_k=5)
    except Exception as e:
        logger.warning(f"Similarity search failed: {e}")
        relevant = []

    doc_context = "\n\n".join([
        f"[Document Chunk {c.get('chunk_index', i+1)} | Similarity: {c.get('similarity', 'N/A')}]:\n{c.get('content', '')}"
        for i, c in enumerate(relevant)
    ]) if relevant else "No direct document chunk matches found."

    # 4. Retrieve project graph context (entities and findings)
    try:
        entities_res = supabase.table("entities").select("name, type, description").eq("project_id", project_id).limit(25).execute()
        findings_res = supabase.table("findings").select("title, description, suspicion_score, verified").eq("project_id", project_id).limit(10).execute()

        entities_list = [f"- {e['name']} ({e.get('type', 'entity')}): {e.get('description', '')}" for e in (entities_res.data or [])]
        findings_list = [f"- [{f.get('suspicion_score', 0)}/10] {f['title']}: {f.get('description', '')} (Verified: {f.get('verified', False)})" for f in (findings_res.data or [])]

        graph_context = "KNOWN ENTITIES:\n" + ("\n".join(entities_list) if entities_list else "None recorded yet.")
        findings_context = "DETECTED FINDINGS:\n" + ("\n".join(findings_list) if findings_list else "None recorded yet.")
    except Exception as e:
        logger.warning(f"Failed to fetch graph/findings context: {e}")
        graph_context = ""
        findings_context = ""

    # 5. Build prompt
    system_prompt = f"""You are an expert investigative research assistant working on project: '{project_info.get('name', 'Investigation')}'.
Project Description: {project_info.get('description', 'N/A')}

Answer questions accurately by synthesizing the document excerpts, known entities, and detected findings below.

INVESTIGATION GRAPH & FINDINGS:
{graph_context}

{findings_context}

DOCUMENT EXCERPTS:
{doc_context}

GUIDELINES:
- Provide clear, factual, and well-structured answers.
- Reference specific entities, transactions, or document excerpts when relevant.
- If information is not in the evidence or context, acknowledge the limitation clearly rather than inventing details.
- Use clean Markdown (bullet points, bold text) for readability."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in (body.history or [])[-6:]:
        role = "assistant" if msg.role in ("ai", "assistant") else "user"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    async def stream():
        llm = ChatGroq(
            model_name=_MODEL_NAME,
            streaming=True,
            groq_api_key=get_settings().GROQ_API_KEY,
            temperature=0.2,
            max_tokens=2048,
            model_kwargs={"reasoning_format": "hidden"},
        )

        try:
            async for chunk in llm.astream(messages):
                content = chunk.content
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
            yield f"data: {json.dumps({'content': '[DONE]'})}\n\n"
        except Exception as e:
            logger.error(f"Chat streaming error: {e}")
            yield f"data: {json.dumps({'content': f'\\n\\n[Error: {str(e)}]' })}\n\n"
            yield f"data: {json.dumps({'content': '[DONE]'})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
