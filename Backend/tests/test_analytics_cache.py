from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.models import Order, Payment, Service
from config import settings


def _seed_orders(db: Session, n: int = 3):
    # Ensure a service exists (needed for FK)
    service = db.query(Service).first()
    if not service:
        service = Service(category="wash", name="Perf Wash", base_price=1000)
        db.add(service)
        db.flush()
    now = datetime.utcnow()
    for i in range(n):
        o = Order(
            user_id=1,
            service_id=service.id,
            quantity=1,
            extras=[],
            status="completed",
            started_at=now - timedelta(minutes=10 + i),
            ended_at=now - timedelta(minutes=5 + i),
            redeemed=False,
        )
        db.add(o)
        db.flush()
        p = Payment(order_id=o.id, amount=1000, method="manual", status="success")
        db.add(p)
    db.commit()


def test_dashboard_analytics_cache_hit_flow(client: TestClient, db_session: Session):
    _seed_orders(db_session, 5)
    # first call (miss)
    r1 = client.get("/api/payments/dashboard-analytics")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["meta"]["cached"] is False
    # second call (should hit cache)
    r2 = client.get("/api/payments/dashboard-analytics")
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["meta"]["cached"] is True
    # metrics endpoint
    meta = client.get("/api/payments/dashboard-analytics/meta").json()
    assert meta["metrics"]["calls"] >= 2
    assert meta["metrics"]["cache_hits"] >= 1
    assert "cache_size" in meta and "cache_max" in meta and meta["cache_max"] >= meta["cache_size"]
    # Start a manual wash to invalidate cache
    client.post("/api/payments/start-manual-wash", json={"phone": "0812345678"})
    r3 = client.get("/api/payments/dashboard-analytics")
    assert r3.status_code == 200
    assert r3.json()["meta"]["cached"] is False
