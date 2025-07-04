import json
import hashlib
import hmac
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from app.models import Order, Payment, User
from config import settings

# Helper to create test order

def create_test_order(db_session: Session, user_id: int, order_id: str = "ord1") -> Order:
    order = Order(id=order_id, service_id=1, quantity=1, extras=[], user_id=user_id)
    db_session.add(order)
    db_session.commit()
    return order

@pytest.fixture(autouse=True)
def default_user(db_session):
    # ensure a user exists for dependency override
    from app.models import User
    if not db_session.query(User).first():
        user = User(
            email="payuser@example.com",
            hashed_password=None,
            onboarded=True,
            first_name="Pay",
            last_name="User",
            phone="0810000000",
            tenant_id=settings.default_tenant,
            created_at=datetime.utcnow(),
            role="user",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    yield

class DummyResp:
    def __init__(self, data, status_code=200):
        self._data = data
        self.status_code = status_code
    def json(self):
        return self._data


def test_charge_and_payment_flow(client: TestClient, db_session: Session, monkeypatch):
    # create order
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id, "o1")
    # patch requests.post
    def fake_post(url, json, headers, timeout):
        return DummyResp({"chargeId": "ch1", "status": "successful", "source": {"brand": "VISA"}})
    monkeypatch.setattr("app.plugins.payments.routes.requests.post", fake_post)

    resp = client.post("/api/payments/charge", json={"token": "tok","orderId": "o1","amount": 500})
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Payment successful"
    # verify DB
    pay = db_session.query(Payment).filter_by(order_id="o1", transaction_id="ch1").first()
    assert pay is not None and pay.status == "success"
    ord = db_session.query(Order).get("o1")
    assert ord.status == "paid"


def test_webhook_updates_payment(client: TestClient, db_session: Session):
    # create existing payment
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id, "w1")
    pay = Payment(order_id="w1", transaction_id="tx1", status="initialized", created_at=datetime.utcnow())
    db_session.add(pay);
    db_session.commit()
    # prepare webhook
    payload = {"data": {"id": "tx1", "status": "successful"}}
    raw = json.dumps(payload).encode()
    sig = hmac.new(settings.yoco_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    headers = {"Yoco-Signature": sig}

    resp = client.post("/api/payments/webhook/yoco", data=raw, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    # verify DB updates
    upd = db_session.query(Payment).filter_by(transaction_id="tx1").first()
    assert upd.status == "success"
    ord = db_session.query(Order).get("w1")
    assert ord.status == "paid"


def test_get_qr_and_verify_payment(client: TestClient, db_session: Session):
    # setup payment
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id, "q1")
    pay = Payment(order_id="q1", transaction_id="txq", status="success", qr_code_base64="abc123", created_at=datetime.utcnow())
    db_session.add(pay)
    db_session.commit()

    # QR endpoint
    resp = client.get("/api/payments/qr/q1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["qr_code_base64"] == "abc123"
    assert data["reference"] == "txq"

    # Verify payment
    resp = client.get("/api/payments/verify-payment", params={"pin": order.payment_pin or pay.transaction_id})
    # should return ok or already_redeemed type
    assert resp.status_code == 200
    result = resp.json()
    assert result["type"] == "payment"
