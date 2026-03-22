"""Tenant isolation tests for padel and flowershop verticals.

Verifies that data created by one tenant is invisible to another tenant,
confirming the tenant_id scoping in all service-layer queries.
"""
import uuid
from datetime import date, datetime, timedelta, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from config import settings
from app.models import (
    PadelCourt,
    PadelEquipment,
    CourtBooking,
    FlowerCategory,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
    Tenant,
    User,
)


TENANT_A = settings.default_tenant
TENANT_B = "tenant-isolation-test"


@pytest.fixture(autouse=True)
def _ensure_tenants(db_session: Session):
    """Create a second tenant and a user for isolation tests."""
    # Ensure Tenant B exists
    tenant_b = db_session.query(Tenant).filter_by(id=TENANT_B).first()
    if not tenant_b:
        tenant_b = Tenant(
            id=TENANT_B,
            name="Isolation Test Tenant",
            vertical_type="padel",
            loyalty_type="visits",
            created_at=datetime.utcnow(),
        )
        db_session.add(tenant_b)
        db_session.commit()

    # Set user to admin for capability checks
    user = db_session.query(User).first()
    if user:
        user.role = "admin"
        db_session.commit()


# ── Padel Tenant Isolation ──────────────────────────────────────────────────

def test_padel_courts_tenant_isolated(client: TestClient, db_session: Session):
    """Courts created by Tenant A are invisible to Tenant B."""
    # Create court under Tenant A
    court_name = f"ISO-{uuid.uuid4().hex[:6]}"
    resp_a = client.post(
        "/api/padel/courts",
        json={"court_number": court_name, "base_price_cents": 10000},
        headers={"X-Tenant-ID": TENANT_A},
    )
    assert resp_a.status_code == 201
    court_id = resp_a.json()["id"]

    # Tenant A can see it
    resp_list_a = client.get("/api/padel/courts", headers={"X-Tenant-ID": TENANT_A})
    assert resp_list_a.status_code == 200
    court_ids_a = [c["id"] for c in resp_list_a.json()]
    assert court_id in court_ids_a

    # Tenant B cannot see it
    resp_list_b = client.get("/api/padel/courts", headers={"X-Tenant-ID": TENANT_B})
    assert resp_list_b.status_code == 200
    court_ids_b = [c["id"] for c in resp_list_b.json()]
    assert court_id not in court_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/padel/courts/{court_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404


def test_padel_equipment_tenant_isolated(client: TestClient, db_session: Session):
    """Equipment created by Tenant A is invisible to Tenant B."""
    eq_name = f"ISO-EQ-{uuid.uuid4().hex[:6]}"
    resp_a = client.post(
        "/api/padel/equipment",
        json={"name": eq_name, "equipment_type": "racket", "quantity_available": 5, "rental_price_cents": 3000},
        headers={"X-Tenant-ID": TENANT_A},
    )
    assert resp_a.status_code == 201
    eq_id = resp_a.json()["id"]

    # Tenant B cannot see it
    resp_list_b = client.get("/api/padel/equipment", headers={"X-Tenant-ID": TENANT_B})
    eq_ids_b = [e["id"] for e in resp_list_b.json()]
    assert eq_id not in eq_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/padel/equipment/{eq_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404


def test_padel_bookings_tenant_isolated(client: TestClient, db_session: Session):
    """Bookings from Tenant A are invisible to Tenant B."""
    # Create court + booking under Tenant A
    court_name = f"ISO-BK-{uuid.uuid4().hex[:6]}"
    court_resp = client.post(
        "/api/padel/courts",
        json={"court_number": court_name, "base_price_cents": 10000},
        headers={"X-Tenant-ID": TENANT_A},
    )
    court_id = court_resp.json()["id"]
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=20)).isoformat()

    bk_resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court_id,
            "booking_date": booking_date,
            "start_time": "10:00:00",
            "duration_minutes": 60,
        },
        headers={"X-Tenant-ID": TENANT_A},
    )
    assert bk_resp.status_code == 201
    booking_id = bk_resp.json()["id"]

    # Tenant B cannot list it
    resp_list_b = client.get("/api/padel/bookings", headers={"X-Tenant-ID": TENANT_B})
    bk_ids_b = [b["id"] for b in resp_list_b.json()]
    assert booking_id not in bk_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/padel/bookings/{booking_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404


# ── Flowershop Tenant Isolation ─────────────────────────────────────────────

def test_flowershop_categories_tenant_isolated(client: TestClient, db_session: Session):
    """Categories created by Tenant A are invisible to Tenant B."""
    cat_name = f"ISO-CAT-{uuid.uuid4().hex[:6]}"
    resp_a = client.post(
        "/api/api/flowershop/categories",
        json={"name": cat_name},
        headers={"X-Tenant-ID": TENANT_A},
    )
    assert resp_a.status_code == 201
    cat_id = resp_a.json()["id"]

    # Tenant B cannot see it
    resp_list_b = client.get(
        "/api/api/flowershop/categories",
        headers={"X-Tenant-ID": TENANT_B},
    )
    cat_ids_b = [c["id"] for c in resp_list_b.json()]
    assert cat_id not in cat_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/api/flowershop/categories/{cat_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404


def test_flowershop_products_tenant_isolated(client: TestClient, db_session: Session):
    """Products created by Tenant A are invisible to Tenant B."""
    # Create category first
    cat_resp = client.post(
        "/api/api/flowershop/categories",
        json={"name": f"ISO-PCAT-{uuid.uuid4().hex[:6]}"},
        headers={"X-Tenant-ID": TENANT_A},
    )
    cat_id = cat_resp.json()["id"]

    prod_resp = client.post(
        "/api/api/flowershop/products",
        json={
            "category_id": cat_id,
            "name": f"ISO-PROD-{uuid.uuid4().hex[:6]}",
            "price_cents": 10000,
        },
        headers={"X-Tenant-ID": TENANT_A},
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    # Tenant B cannot see it
    resp_list_b = client.get(
        "/api/api/flowershop/products",
        headers={"X-Tenant-ID": TENANT_B},
    )
    prod_ids_b = [p["id"] for p in resp_list_b.json()]
    assert prod_id not in prod_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/api/flowershop/products/{prod_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404


def test_flowershop_orders_tenant_isolated(client: TestClient, db_session: Session):
    """Orders created by Tenant A are invisible to Tenant B."""
    user = db_session.query(User).first()

    # Seed a product/order directly in DB for Tenant A
    cat = FlowerCategory(
        tenant_id=TENANT_A,
        name=f"ISO-OCAT-{uuid.uuid4().hex[:6]}",
        display_order=0,
        active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(cat)
    db_session.flush()

    prod = FlowerProduct(
        tenant_id=TENANT_A,
        category_id=cat.id,
        name=f"ISO-OPROD-{uuid.uuid4().hex[:6]}",
        price_cents=10000,
        stock_quantity=100,
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
    db_session.add(prod)
    db_session.flush()

    order = FlowerOrder(
        tenant_id=TENANT_A,
        customer_id=user.id,
        order_number=f"FLO-ISO-{uuid.uuid4().hex[:6]}",
        delivery_type="pickup",
        delivery_date=date.today() + timedelta(days=1),
        recipient_name="Test",
        subtotal_cents=10000,
        delivery_fee_cents=0,
        total_cents=10000,
        payment_method="cash",
        payment_status="pending",
        status="pending",
        include_sender_name=True,
        discount_cents=0,
        loyalty_points_awarded=0,
        created_at=datetime.utcnow(),
    )
    db_session.add(order)
    db_session.flush()
    item = FlowerOrderItem(
        order_id=order.id,
        product_id=prod.id,
        product_name=prod.name,
        quantity=1,
        unit_price_cents=10000,
        subtotal_cents=10000,
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(order)

    order_id = order.id

    # Tenant B cannot list it
    resp_list_b = client.get(
        "/api/api/flowershop/orders",
        headers={"X-Tenant-ID": TENANT_B},
    )
    order_ids_b = [o["id"] for o in resp_list_b.json()]
    assert order_id not in order_ids_b

    # Tenant B cannot get it directly
    resp_get_b = client.get(
        f"/api/api/flowershop/orders/{order_id}",
        headers={"X-Tenant-ID": TENANT_B},
    )
    assert resp_get_b.status_code == 404
