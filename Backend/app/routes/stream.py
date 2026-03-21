"""
Server-Sent Events (SSE) streaming endpoint.

Provides ``GET /events`` which returns a ``text/event-stream`` response.
Each connected client receives tenant-scoped events published via the
:mod:`app.services.event_bus` singleton.

Authentication is enforced via JWT — the token may be passed as a
standard ``Authorization: Bearer <token>`` header **or** as a ``token``
query parameter (necessary because the browser ``EventSource`` API does
not support custom request headers).
"""
from __future__ import annotations

import asyncio
import json
import logging
import queue
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.plugins.auth.routes import get_current_user as _header_get_current_user
from app.services.event_bus import Event, get_event_bus, EventBus

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Stream"])

# How often (seconds) to poll the thread-safe queue for new events.
_POLL_INTERVAL = 0.5
# How many poll cycles before sending a keep-alive comment (30 s / 0.5 s = 60).
_HEARTBEAT_CYCLES = 60


def _get_current_user_sse(
    request: Request,
    token: Optional[str] = Query(default=None, description="JWT bearer token (for EventSource which cannot set headers)"),
    db: Session = Depends(get_db),
):
    """Resolve the current user from *either* the Authorization header or a
    ``token`` query parameter.  Falls back to the standard ``get_current_user``
    when the header is present; uses the query-parameter token when the header
    is absent (typical for ``EventSource`` connections).
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return _header_get_current_user(token=auth_header.split(None, 1)[1], db=db)
    if token:
        return _header_get_current_user(token=token, db=db)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


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
    user=Depends(_get_current_user_sse),
    bus: EventBus = Depends(get_event_bus),
):
    """SSE endpoint for real-time tenant-scoped events.

    Requires a valid JWT bearer token (via header or ``?token=`` query
    parameter).  Events are scoped to the authenticated user's tenant.
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
