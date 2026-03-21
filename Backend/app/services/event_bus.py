"""
In-memory event bus for real-time Server-Sent Events (SSE).

Provides a simple pub/sub mechanism scoped by tenant_id. Each subscriber
gets a thread-safe ``queue.Queue`` that receives events published for their
tenant.  Using stdlib queues (rather than ``asyncio.Queue``) ensures that
synchronous route handlers running in a threadpool can safely publish
events that are consumed by the async SSE generator.

For horizontal scaling, swap the in-memory implementation with Redis
pub/sub (the interface stays the same).
"""
from __future__ import annotations

import logging
import queue
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """A single SSE event payload."""
    type: str
    data: Dict[str, Any]
    tenant_id: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EventBus:
    """Tenant-scoped in-memory pub/sub for SSE events.

    All methods are thread-safe.
    """

    def __init__(self) -> None:
        # tenant_id -> list of subscriber queues
        self._subscribers: Dict[str, list[queue.Queue[Event]]] = {}

    def subscribe(self, tenant_id: str) -> queue.Queue[Event]:
        """Create and return a new subscriber queue for the given tenant."""
        q: queue.Queue[Event] = queue.Queue(maxsize=256)
        self._subscribers.setdefault(tenant_id, []).append(q)
        logger.debug("SSE subscriber added for tenant %s (total: %d)", tenant_id, len(self._subscribers[tenant_id]))
        return q

    def unsubscribe(self, tenant_id: str, q: queue.Queue[Event]) -> None:
        """Remove a subscriber queue."""
        subs = self._subscribers.get(tenant_id, [])
        try:
            subs.remove(q)
        except ValueError:
            pass
        if not subs:
            self._subscribers.pop(tenant_id, None)
        logger.debug("SSE subscriber removed for tenant %s", tenant_id)

    def publish(self, tenant_id: str, event_type: str, data: Dict[str, Any]) -> None:
        """Publish an event to all subscribers of the given tenant.

        Thread-safe — can be called from sync route handlers in any thread.
        """
        event = Event(type=event_type, data=data, tenant_id=tenant_id)
        subs = self._subscribers.get(tenant_id, [])
        for q in subs:
            try:
                q.put_nowait(event)
            except queue.Full:
                logger.warning("SSE queue full for tenant %s, dropping event %s", tenant_id, event_type)

    @property
    def subscriber_count(self) -> int:
        return sum(len(q) for q in self._subscribers.values())


# Module-level singleton
event_bus = EventBus()


def get_event_bus() -> EventBus:
    """Dependency-injectable accessor for the global event bus."""
    return event_bus
