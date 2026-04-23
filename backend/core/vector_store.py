"""Vector store wrapper for pgvector operations."""

import logging
from core.embedder import similarity_search, embed_and_store

logger = logging.getLogger(__name__)


async def search_documents(query: str, project_id: str, top_k: int = 5) -> list[dict]:
    """Search for chunks relevant to a query using pgvector cosine similarity."""
    return await similarity_search(query, project_id, top_k)


async def store_chunks(chunks: list[dict], project_id: str) -> int:
    """Embed and store document chunks in pgvector."""
    return await embed_and_store(chunks, project_id)
