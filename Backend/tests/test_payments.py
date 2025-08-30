import json
import hashlib
import hmac
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from app.models import Order, Payment, User, Service
from config import settings

"""Helper to create a test order using autoincrement integer primary key.

Previously tests attempted to assign string IDs (e.g. "o1"), but the model defines
`Order.id` as an Integer autoincrement column causing sqlite IntegrityError (datatype mismatch).
We now ignore any external ID and rely on the DB-generated integer ID.
"""

def create_test_order(db_session: Session, user_id: int) -> Order:
    service = db_session.query(Service).first()
    if not service:
        service = Service(category="wash", name="Test Wash", base_price=1000)
        db_session.add(service)
        db_session.flush()
    order = Order(
        service_id=service.id,
        quantity=1,
        extras=[],
        user_id=user_id,
        status="pending",
        redeemed=False,
    )
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
    # create order (auto integer id)
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id)
    # patch requests.post
    def fake_post(url, json, headers, timeout):
        return DummyResp({"chargeId": "ch1", "status": "successful", "source": {"brand": "VISA"}})
    monkeypatch.setattr("app.plugins.payments.routes.requests.post", fake_post)

    resp = client.post("/api/payments/charge", json={"token": "tok","orderId": order.id, "amount": 500})
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Payment successful"
    # verify DB
    pay = db_session.query(Payment).filter_by(order_id=order.id, transaction_id="ch1").first()
    assert pay is not None and pay.status == "success"
    ord = db_session.query(Order).get(order.id)
    assert ord.status == "paid"


def test_webhook_updates_payment(client: TestClient, db_session: Session):
    # create existing payment
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id)
    pay = Payment(order_id=order.id, transaction_id="tx1", status="initialized", created_at=datetime.utcnow())
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
    ord = db_session.query(Order).get(order.id)
    assert ord.status == "paid"


def test_get_qr_and_verify_payment(client: TestClient, db_session: Session):
    # setup payment
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id)
    pay = Payment(order_id=order.id, transaction_id="txq", status="success", qr_code_base64="abc123", created_at=datetime.utcnow())
    db_session.add(pay)
    db_session.commit()

    # QR endpoint
    resp = client.get(f"/api/payments/qr/{order.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["qr_code_base64"] == "abc123"
    assert data["reference"] == "txq"

    # Verify payment
    resp = client.get("/api/payments/verify-payment", params={"pin": order.payment_pin or pay.transaction_id})
    assert resp.status_code == 200
    result = resp.json()
    assert result["type"] == "payment"
    assert "user" in result
    assert "vehicle" in result or result.get("available_vehicles") is not None

def test_verify_payment_ref_alias_and_available_vehicles(client: TestClient, db_session: Session):
    # create order with no vehicle linked -> should return available_vehicles list
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id)
    # create a success payment
    pay = Payment(order_id=order.id, transaction_id="txref", reference="ref-alias", status="success", created_at=datetime.utcnow())
    db_session.add(pay); db_session.commit()
    # add second vehicle for user to ensure list
    from app.models import Vehicle
    veh = Vehicle(user_id=user.id, plate="PINREF1", make="M", model="X")
    db_session.add(veh); db_session.commit(); db_session.refresh(veh)

    # Use ref alias param
    r = client.get("/api/payments/verify-payment", params={"ref": pay.reference})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("ok", "already_redeemed")
    # No vehicle attached to order, should expose available_vehicles
    assert data.get("vehicle") is None
    assert isinstance(data.get("available_vehicles"), list)
    assert any(v["reg"] == "PINREF1" for v in data["available_vehicles"]) or any(v.get("plate") == "PINREF1" for v in data["available_vehicles"])  # plate/reg naming

def test_verify_payment_qr_param(client: TestClient, db_session: Session):
    user = db_session.query(User).first()
    order = create_test_order(db_session, user.id)
    pay = Payment(order_id=order.id, transaction_id="txqr2", reference="qr-ref-2", status="success", created_at=datetime.utcnow())
    db_session.add(pay); db_session.commit()
    r = client.get("/api/payments/verify-payment", params={"qr": pay.reference})
    assert r.status_code == 200
    data = r.json(); assert data["type"] == "payment"
    # second call should be already_redeemed
    r2 = client.get("/api/payments/verify-payment", params={"qr": pay.reference})
    assert r2.status_code == 200
    assert r2.json()["status"] == "already_redeemed"
