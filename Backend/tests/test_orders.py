import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.models import Service, Extra, Order, Payment, Vehicle
from app.plugins.orders.schemas import OrderCreateRequest, OrderCreateResponse
from config import settings


def test_create_and_retrieve_order(client: TestClient, db_session: Session):
    # Seed service and extra
    service = Service(category="wash", name="Basic Wash", base_price=100, loyalty_eligible=False)
    extra = Extra(name="Wax", price_map={"standard": 50})
    db_session.add_all([service, extra])
    db_session.commit()

    # Create order
    payload = {"service_id": service.id, "quantity": 2, "extras": [{"id": extra.id, "quantity": 1}]}
    resp = client.post("/api/orders/create", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "order_id" in data and "qr_data" in data
    order_id = data["order_id"]

    # Retrieve order details
    resp = client.get(f"/api/orders/{order_id}")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["orderId"] == order_id
    assert detail["serviceName"] == service.name
    # paymentPin should be present
    assert "paymentPin" in detail and isinstance(detail["paymentPin"], str)


def test_list_orders_and_assign_vehicle(client: TestClient, db_session: Session):
    # Seed service
    service = Service(category="wash", name="Deluxe Wash", base_price=150, loyalty_eligible=False)
    db_session.add(service)
    db_session.commit()

    # Create order via legacy endpoint
    create_payload = {"service_id": service.id, "quantity": 1, "extras": []}
    legacy_resp = client.post("/api/orders", json=create_payload)
    assert legacy_resp.status_code == 200
    order = legacy_resp.json()
    order_id = order["orderId"]  # Use camelCase field name due to schema alias

    # List orders
    resp = client.get("/api/orders")
    assert resp.status_code == 200
    orders = resp.json()
    assert any(o["orderId"] == order_id for o in orders)  # Use camelCase field name

    # Assign new vehicle
    assign_payload = {"plate": "XYZ123", "make": "Test", "model": "Car"}
    resp = client.post(f"/api/orders/{order_id}/assign-vehicle", json=assign_payload)
    assert resp.status_code == 200
    out = resp.json()
    assert order_id == out.get("orderId") or out.get("order_id") == order_id

    # Verify vehicle assigned in DB
    veh = db_session.query(Vehicle).filter_by(plate="XYZ123").first()
    assert veh is not None


def test_create_order_invalid_service(client: TestClient, db_session: Session):
    # No services seeded => invalid service id
    resp = client.post("/api/orders/create", json={"service_id": 99999, "quantity":1, "extras":[]})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Service not found"


def test_create_order_invalid_extra(client: TestClient, db_session: Session):
    # Seed a valid service only
    from app.models import Service
    svc = Service(category="wash", name="Basic", base_price=100, loyalty_eligible=False)
    db_session.add(svc); db_session.commit()
    payload = {"service_id": svc.id, "quantity":1, "extras":[{"id":12345, "quantity":1}]}
    resp = client.post("/api/orders/create", json=payload)
    assert resp.status_code == 400
    assert "Invalid extra id" in resp.json()["detail"]


def test_create_order_pk_is_integer_but_response_string(client: TestClient, db_session: Session):
    # Seed service
    from app.models import Service
    svc = Service(category="wash", name="RespCheck", base_price=200, loyalty_eligible=False)
    db_session.add(svc); db_session.commit()
    resp = client.post("/api/orders/create", json={"service_id": svc.id, "quantity":1, "extras":[]})
    assert resp.status_code == 201
    data = resp.json()
    # order_id should be a string convertible to int
    assert isinstance(data["order_id"], str)
    int_val = int(data["order_id"])  # must not raise
    assert int_val > 0
