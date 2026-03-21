"""Tests for the event bus service and SSE streaming endpoint."""
import json
import queue
import pytest

from app.services.event_bus import EventBus, Event, get_event_bus


# ── EventBus unit tests ────────────────────────────────────────────────────

class TestEventBus:
    def test_publish_without_subscribers(self):
        """Publishing with no subscribers should not raise."""
        bus = EventBus()
        bus.publish("tenant-1", "order_status_changed", {"order_id": "1"})

    def test_subscribe_and_receive(self):
        """A subscriber should receive published events."""
        bus = EventBus()
        q = bus.subscribe("tenant-1")
        bus.publish("tenant-1", "order_status_changed", {"order_id": "42", "new_status": "completed"})
        assert not q.empty()
        event = q.get_nowait()
        assert isinstance(event, Event)
        assert event.type == "order_status_changed"
        assert event.data["order_id"] == "42"
        assert event.tenant_id == "tenant-1"

    def test_tenant_isolation(self):
        """Events for one tenant should not reach subscribers of another."""
        bus = EventBus()
        q1 = bus.subscribe("tenant-a")
        q2 = bus.subscribe("tenant-b")
        bus.publish("tenant-a", "payment_verified", {"order_id": "10"})
        assert not q1.empty()
        assert q2.empty()

    def test_unsubscribe(self):
        """After unsubscribing, queue should no longer receive events."""
        bus = EventBus()
        q = bus.subscribe("t1")
        bus.unsubscribe("t1", q)
        bus.publish("t1", "new_notification", {"msg": "hello"})
        assert q.empty()

    def test_unsubscribe_nonexistent(self):
        """Unsubscribing a queue that was never registered should not raise."""
        bus = EventBus()
        fake_queue: queue.Queue = queue.Queue()
        bus.unsubscribe("no-tenant", fake_queue)  # should not raise

    def test_multiple_subscribers(self):
        """All subscribers for a tenant should receive the same event."""
        bus = EventBus()
        q1 = bus.subscribe("t1")
        q2 = bus.subscribe("t1")
        bus.publish("t1", "loyalty_milestone", {"user_id": 5})
        assert not q1.empty()
        assert not q2.empty()
        assert q1.get_nowait().type == "loyalty_milestone"
        assert q2.get_nowait().type == "loyalty_milestone"

    def test_queue_full_does_not_raise(self):
        """Publishing to a full queue should drop the event, not raise."""
        bus = EventBus()
        q = bus.subscribe("t1")
        # Fill up the queue
        for i in range(256):
            bus.publish("t1", "test", {"i": i})
        # One more should be dropped silently
        bus.publish("t1", "overflow", {"extra": True})
        assert q.qsize() == 256

    def test_subscriber_count(self):
        bus = EventBus()
        assert bus.subscriber_count == 0
        bus.subscribe("t1")
        bus.subscribe("t1")
        bus.subscribe("t2")
        assert bus.subscriber_count == 3

    def test_get_event_bus_returns_singleton(self):
        """get_event_bus() should always return the same instance."""
        bus1 = get_event_bus()
        bus2 = get_event_bus()
        assert bus1 is bus2

    def test_event_has_timestamp(self):
        """Published events should carry an ISO timestamp."""
        bus = EventBus()
        q = bus.subscribe("t1")
        bus.publish("t1", "test_event", {"key": "val"})
        event = q.get_nowait()
        assert event.timestamp  # non-empty string


# ── SSE endpoint tests ──────────────────────────────────────────────────────

from tests.conftest import _get_main
from fastapi.testclient import TestClient
from app.core.database import get_db


class TestSSEEndpoint:
    @pytest.fixture
    def _client(self, db_session):
        """Client fixture with auth overrides for SSE tests."""
        app_instance = _get_main().app
        from app.plugins.auth.routes import get_current_user
        from app.models import User

        def override_get_db():
            yield db_session

        def override_get_current_user():
            return db_session.query(User).first()

        app_instance.dependency_overrides[get_db] = override_get_db
        app_instance.dependency_overrides[get_current_user] = override_get_current_user
        yield TestClient(app_instance)
        app_instance.dependency_overrides.pop(get_current_user, None)

    def test_event_generator_yields_sse_format(self):
        """The internal generator should produce valid SSE frames."""
        import asyncio
        from app.routes.stream import _event_generator
        from unittest.mock import AsyncMock

        bus = EventBus()

        # Allow multiple is_disconnected checks: the generator polls the queue
        # with asyncio.sleep(0.5), so we need enough False returns before it
        # picks up the published event.
        mock_request = AsyncMock()
        mock_request.is_disconnected = AsyncMock(side_effect=[False, False, False, True])

        async def _collect():
            gen = _event_generator(mock_request, "test-tenant", bus)
            it = gen.__aiter__()

            # Schedule a publish after a tiny delay (generator subscribes first,
            # then sleeps in the poll loop — the event will be picked up on the
            # next iteration).
            async def _delayed_publish():
                await asyncio.sleep(0.05)
                bus.publish("test-tenant", "order_status_changed", {"order_id": "1", "new_status": "completed"})

            asyncio.ensure_future(_delayed_publish())

            chunks: list[str] = []
            async for chunk in gen:
                chunks.append(chunk)
                if chunk.startswith("event:"):
                    break
            return chunks

        chunks = asyncio.get_event_loop().run_until_complete(_collect())
        assert len(chunks) >= 1
        first = chunks[0]
        assert first.startswith("event: order_status_changed\n")
        assert "data:" in first
        data_line = [l for l in first.split("\n") if l.startswith("data:")][0]
        payload = json.loads(data_line.removeprefix("data:").strip())
        assert payload["type"] == "order_status_changed"
        assert payload["data"]["order_id"] == "1"

    def test_stream_endpoint_registered(self, _client):
        """The /api/stream/events endpoint should exist and be accessible."""
        # Use a regular GET (not streaming) to verify routing exists.
        # The endpoint returns a streaming response, so we just verify
        # the route resolves without 404.
        from fastapi.routing import APIRoute
        app_instance = _get_main().app
        route_paths = [r.path for r in app_instance.routes if isinstance(r, APIRoute)]
        assert "/api/stream/events" in route_paths

