import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.models import Order, User, Service, Vehicle, OrderVehicle

# Basic lifecycle tests for start/end wash idempotency and validation

def ensure_order(db: Session) -> Order:
    user = db.query(User).first()
    if not user:
        user = User(email="lc@test.com", phone="0811111111", first_name="Life", last_name="Cycle", tenant_id="default", role="user")
        db.add(user); db.flush()
    svc = db.query(Service).first()
    if not svc:
        svc = Service(category="wash", name="LC Wash", base_price=1000)
        db.add(svc); db.flush()
    order = Order(service_id=svc.id, quantity=1, extras=[], user_id=user.id, status="paid")
    db.add(order); db.commit(); db.refresh(order)
    veh = Vehicle(user_id=user.id, plate="LC123", make="Test", model="Car")
    db.add(veh); db.commit(); db.refresh(veh)
    db.add(OrderVehicle(order_id=order.id, vehicle_id=veh.id)); db.commit()
    return order


def test_start_wash_idempotent(client: TestClient, db_session: Session):
    order = ensure_order(db_session)
    r1 = client.post(f"/api/payments/start-wash/{order.id}", json={"vehicle_id": order.vehicles[0].vehicle_id})
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["status"] in ("started", "already_started")
    r2 = client.post(f"/api/payments/start-wash/{order.id}", json={"vehicle_id": order.vehicles[0].vehicle_id})
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["status"] == "already_started"


def test_end_wash_requires_start(client: TestClient, db_session: Session):
    order = ensure_order(db_session)
    # end before start should 400
    r_bad = client.post(f"/api/payments/end-wash/{order.id}")
    assert r_bad.status_code == 400
    # start
    client.post(f"/api/payments/start-wash/{order.id}", json={"vehicle_id": order.vehicles[0].vehicle_id})
    r_end = client.post(f"/api/payments/end-wash/{order.id}")
    assert r_end.status_code == 200
    data = r_end.json(); assert data["status"] == "ended"
    # second end is idempotent
    r_again = client.post(f"/api/payments/end-wash/{order.id}")
    assert r_again.status_code == 200
    assert r_again.json()["status"] == "already_completed"
