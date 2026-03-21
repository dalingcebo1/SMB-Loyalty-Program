"""Tests for the flowershop Yoco payment endpoint (POST /api/api/flowershop/orders/{id}/pay)."""
import json
import uuid
from datetime import date, datetime
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from config import settings
from app.models import (
    FlowerCategory,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    User,
    Tenant,
)


TENANT_HEADERS = {"X-Tenant-ID": settings.default_tenant}


def _ensure_category(db: Session) -> FlowerCategory:
    cat = db.query(FlowerCategory).filter_by(
        tenant_id=settings.default_tenant, name="Bouquets"
    ).first()
    if not cat:
        cat = FlowerCategory(
            tenant_id=settings.default_tenant,
            name="Bouquets",
            description="Fresh bouquets",
            display_order=0,
            active=True,
            created_at=datetime.utcnow(),
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
    return cat


def _ensure_product(db: Session, category_id: int) -> FlowerProduct:
    prod = db.query(FlowerProduct).filter_by(
        tenant_id=settings.default_tenant, name="Test Rose Bouquet"
    ).first()
    if not prod:
        prod = FlowerProduct(
            tenant_id=settings.default_tenant,
            category_id=category_id,
            name="Test Rose Bouquet",
            price_cents=15000,
            stock_quantity=50,
            track_inventory=True,
            low_stock_threshold=5,
            active=True,
            display_order=0,
            includes_vase=False,
            includes_card=True,
            featured=False,
            seasonal=False,
            available_for_delivery=True,
            available_for_pickup=True,
            created_at=datetime.utcnow(),
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)
    return prod


def _create_flower_order(db: Session, user_id: int, product_id: int, payment_method: str = "card") -> FlowerOrder:
    order = FlowerOrder(
        tenant_id=settings.default_tenant,
        customer_id=user_id,
        order_number=f"FLO-TEST-{uuid.uuid4().hex[:8]}",
        delivery_type="delivery",
        delivery_date=date.today(),
        delivery_time_slot="9AM-12PM",
        recipient_name="Test Recipient",
        recipient_phone="0812345678",
        delivery_address_line1="123 Test St",
        delivery_city="Johannesburg",
        delivery_postal_code="2000",
        subtotal_cents=15000,
        delivery_fee_cents=5000,
        total_cents=20000,
        payment_method=payment_method,
        payment_status="pending",
        status="pending",
        include_sender_name=True,
        discount_cents=0,
        loyalty_points_awarded=0,
        created_at=datetime.utcnow(),
    )
    db.add(order)
    db.flush()

    item = FlowerOrderItem(
        order_id=order.id,
        product_id=product_id,
        product_name="Test Rose Bouquet",
        quantity=1,
        unit_price_cents=15000,
        subtotal_cents=15000,
    )
    db.add(item)
    db.commit()
    db.refresh(order)
    return order


@patch("app.routes.flowershop.http_requests.post")
def test_pay_flower_order_success(mock_post, client: TestClient, db_session: Session):
    """Yoco charge succeeds → order becomes paid + confirmed."""
    user = db_session.query(User).first()
    cat = _ensure_category(db_session)
    prod = _ensure_product(db_session, cat.id)
    order = _create_flower_order(db_session, user.id, prod.id)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "ch_test_123",
        "status": "successful",
        "source": {"brand": "visa"},
    }
    mock_post.return_value = mock_resp

    resp = client.post(
        f"/api/api/flowershop/orders/{order.id}/pay",
        json={"token": "tok_test_abc"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["payment_status"] == "paid"
    assert data["order_number"] == order.order_number
    assert data["message"] == "Payment successful"

    # Verify DB state
    db_session.refresh(order)
    assert order.payment_status == "paid"
    assert order.status == "confirmed"
    assert order.payment_reference == "ch_test_123"


@patch("app.routes.flowershop.http_requests.post")
def test_pay_flower_order_yoco_failure(mock_post, client: TestClient, db_session: Session):
    """Yoco charge fails → order payment_status becomes failed."""
    user = db_session.query(User).first()
    cat = _ensure_category(db_session)
    prod = _ensure_product(db_session, cat.id)
    order = _create_flower_order(db_session, user.id, prod.id)

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.json.return_value = {
        "id": "ch_fail_456",
        "status": "failed",
        "error": {"message": "Card declined"},
    }
    mock_post.return_value = mock_resp

    resp = client.post(
        f"/api/api/flowershop/orders/{order.id}/pay",
        json={"token": "tok_bad"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 400
    assert "Card declined" in resp.json()["detail"]

    db_session.refresh(order)
    assert order.payment_status == "failed"


def test_pay_flower_order_already_paid(client: TestClient, db_session: Session):
    """Attempting to pay an already paid order returns 400."""
    user = db_session.query(User).first()
    cat = _ensure_category(db_session)
    prod = _ensure_product(db_session, cat.id)
    order = _create_flower_order(db_session, user.id, prod.id)
    order.payment_status = "paid"
    db_session.commit()

    resp = client.post(
        f"/api/api/flowershop/orders/{order.id}/pay",
        json={"token": "tok_test"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 400
    assert "already paid" in resp.json()["detail"]


def test_pay_flower_order_non_card(client: TestClient, db_session: Session):
    """Attempting Yoco payment for cash/EFT order returns 400."""
    user = db_session.query(User).first()
    cat = _ensure_category(db_session)
    prod = _ensure_product(db_session, cat.id)
    order = _create_flower_order(db_session, user.id, prod.id, payment_method="cash")

    resp = client.post(
        f"/api/api/flowershop/orders/{order.id}/pay",
        json={"token": "tok_test"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 400
    assert "card" in resp.json()["detail"].lower()


def test_pay_flower_order_not_found(client: TestClient, db_session: Session):
    """Paying a non-existent order returns 404."""
    resp = client.post(
        "/api/api/flowershop/orders/99999/pay",
        json={"token": "tok_test"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 404
