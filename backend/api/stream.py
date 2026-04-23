"""SSE streaming endpoint for live pipeline updates."""

import asyncio
import json
import logging
from typing import Callable

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from api.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stream", tags=["stream"])

# Module-level dict of asyncio.Queue per project
_queues: dict[str, asyncio.Queue] = {}


def create_queue(project_id: str):
    """Create an SSE queue for a project."""
    _queues[project_id] = asyncio.Queue()


def get_emit_fn(project_id: str) -> Callable:
    """Return an async emit function that pushes events to the project's queue."""
    async def emit(event: str, data: dict):
        queue = _queues.get(project_id)
        if queue:
            await queue.put({"event": event, "data": data})
    return emit


async def _event_generator(project_id: str):
    """Generate SSE events from the project's queue."""
    queue = _queues.get(project_id)
    if not queue:
        yield f"data: {json.dumps({'event': 'error', 'message': 'No active pipeline'})}\n\n"
        return

    ping_interval = 30  # seconds
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=ping_interval)
                event_type = msg.get("event", "message")
                data = json.dumps(msg.get("data", {}))
                yield f"event: {event_type}\ndata: {data}\n\n"

                # Stop streaming on complete or error
                if event_type in ("complete", "error"):
                    break

            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                yield f"event: ping\ndata: {json.dumps({'keepalive': True})}\n\n"

    finally:
        # Cleanup queue
        _queues.pop(project_id, None)


@router.get("/{project_id}")
async def stream_pipeline(project_id: str, user: dict = Depends(get_current_user)):
    """SSE endpoint — streams pipeline status, graph updates, and completion."""
    return StreamingResponse(
        _event_generator(project_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
