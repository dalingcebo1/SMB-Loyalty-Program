"""Tests for the flowershop vertical (migrated to app/verticals/flowershop/).

Covers category, occasion, product, order, delivery-slot, and payment endpoints.
The Yoco payment test duplicates the pattern from test_flowershop_pay.py but
validates the new service-layer mock path.
"""
import uuid
from datetime import date, datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from config import settings
from app.models import (
    FlowerCategory,
    FlowerOccasion,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
    User,
)


TENANT_HEADERS = {"X-Tenant-ID": settings.default_tenant}
TENANT_ID = settings.default_tenant


@pytest.fixture(autouse=True)
def _set_admin_role(db_session: Session):
    """Ensure the default test user has admin role for capability checks."""
    user = db_session.query(User).first()
    if user:
        user.role = "admin"
        db_session.commit()


def _ensure_category(db: Session, name: str = "Bouquets") -> FlowerCategory:
    cat = db.query(FlowerCategory).filter_by(
        tenant_id=TENANT_ID, name=name
    ).first()
    if not cat:
        cat = FlowerCategory(
            tenant_id=TENANT_ID,
            name=name,
            description="Fresh bouquets",
            display_order=0,
            active=True,
            created_at=datetime.utcnow(),
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
    return cat


def _ensure_occasion(db: Session, name: str = "Birthday") -> FlowerOccasion:
    occ = db.query(FlowerOccasion).filter_by(
        tenant_id=TENANT_ID, name=name
    ).first()
    if not occ:
        occ = FlowerOccasion(
            tenant_id=TENANT_ID,
            name=name,
            description="Birthday celebrations",
            active=True,
            created_at=datetime.utcnow(),
        )
        db.add(occ)
        db.commit()
        db.refresh(occ)
    return occ


def _ensure_product(db: Session, name: str = "Test Bouquet", category_id: int = None) -> FlowerProduct:
    if category_id is None:
        category_id = _ensure_category(db).id
    prod = db.query(FlowerProduct).filter_by(
        tenant_id=TENANT_ID, name=name
    ).first()
    if not prod:
        prod = FlowerProduct(
            tenant_id=TENANT_ID,
            category_id=category_id,
            name=name,
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


def _create_order(db: Session, user_id: int, product_id: int, payment_method: str = "card") -> FlowerOrder:
    order = FlowerOrder(
        tenant_id=TENANT_ID,
        customer_id=user_id,
        order_number=f"FLO-TEST-{uuid.uuid4().hex[:8]}",
        delivery_type="delivery",
        delivery_date=date.today() + timedelta(days=1),
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
        product_name="Test Bouquet",
        quantity=1,
        unit_price_cents=15000,
        subtotal_cents=15000,
    )
    db.add(item)
    db.commit()
    db.refresh(order)
    return order


# ── Category CRUD ───────────────────────────────────────────────────────────

def test_create_category(client: TestClient, db_session: Session):
    """POST /api/api/flowershop/categories creates a category."""
    name = f"Cat-{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/api/flowershop/categories",
        json={"name": name, "description": "Test category"},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == name


def test_list_categories(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/categories returns categories."""
    _ensure_category(db_session)
    resp = client.get("/api/api/flowershop/categories", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_get_category(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/categories/{id} returns specific category."""
    cat = _ensure_category(db_session)
    resp = client.get(f"/api/api/flowershop/categories/{cat.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == cat.id


def test_update_category(client: TestClient, db_session: Session):
    """PUT /api/api/flowershop/categories/{id} updates the category."""
    cat = _ensure_category(db_session, f"Upd-{uuid.uuid4().hex[:4]}")
    resp = client.put(
        f"/api/api/flowershop/categories/{cat.id}",
        json={"description": "Updated desc"},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated desc"


def test_delete_category_no_products(client: TestClient, db_session: Session):
    """DELETE /api/api/flowershop/categories/{id} soft-deletes empty category."""
    cat = FlowerCategory(
        tenant_id=TENANT_ID,
        name=f"DelCat-{uuid.uuid4().hex[:6]}",
        display_order=0,
        active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)

    resp = client.delete(
        f"/api/api/flowershop/categories/{cat.id}",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 204

    db_session.refresh(cat)
    assert cat.active is False


def test_delete_category_with_products_fails(client: TestClient, db_session: Session):
    """DELETE /api/api/flowershop/categories/{id} with products returns 400."""
    cat = _ensure_category(db_session, f"HasProd-{uuid.uuid4().hex[:4]}")
    _ensure_product(db_session, f"Prod-{uuid.uuid4().hex[:4]}", cat.id)

    resp = client.delete(
        f"/api/api/flowershop/categories/{cat.id}",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 400
    assert "products" in resp.json()["detail"].lower()


# ── Occasion ────────────────────────────────────────────────────────────────

def test_create_occasion(client: TestClient, db_session: Session):
    """POST /api/api/flowershop/occasions creates an occasion."""
    name = f"Occ-{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/api/flowershop/occasions",
        json={"name": name},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == name


def test_list_occasions(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/occasions returns list."""
    _ensure_occasion(db_session)
    resp = client.get("/api/api/flowershop/occasions", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Product CRUD ────────────────────────────────────────────────────────────

def test_create_product(client: TestClient, db_session: Session):
    """POST /api/api/flowershop/products creates a product."""
    cat = _ensure_category(db_session, f"PrdCat-{uuid.uuid4().hex[:4]}")
    resp = client.post(
        "/api/api/flowershop/products",
        json={
            "category_id": cat.id,
            "name": f"Rose-{uuid.uuid4().hex[:4]}",
            "price_cents": 25000,
            "stock_quantity": 30,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["price_cents"] == 25000
    assert data["stock_quantity"] == 30


def test_list_products(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/products returns list."""
    _ensure_product(db_session)
    resp = client.get("/api/api/flowershop/products", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_product(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/products/{id} returns product."""
    prod = _ensure_product(db_session)
    resp = client.get(f"/api/api/flowershop/products/{prod.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == prod.id


def test_update_product(client: TestClient, db_session: Session):
    """PUT /api/api/flowershop/products/{id} updates product."""
    prod = _ensure_product(db_session, f"UpdProd-{uuid.uuid4().hex[:4]}")
    resp = client.put(
        f"/api/api/flowershop/products/{prod.id}",
        json={"price_cents": 30000},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["price_cents"] == 30000


def test_delete_product(client: TestClient, db_session: Session):
    """DELETE /api/api/flowershop/products/{id} soft-deletes."""
    prod = _ensure_product(db_session, f"DelProd-{uuid.uuid4().hex[:4]}")
    resp = client.delete(
        f"/api/api/flowershop/products/{prod.id}",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 204

    db_session.refresh(prod)
    assert prod.active is False


# ── Orders ──────────────────────────────────────────────────────────────────

def test_create_order(client: TestClient, db_session: Session):
    """POST /api/api/flowershop/orders creates an order."""
    cat = _ensure_category(db_session, f"OrdCat-{uuid.uuid4().hex[:4]}")
    prod = _ensure_product(db_session, f"OrdProd-{uuid.uuid4().hex[:4]}", cat.id)
    user = db_session.query(User).first()
    delivery_date = (date.today() + timedelta(days=1)).isoformat()

    resp = client.post(
        "/api/api/flowershop/orders",
        json={
            "customer_id": user.id,
            "delivery_type": "delivery",
            "delivery_date": delivery_date,
            "recipient_name": "John Doe",
            "delivery_address_line1": "1 Main St",
            "delivery_city": "Cape Town",
            "delivery_postal_code": "8001",
            "payment_method": "card",
            "items": [{"product_id": prod.id, "quantity": 1}],
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["total_cents"] > 0
    assert len(data["items"]) == 1


def test_list_orders(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/orders returns list."""
    resp = client.get("/api/api/flowershop/orders", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_order(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/orders/{id} returns order with items."""
    user = db_session.query(User).first()
    prod = _ensure_product(db_session, f"GOrd-{uuid.uuid4().hex[:4]}")
    order = _create_order(db_session, user.id, prod.id)

    resp = client.get(
        f"/api/api/flowershop/orders/{order.id}",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == order.id
    assert "items" in data
    assert len(data["items"]) >= 1


def test_update_order_status(client: TestClient, db_session: Session):
    """PUT /api/api/flowershop/orders/{id} updates status."""
    user = db_session.query(User).first()
    prod = _ensure_product(db_session, f"UOrd-{uuid.uuid4().hex[:4]}")
    order = _create_order(db_session, user.id, prod.id)

    resp = client.put(
        f"/api/api/flowershop/orders/{order.id}",
        json={"status": "confirmed"},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


# ── Delivery Slots ──────────────────────────────────────────────────────────

def test_create_delivery_slot(client: TestClient, db_session: Session):
    """POST /api/api/flowershop/delivery-slots creates a slot."""
    slot_date = (date.today() + timedelta(days=7)).isoformat()
    resp = client.post(
        "/api/api/flowershop/delivery-slots",
        json={
            "delivery_date": slot_date,
            "time_slot": f"9AM-12PM-{uuid.uuid4().hex[:4]}",
            "max_deliveries": 10,
            "fee_cents": 5000,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["max_deliveries"] == 10
    assert data["fee_cents"] == 5000


def test_list_delivery_slots(client: TestClient, db_session: Session):
    """GET /api/api/flowershop/delivery-slots returns slots."""
    resp = client.get("/api/api/flowershop/delivery-slots", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── Payment (Yoco) ─────────────────────────────────────────────────────────

@patch("app.verticals.flowershop.services.http_requests.post")
def test_payment_via_new_service_layer(mock_post, client: TestClient, db_session: Session):
    """Yoco charge via the new PaymentService succeeds."""
    user = db_session.query(User).first()
    prod = _ensure_product(db_session, f"PayProd-{uuid.uuid4().hex[:4]}")
    order = _create_order(db_session, user.id, prod.id)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "ch_test_svc",
        "status": "successful",
        "source": {"brand": "visa"},
    }
    mock_post.return_value = mock_resp

    resp = client.post(
        f"/api/api/flowershop/orders/{order.id}/pay",
        json={"token": "tok_svc_test"},
        headers=TENANT_HEADERS,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["payment_status"] == "paid"
    assert data["message"] == "Payment successful"

    db_session.refresh(order)
    assert order.payment_status == "paid"
    assert order.status == "confirmed"
