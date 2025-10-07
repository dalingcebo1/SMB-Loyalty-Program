from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Service, Order, Payment, Tenant, User
from app.plugins.auth.routes import create_access_token
from app.services.tenant_settings import get_tenant_settings
from config import settings


def _ensure_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter_by(id=settings.default_tenant).first()
    if tenant:
        return tenant
    tenant = Tenant(
        id=settings.default_tenant,
        name="Default Tenant",
        loyalty_type="basic",
        vertical_type="carwash",
        created_at=datetime.utcnow(),
        config={},
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def _ensure_user(db: Session, email: str, role: str) -> User:
    user = db.query(User).filter_by(email=email).first()
    if user:
        if user.role != role:
            user.role = role
            db.commit()
            db.refresh(user)
        return user

    tenant = _ensure_tenant(db)
    user = User(
        email=email,
        tenant_id=tenant.id,
        role=role,
        onboarded=True,
        created_at=datetime.utcnow(),
        first_name="Test",
        last_name="User",
        phone="0000000000",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_token(db: Session, email: str) -> str:
    user = db.query(User).filter_by(email=email).first()
    assert user is not None
    tenant = user.tenant or db.query(Tenant).filter_by(id=user.tenant_id).first()
    tenant_settings = get_tenant_settings(tenant) if tenant else None
    return create_access_token(email, tenant_settings=tenant_settings)


def _reset_transactions(db: Session) -> None:
    db.query(Payment).delete()
    db.query(Order).delete()
    db.commit()


def _create_order_with_payment(
    db: Session,
    user_email: str,
    order_created_at: datetime,
    payment_created_at: datetime,
    amount_cents: int,
    status: str,
    method: str,
    source: str,
    reference: str,
    transaction_id: str,
    card_brand: str | None = None,
) -> Payment:
    customer = _ensure_user(db, user_email, "user")
    if not db.query(Service).first():
        svc = Service(name="Deluxe Wash", category="wash", base_price=1500, loyalty_eligible=True)
        db.add(svc)
        db.flush()
    service = db.query(Service).first()

    pin_seed = f"{reference}-{transaction_id}-{payment_created_at.timestamp()}"
    payment_pin = f"{abs(hash(pin_seed)) % 10000:04d}"

    order = Order(
        service_id=service.id if service else None,
        quantity=1,
        extras=[],
        payment_pin=payment_pin,
        status="paid" if status == "success" else "pending",
        user_id=customer.id,
        tenant_id=customer.tenant_id,
        created_at=order_created_at,
        amount=amount_cents,
    )
    db.add(order)
    db.flush()

    payment = Payment(
        order_id=order.id,
        amount=amount_cents,
        method=method,
        source=source,
        status=status,
        reference=reference,
        transaction_id=transaction_id,
        card_brand=card_brand,
        created_at=payment_created_at,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def test_transactions_endpoint_lists_payments(client: TestClient, db_session: Session):
    _reset_transactions(db_session)
    admin_email = "finance-admin@example.com"
    _ensure_user(db_session, admin_email, "admin")
    token = _make_token(db_session, admin_email)

    now = datetime.utcnow()
    p1 = _create_order_with_payment(
        db_session,
        "customer1@example.com",
        order_created_at=now - timedelta(minutes=10),
        payment_created_at=now,
        amount_cents=4500,
        status="success",
        method="yoco",
        source="yoco",
        reference="REF-LATEST",
        transaction_id="TXN-LATEST",
        card_brand="Visa",
    )
    p2 = _create_order_with_payment(
        db_session,
        "customer2@example.com",
        order_created_at=now - timedelta(hours=2),
        payment_created_at=now - timedelta(hours=1),
        amount_cents=3200,
        status="failed",
        method="yoco",
        source="yoco",
        reference="REF-FAIL",
        transaction_id="TXN-FAIL",
        card_brand="Visa",
    )
    p3 = _create_order_with_payment(
        db_session,
        "customer3@example.com",
        order_created_at=now - timedelta(days=1),
        payment_created_at=now - timedelta(days=1, minutes=5),
        amount_cents=2500,
        status="success",
        method="cash",
        source="pos",
        reference="REF-CASH",
        transaction_id="TXN-CASH",
        card_brand=None,
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/admin/transactions", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["pagination"]["total"] == 3
    assert len(data["items"]) == 3
    assert data["items"][0]["payment"]["reference"] == "REF-LATEST"
    expected_total = (p1.amount or 0) + (p2.amount or 0) + (p3.amount or 0)
    assert data["summary"]["total_amount_cents"] == expected_total
    assert data["summary"]["status_counts"].get("success") == 2
    assert set(data["available_filters"]["statuses"]) >= {"success", "failed"}
    assert set(data["available_filters"]["methods"]) >= {"yoco", "cash"}


def test_transactions_filters(client: TestClient, db_session: Session):
    _reset_transactions(db_session)
    admin_email = "finance-admin2@example.com"
    _ensure_user(db_session, admin_email, "admin")
    token = _make_token(db_session, admin_email)

    now = datetime.utcnow()
    _create_order_with_payment(
        db_session,
        "filter-user@example.com",
        order_created_at=now,
        payment_created_at=now,
        amount_cents=5000,
        status="success",
        method="yoco",
        source="yoco",
        reference="REF-SUCCESS",
        transaction_id="TXN-SUCCESS",
        card_brand="Visa",
    )
    _create_order_with_payment(
        db_session,
        "filter-user@example.com",
        order_created_at=now - timedelta(hours=1),
        payment_created_at=now - timedelta(hours=1),
        amount_cents=1500,
        status="failed",
        method="cash",
        source="pos",
        reference="REF-FAIL-2",
        transaction_id="TXN-FAIL-2",
        card_brand=None,
    )

    headers = {"Authorization": f"Bearer {token}"}

    resp_status = client.get(
        "/api/admin/transactions",
        params={"status": "success"},
        headers=headers,
    )
    assert resp_status.status_code == 200
    body_status = resp_status.json()
    assert body_status["pagination"]["total"] == 1
    assert all(item["payment"]["status"] == "success" for item in body_status["items"])

    resp_search = client.get(
        "/api/admin/transactions",
        params={"search": "REF-FAIL-2"},
        headers=headers,
    )
    assert resp_search.status_code == 200
    body_search = resp_search.json()
    assert body_search["pagination"]["total"] == 1
    assert body_search["items"][0]["payment"]["reference"] == "REF-FAIL-2"

    resp_amount = client.get(
        "/api/admin/transactions",
        params={"min_amount": 4000},
        headers=headers,
    )
    assert resp_amount.status_code == 200
    body_amount = resp_amount.json()
    assert body_amount["pagination"]["total"] == 1
    assert body_amount["items"][0]["payment"]["amount_cents"] >= 4000
