from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import Order, User, Service, Vehicle, OrderVehicle


def ensure_order(db: Session):
    user = db.query(User).first()
    if not user:
        user = User(email="wa@test.com", phone="0899999999", first_name="Wash", last_name="Analytics", tenant_id="default", role="user")
        db.add(user); db.flush()
    svc = db.query(Service).first()
    if not svc:
        svc = Service(category="wash", name="WA Wash", base_price=1000)
        db.add(svc); db.flush()
    order = Order(service_id=svc.id, quantity=1, extras=[], user_id=user.id, status="paid")
    db.add(order); db.commit(); db.refresh(order)
    veh = Vehicle(user_id=user.id, plate="WA123", make="Test", model="Car")
    db.add(veh); db.commit(); db.refresh(veh)
    db.add(OrderVehicle(order_id=order.id, vehicle_id=veh.id)); db.commit()
    return order


def test_dashboard_analytics_includes_duration_metrics(client: TestClient, db_session: Session):
    order = ensure_order(db_session)
    client.post(f"/api/payments/start-wash/{order.id}", json={"vehicle_id": order.vehicles[0].vehicle_id})
    client.post(f"/api/payments/end-wash/{order.id}")

    r = client.get("/api/payments/dashboard-analytics")
    assert r.status_code == 200
    data = r.json()
    assert "wash_duration_seconds" in data
    dur = data["wash_duration_seconds"]
    assert set(["average", "median", "p95", "sample_size"]).issubset(dur.keys())
    if dur["sample_size"] >= 1:
        assert dur["average"] is not None
        assert dur["median"] is not None
        assert dur["p95"] is not None
