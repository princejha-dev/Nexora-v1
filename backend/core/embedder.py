"""Embedding engine — Google Gemini embedding with rate limit handling."""

import time
import logging
from typing import Optional

import google.generativeai as genai

from config import get_settings

logger = logging.getLogger(__name__)

_MODEL_NAME = "gemini-embedding-001"
_EMBEDDING_DIM = 768
_MAX_RETRIES = 5
_BASE_DELAY = 2

# Configure Google AI
_settings = get_settings()
genai.configure(api_key=_settings.GOOGLE_API_KEY)

logger.info(f"Google Embedding configured: {_MODEL_NAME} (dim={_EMBEDDING_DIM})")


def _retry_with_backoff(func, *args, **kwargs):
    """Retry with exponential backoff for 429 rate limit errors."""
    for attempt in range(_MAX_RETRIES):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                delay = _BASE_DELAY * (2 ** attempt)
                logger.warning(f"Rate limited (attempt {attempt+1}/{_MAX_RETRIES}), waiting {delay}s...")
                time.sleep(delay)
            else:
                raise
    raise Exception(f"Failed after {_MAX_RETRIES} retries due to rate limiting")


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using Google Gemini."""
    if not texts:
        return []

    start = time.time()
    all_embeddings = []

    # Process in batches of 5 to stay within RPM limits
    batch_size = 5
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]

        for text in batch:
            result = _retry_with_backoff(
                genai.embed_content,
                model=f"models/{_MODEL_NAME}",
                content=text,
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=_EMBEDDING_DIM,
            )
            all_embeddings.append(result['embedding'])

        # Small delay between batches to avoid hitting RPM
        if i + batch_size < len(texts):
            time.sleep(1)

    elapsed = time.time() - start
    logger.info(f"Embedded {len(texts)} texts in {elapsed:.2f}s")
    return all_embeddings


def embed_query(text: str) -> list[float]:
    """Generate embedding for a single query."""
    start = time.time()
    result = _retry_with_backoff(
        genai.embed_content,
        model=f"models/{_MODEL_NAME}",
        content=text,
        task_type="RETRIEVAL_QUERY",
        output_dimensionality=_EMBEDDING_DIM,
    )
    elapsed = time.time() - start
    logger.info(f"Embedded query in {elapsed*1000:.1f}ms")
    return result['embedding']


async def embed_and_store(
    chunks: list[dict],
    project_id: str,
) -> int:
    """Embed chunks and batch-insert into pgvector."""
    from db.supabase import supabase

    if not chunks:
        return 0

    start = time.time()
    texts = [chunk["content"] for chunk in chunks]
    embeddings = embed_documents(texts)

    rows = []
    for chunk, embedding in zip(chunks, embeddings):
        rows.append({
            "document_id": chunk["document_id"],
            "project_id": project_id,
            "content": chunk["content"],
            "embedding": embedding,
            "chunk_index": chunk["chunk_index"],
        })

    batch_size = 50
    total_inserted = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            supabase.table("chunks").insert(batch).execute()
            total_inserted += len(batch)
            logger.info(f"Inserted batch {i // batch_size + 1}: {len(batch)} chunks")
        except Exception as e:
            logger.error(f"Failed to insert chunk batch: {e}")
            continue

    elapsed = time.time() - start
    logger.info(f"embed_and_store: {total_inserted}/{len(chunks)} chunks in {elapsed:.2f}s")
    return total_inserted


async def similarity_search(
    query: str,
    project_id: str,
    top_k: int = 5,
) -> list[dict]:
    """Find most similar chunks using pgvector cosine search."""
    from db.supabase import supabase

    start = time.time()
    query_embedding = embed_query(query)

    try:
        result = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": query_embedding,
                "filter_project_id": project_id,
                "match_count": top_k,
            },
        ).execute()

        chunks = result.data if result.data else []
        elapsed = time.time() - start
        logger.info(f"RAG retrieval: {len(chunks)} chunks in {elapsed:.2f}s")
        return chunks

    except Exception as e:
        logger.error(f"Similarity search failed: {e}")
        return []


def get_embedding_dimension() -> int:
    return _EMBEDDING_DIM


def get_model_name() -> str:
    return _MODEL_NAME
