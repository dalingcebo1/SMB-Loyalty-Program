import json
import hmac
import hashlib
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest
from app.models import User

from app.models import Service, Extra, Reward, VisitCount
from config import settings

REWARD_INTERVAL = 5

@pytest.mark.usefixtures("db_session")
def test_full_order_payment_loyalty_flow(client: TestClient, db_session: Session, monkeypatch):
    # Seed a service and extra
    service = Service(category="wash", name="Integration Wash", base_price=200)
    extra = Extra(name="Integration Wax", price_map={"standard": 50})
    db_session.add_all([service, extra])
    db_session.commit()

    # Create an order
    order_payload = {"service_id": service.id, "quantity": 1, "extras": [{"id": extra.id, "quantity": 2}]}
    resp = client.post("/api/orders/create", json=order_payload)
    print('Order creation:', resp.status_code, resp.json())
    assert resp.status_code == 201
    order_id = resp.json()["order_id"]

    # Mock payment gateway
    from app.plugins.payments.routes import requests as _requests
    def fake_post(url, json, headers, timeout):
        return type("R", (), {"json": lambda self: {"chargeId": "int_tx", "status": "successful", "source": {"brand": "VISA"}}, "status_code": 200})()
    monkeypatch.setattr(_requests, "post", fake_post)

    # Charge payment
    pay_resp = client.post("/api/payments/charge", json={"token": "tok","orderId": order_id,"amount": service.base_price})
    assert pay_resp.status_code == 200
    assert pay_resp.json()["message"] == "Payment successful"

    from app.models import User, VisitCount, Reward

    # Seed reward for loyalty
    reward = Reward(
        tenant_id=settings.default_tenant,
        title="Integration Reward",
        description="",
        type="milestone",
        milestone=REWARD_INTERVAL,
        cost=0,
        created_at=datetime.utcnow(),
        service_id=None,
    )
    db_session.add(reward)
    db_session.commit()

    # Seed visit count equal to one interval for the test user
    user = db_session.query(User).first()
    vc = VisitCount(
        tenant_id=settings.default_tenant,
        user_id=user.id,
        count=REWARD_INTERVAL,
        updated_at=datetime.utcnow(),
    )
    db_session.add(vc)
    db_session.commit()

    # Check loyalty endpoint
    loy_resp = client.get("/api/loyalty/me")
    assert loy_resp.status_code == 200
    loy_data = loy_resp.json()
    assert loy_data["visits"] == REWARD_INTERVAL
    # Should have one ready reward
    assert len(loy_data["rewards_ready"]) == 1
    assert loy_data["rewards_ready"][0]["milestone"] == REWARD_INTERVAL

    # Verify loyalty via PIN
    pin = loy_data["rewards_ready"][0]["pin"]
    resp_pin = client.get("/api/payments/verify-loyalty", params={"pin": pin})
    assert resp_pin.status_code == 200
    data_pin = resp_pin.json()
    assert data_pin["status"] == "ok"
    assert data_pin["type"] == "loyalty"

    # Verify loyalty via QR reference/token
    qr = loy_data["rewards_ready"][0]["qr_reference"]
    resp_qr = client.get("/api/payments/verify-loyalty", params={"qr": qr})
    assert resp_qr.status_code == 200
    data_qr = resp_qr.json()
    assert data_qr["status"] == "ok"
    assert data_qr["type"] == "loyalty"
