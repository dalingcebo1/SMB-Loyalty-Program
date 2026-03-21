"""Tests for CSV and PDF export endpoints."""

import csv
import io
from datetime import datetime, timedelta, date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Order, Payment, PointBalance, Service, Tenant, User, VisitCount,
)
from app.plugins.auth.routes import create_access_token
from app.services.tenant_settings import get_tenant_settings
from config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
        last_name="Export",
        phone="0820000001",
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


def _seed_transaction(db: Session, user: User, amount_cents: int, status: str = "success") -> Payment:
    service = db.query(Service).first()
    if not service:
        service = Service(name="Export Test Wash", category="wash", base_price=1000, loyalty_eligible=True)
        db.add(service)
        db.flush()
    order = Order(
        service_id=service.id,
        quantity=1,
        extras=[],
        payment_pin="0000",
        status="paid",
        user_id=user.id,
        tenant_id=user.tenant_id,
        created_at=datetime.utcnow(),
        amount=amount_cents,
    )
    db.add(order)
    db.flush()
    payment = Payment(
        order_id=order.id,
        amount=amount_cents,
        method="card",
        source="yoco",
        status=status,
        reference=f"REF-{order.id}",
        transaction_id=f"TXN-{order.id}",
        created_at=datetime.utcnow(),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def _parse_csv(content: str) -> list[dict]:
    """Parse CSV content (with BOM) into list of dicts."""
    text = content.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


# ---------------------------------------------------------------------------
# Transaction export
# ---------------------------------------------------------------------------

def test_transactions_export_csv(client: TestClient, db_session: Session):
    db_session.query(Payment).delete()
    db_session.query(Order).delete()
    db_session.commit()

    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)
    customer = _ensure_user(db_session, "export-cust@example.com", "user")
    _seed_transaction(db_session, customer, 5000, "success")

    response = client.get(
        "/api/admin/transactions/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers.get("content-disposition", "")

    rows = _parse_csv(response.text)
    assert len(rows) >= 1
    assert "Amount (ZAR)" in rows[0]
    assert rows[0]["Amount (ZAR)"] == "50.00"


# ---------------------------------------------------------------------------
# Customer export
# ---------------------------------------------------------------------------

def test_customers_export_csv(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)
    _ensure_user(db_session, "customer-export@example.com", "user")

    response = client.get(
        "/api/customers/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]

    rows = _parse_csv(response.text)
    assert len(rows) >= 1
    assert "Email" in rows[0]


# ---------------------------------------------------------------------------
# Invoice export
# ---------------------------------------------------------------------------

def test_invoices_export_csv(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)

    response = client.get(
        "/api/invoices/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


# ---------------------------------------------------------------------------
# Expense export
# ---------------------------------------------------------------------------

def test_expenses_export_csv(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)

    response = client.get(
        "/api/expenses/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


# ---------------------------------------------------------------------------
# P&L export (CSV and PDF)
# ---------------------------------------------------------------------------

def test_profit_loss_export_csv(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)

    response = client.get(
        "/api/reports/profit-loss/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_profit_loss_export_pdf(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)

    response = client.get(
        "/api/reports/profit-loss/export?format=pdf",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "application/pdf" in response.headers["content-type"]
    assert response.content[:5] == b"%PDF-"


# ---------------------------------------------------------------------------
# Loyalty export
# ---------------------------------------------------------------------------

def test_loyalty_export_csv(client: TestClient, db_session: Session):
    admin = _ensure_user(db_session, "export-admin@example.com", "admin")
    token = _make_token(db_session, admin.email)

    response = client.get(
        "/api/analytics/loyalty/export?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


# ---------------------------------------------------------------------------
# Export service unit tests
# ---------------------------------------------------------------------------

def test_generate_csv_with_bom():
    from app.services.export_service import generate_csv

    rows = [
        {"name": "Alice", "amount": "100.50"},
        {"name": "Bob", "amount": "200.00"},
    ]
    columns = [("name", "Name"), ("amount", "Amount")]
    resp = generate_csv(rows, columns, "test.csv")

    # StreamingResponse wraps an iterable; collect output
    content = b""
    import asyncio
    async def _read():
        result = b""
        async for chunk in resp.body_iterator:
            if isinstance(chunk, bytes):
                result += chunk
            else:
                result += chunk.encode("utf-8")
        return result
    content = asyncio.get_event_loop().run_until_complete(_read()) if asyncio.get_event_loop().is_running() else asyncio.run(_read())
    text = content.decode("utf-8")

    assert text.startswith("\ufeff")
    assert "Name,Amount" in text
    assert "Alice,100.50" in text
    assert "Bob,200.00" in text


def test_generate_csv_handles_none_values():
    from app.services.export_service import generate_csv

    rows = [{"name": "Alice", "amount": None}]
    columns = [("name", "Name"), ("amount", "Amount")]
    resp = generate_csv(rows, columns, "test.csv")

    import asyncio
    async def _read():
        result = b""
        async for chunk in resp.body_iterator:
            if isinstance(chunk, bytes):
                result += chunk
            else:
                result += chunk.encode("utf-8")
        return result
    content = asyncio.run(_read())
    text = content.decode("utf-8")

    assert "Alice," in text


def test_generate_pdf_report_returns_pdf():
    from app.services.export_service import generate_pdf_report

    rows = [{"category": "Revenue", "amount": "1000.00"}]
    columns = [("category", "Category"), ("amount", "Amount")]
    resp = generate_pdf_report(
        title="Test Report",
        subtitle="2026-01-01 to 2026-01-31",
        columns=columns,
        rows=rows,
        totals={"category": "Total", "amount": "1000.00"},
        filename="test.pdf",
        business_name="Test Business",
    )

    import asyncio
    async def _read():
        result = b""
        async for chunk in resp.body_iterator:
            result += chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")
        return result
    content = asyncio.run(_read())

    assert content[:5] == b"%PDF-"
