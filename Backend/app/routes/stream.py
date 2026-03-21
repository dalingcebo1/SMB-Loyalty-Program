"""
Server-Sent Events (SSE) streaming endpoint.

Provides ``GET /events`` which returns a ``text/event-stream`` response.
Each connected client receives tenant-scoped events published via the
:mod:`app.services.event_bus` singleton.

Authentication is enforced via the standard ``get_current_user`` dependency
so only logged-in users with a valid JWT can connect.
"""
from __future__ import annotations

import asyncio
import json
import logging
import queue
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.plugins.auth.routes import get_current_user
from app.services.event_bus import Event, get_event_bus, EventBus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Stream"])

# How often (seconds) to poll the thread-safe queue for new events.
_POLL_INTERVAL = 0.5
# How many poll cycles before sending a keep-alive comment (30 s / 0.5 s = 60).
_HEARTBEAT_CYCLES = 60


async def _event_generator(
    request: Request,
    tenant_id: str,
    bus: EventBus,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted strings from the event bus until the client disconnects."""
    subscriber_queue = bus.subscribe(tenant_id)
    try:
        heartbeat_counter = 0
        while True:
            if await request.is_disconnected():
                break
            try:
                event: Event = subscriber_queue.get_nowait()
                payload = json.dumps({"type": event.type, "data": event.data, "timestamp": event.timestamp})
                yield f"event: {event.type}\ndata: {payload}\n\n"
                heartbeat_counter = 0
            except queue.Empty:
                await asyncio.sleep(_POLL_INTERVAL)
                heartbeat_counter += 1
                if heartbeat_counter >= _HEARTBEAT_CYCLES:
                    yield ": heartbeat\n\n"
                    heartbeat_counter = 0
    finally:
        bus.unsubscribe(tenant_id, subscriber_queue)


@router.get("/events")
async def stream_events(
    request: Request,
    user=Depends(get_current_user),
    bus: EventBus = Depends(get_event_bus),
):
    """SSE endpoint for real-time tenant-scoped events.

    Requires a valid JWT bearer token. Events are scoped to the
    authenticated user's tenant.
    """
    tenant_id = getattr(user, "tenant_id", "default") or "default"
    logger.info("SSE connection opened for tenant %s (user %s)", tenant_id, getattr(user, "id", "?"))
    return StreamingResponse(
        _event_generator(request, tenant_id, bus),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
