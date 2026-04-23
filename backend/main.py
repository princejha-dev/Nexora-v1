"""FastAPI application entry point for InvestiGraph AI."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify Google embedding config on startup."""
    logger.info("Starting InvestiGraph AI...")
    from core.embedder import get_model_name, get_embedding_dimension
    logger.info(f"Embedding ready: {get_model_name()} (dim={get_embedding_dimension()})")
    yield
    logger.info("Shutting down InvestiGraph AI...")


app = FastAPI(
    title="InvestiGraph AI",
    description="AI-powered investigative journalism platform",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.auth import router as auth_router
from api.projects import router as projects_router
from api.stream import router as stream_router
from api.chat import router as chat_router
from api.agents import router as agents_router

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(stream_router)
app.include_router(chat_router)
app.include_router(agents_router)


@app.get("/health")
async def health_check():
    from core.embedder import get_model_name, get_embedding_dimension
    return {
        "status": "healthy",
        "model": get_model_name(),
        "embedding_dim": get_embedding_dimension(),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )
