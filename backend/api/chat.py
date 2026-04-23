"""RAG-powered chat endpoint — streams answers from uploaded documents."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from api.auth import get_current_user
from config import get_settings
from core.embedder import similarity_search
from db.supabase import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

_llm = ChatGroq(
    model_name="llama-3.1-8b-instant",
    api_key=get_settings().GROQ_API_KEY,
    temperature=0.3,
    max_tokens=1024,
    streaming=True,
)

_chat_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an investigative research assistant.
Answer ONLY from the provided document context.
If information is not in the context, say so clearly.
Be factual, precise, and cite specific details from the documents."""),
    ("human", "DOCUMENT CONTEXT:\n{context}\n\nQUESTION: {question}")
])


class ChatRequest(BaseModel):
    message: str


@router.post("/{project_id}")
async def chat(project_id: str, body: ChatRequest, user: dict = Depends(get_current_user)):
    # Verify project ownership
    try:
        proj = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user["user_id"]).single().execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "Project not found")

    relevant = await similarity_search(body.message, project_id, top_k=5)
    context = "\n\n".join([c["content"] for c in relevant])

    async def stream():
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            streaming=True,
            groq_api_key=get_settings().GROQ_API_KEY
        )
        prompt = f"""You are an investigative research assistant.
Answer using ONLY the document context provided.

STRICT FORMATTING RULES:
- Write in short paragraphs, maximum 2 sentences each
- Put a blank line between every paragraph
- Use "- " bullet points when listing multiple facts
- Never write more than 30 words in a single sentence
- Always put spaces between words (never concatenate)

CONTEXT:
{context}

QUESTION: {body.message}

Answer:"""

        async for chunk in llm.astream(prompt):
            yield f"data: {chunk.content or ' '}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )
