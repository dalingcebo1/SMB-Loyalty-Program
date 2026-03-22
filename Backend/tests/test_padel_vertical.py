"""Tests for the padel vertical (migrated to app/verticals/padel/)."""
import uuid
from datetime import date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from config import settings
from app.models import (
    PadelCourt,
    CourtPricing,
    PadelEquipment,
    CourtBooking,
    BookingEquipment,
    User,
)


TENANT_HEADERS = {"X-Tenant-ID": settings.default_tenant}
TENANT_ID = settings.default_tenant


def _ensure_court(db: Session, court_number: str = "Court 1") -> PadelCourt:
    court = db.query(PadelCourt).filter_by(
        tenant_id=TENANT_ID, court_number=court_number
    ).first()
    if not court:
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=court_number,
            court_type="standard",
            surface_type="synthetic_grass",
            has_lighting=True,
            base_price_cents=15000,
            active=True,
            maintenance_mode=False,
        )
        db.add(court)
        db.commit()
        db.refresh(court)
    return court


def _ensure_equipment(db: Session, name: str = "Padel Racket") -> PadelEquipment:
    eq = db.query(PadelEquipment).filter_by(
        tenant_id=TENANT_ID, name=name
    ).first()
    if not eq:
        eq = PadelEquipment(
            tenant_id=TENANT_ID,
            name=name,
            equipment_type="racket",
            description="Standard padel racket",
            quantity_available=10,
            rental_price_cents=5000,
            active=True,
        )
        db.add(eq)
        db.commit()
        db.refresh(eq)
    return eq


# ── Court CRUD ──────────────────────────────────────────────────────────────

def test_create_court(client: TestClient, db_session: Session):
    """POST /api/padel/courts creates a court and returns 201."""
    court_num = f"CT-{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/padel/courts",
        json={
            "court_number": court_num,
            "court_type": "standard",
            "surface_type": "synthetic_grass",
            "has_lighting": True,
            "base_price_cents": 12000,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["court_number"] == court_num
    assert data["base_price_cents"] == 12000
    assert data["active"] is True


def test_list_courts(client: TestClient, db_session: Session):
    """GET /api/padel/courts returns courts list."""
    _ensure_court(db_session)
    resp = client.get("/api/padel/courts", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_court(client: TestClient, db_session: Session):
    """GET /api/padel/courts/{id} returns a specific court."""
    court = _ensure_court(db_session)
    resp = client.get(f"/api/padel/courts/{court.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == court.id


def test_get_court_not_found(client: TestClient, db_session: Session):
    """GET /api/padel/courts/99999 returns 404."""
    resp = client.get("/api/padel/courts/99999", headers=TENANT_HEADERS)
    assert resp.status_code == 404


def test_update_court(client: TestClient, db_session: Session):
    """PUT /api/padel/courts/{id} updates court fields."""
    court = _ensure_court(db_session)
    resp = client.put(
        f"/api/padel/courts/{court.id}",
        json={"has_lighting": False},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["has_lighting"] is False


def test_delete_court(client: TestClient, db_session: Session):
    """DELETE /api/padel/courts/{id} soft-deletes the court."""
    court_num = f"DEL-{uuid.uuid4().hex[:6]}"
    court = PadelCourt(
        tenant_id=TENANT_ID,
        court_number=court_num,
        base_price_cents=10000,
        active=True,
        maintenance_mode=False,
    )
    db_session.add(court)
    db_session.commit()
    db_session.refresh(court)

    resp = client.delete(f"/api/padel/courts/{court.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 204

    db_session.refresh(court)
    assert court.active is False


def test_create_duplicate_court(client: TestClient, db_session: Session):
    """POST /api/padel/courts with duplicate number returns 400."""
    court = _ensure_court(db_session, "DUP-Court")
    resp = client.post(
        "/api/padel/courts",
        json={
            "court_number": "DUP-Court",
            "base_price_cents": 10000,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


# ── Pricing Rules ───────────────────────────────────────────────────────────

def test_create_pricing_rule(client: TestClient, db_session: Session):
    """POST /api/padel/courts/{id}/pricing creates a pricing rule."""
    court = _ensure_court(db_session)
    resp = client.post(
        f"/api/padel/courts/{court.id}/pricing",
        json={
            "day_of_week": 0,
            "start_time": "08:00:00",
            "end_time": "12:00:00",
            "price_per_hour_cents": 20000,
            "label": "Morning Peak",
            "priority": 1,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "Morning Peak"
    assert data["court_id"] == court.id


def test_list_pricing_rules(client: TestClient, db_session: Session):
    """GET /api/padel/courts/{id}/pricing returns pricing rules."""
    court = _ensure_court(db_session)
    resp = client.get(
        f"/api/padel/courts/{court.id}/pricing",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_delete_pricing_rule(client: TestClient, db_session: Session):
    """DELETE /api/padel/courts/{id}/pricing/{pid} soft-deletes pricing."""
    court = _ensure_court(db_session)
    rule = CourtPricing(
        court_id=court.id,
        day_of_week=5,
        start_time=time(14, 0),
        end_time=time(18, 0),
        price_per_hour_cents=25000,
        label="Weekend",
        priority=2,
        active=True,
    )
    db_session.add(rule)
    db_session.commit()
    db_session.refresh(rule)

    resp = client.delete(
        f"/api/padel/courts/{court.id}/pricing/{rule.id}",
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 204

    db_session.refresh(rule)
    assert rule.active is False


# ── Equipment CRUD ──────────────────────────────────────────────────────────

def test_create_equipment(client: TestClient, db_session: Session):
    """POST /api/padel/equipment creates equipment."""
    name = f"Racket-{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/padel/equipment",
        json={
            "name": name,
            "equipment_type": "racket",
            "quantity_available": 5,
            "rental_price_cents": 5000,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == name


def test_list_equipment(client: TestClient, db_session: Session):
    """GET /api/padel/equipment returns list."""
    _ensure_equipment(db_session)
    resp = client.get("/api/padel/equipment", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_get_equipment(client: TestClient, db_session: Session):
    """GET /api/padel/equipment/{id} returns specific equipment."""
    eq = _ensure_equipment(db_session)
    resp = client.get(f"/api/padel/equipment/{eq.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["id"] == eq.id


def test_update_equipment(client: TestClient, db_session: Session):
    """PUT /api/padel/equipment/{id} updates equipment."""
    eq = _ensure_equipment(db_session)
    resp = client.put(
        f"/api/padel/equipment/{eq.id}",
        json={"rental_price_cents": 7000},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["rental_price_cents"] == 7000


def test_delete_equipment(client: TestClient, db_session: Session):
    """DELETE /api/padel/equipment/{id} soft-deletes."""
    eq = PadelEquipment(
        tenant_id=TENANT_ID,
        name=f"DEL-{uuid.uuid4().hex[:6]}",
        equipment_type="balls",
        quantity_available=20,
        rental_price_cents=2000,
        active=True,
    )
    db_session.add(eq)
    db_session.commit()
    db_session.refresh(eq)

    resp = client.delete(f"/api/padel/equipment/{eq.id}", headers=TENANT_HEADERS)
    assert resp.status_code == 204

    db_session.refresh(eq)
    assert eq.active is False


# ── Bookings ────────────────────────────────────────────────────────────────

def test_create_booking(client: TestClient, db_session: Session):
    """POST /api/padel/bookings creates a booking."""
    court = _ensure_court(db_session, f"BK-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()

    booking_date = (date.today() + timedelta(days=1)).isoformat()
    resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "10:00:00",
            "duration_minutes": 60,
            "player_count": 2,
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["court_id"] == court.id
    assert data["status"] == "pending"
    assert data["total_price_cents"] > 0


def test_create_booking_conflict(client: TestClient, db_session: Session):
    """POST /api/padel/bookings returns 409 for overlapping slot."""
    court = _ensure_court(db_session, f"CF-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=2)).isoformat()

    # First booking
    resp1 = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "14:00:00",
            "duration_minutes": 90,
        },
        headers=TENANT_HEADERS,
    )
    assert resp1.status_code == 201

    # Overlapping booking
    resp2 = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "14:30:00",
            "duration_minutes": 60,
        },
        headers=TENANT_HEADERS,
    )
    assert resp2.status_code == 409


def test_list_bookings(client: TestClient, db_session: Session):
    """GET /api/padel/bookings returns list."""
    resp = client.get("/api/padel/bookings", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_booking(client: TestClient, db_session: Session):
    """GET /api/padel/bookings/{id} returns booking details."""
    court = _ensure_court(db_session, f"GB-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=3)).isoformat()

    create_resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "09:00:00",
            "duration_minutes": 60,
        },
        headers=TENANT_HEADERS,
    )
    booking_id = create_resp.json()["id"]

    resp = client.get(f"/api/padel/bookings/{booking_id}", headers=TENANT_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == booking_id
    assert "court_number" in data
    assert "equipment_rentals" in data


def test_update_booking_status(client: TestClient, db_session: Session):
    """PUT /api/padel/bookings/{id} updates status."""
    court = _ensure_court(db_session, f"UB-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=4)).isoformat()

    create_resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "11:00:00",
            "duration_minutes": 90,
        },
        headers=TENANT_HEADERS,
    )
    booking_id = create_resp.json()["id"]

    resp = client.put(
        f"/api/padel/bookings/{booking_id}",
        json={"status": "confirmed"},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


def test_cancel_booking(client: TestClient, db_session: Session):
    """DELETE /api/padel/bookings/{id} cancels the booking."""
    court = _ensure_court(db_session, f"CB-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=5)).isoformat()

    create_resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "16:00:00",
            "duration_minutes": 60,
        },
        headers=TENANT_HEADERS,
    )
    booking_id = create_resp.json()["id"]

    resp = client.delete(f"/api/padel/bookings/{booking_id}", headers=TENANT_HEADERS)
    assert resp.status_code == 204

    # Verify status is cancelled
    db_session.expire_all()
    booking = db_session.query(CourtBooking).filter_by(id=booking_id).first()
    assert booking.status == "cancelled"


# ── Availability ────────────────────────────────────────────────────────────

def test_check_availability(client: TestClient, db_session: Session):
    """POST /api/padel/availability returns available slots."""
    _ensure_court(db_session, f"AV-{uuid.uuid4().hex[:4]}")
    query_date = (date.today() + timedelta(days=10)).isoformat()

    resp = client.post(
        "/api/padel/availability",
        json={"date": query_date, "duration_minutes": 60},
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "court_id" in data[0]
        assert "start_time" in data[0]
        assert "price_cents" in data[0]


# ── Booking with Equipment ──────────────────────────────────────────────────

def test_create_booking_with_equipment(client: TestClient, db_session: Session):
    """POST /api/padel/bookings with equipment rentals."""
    court = _ensure_court(db_session, f"EQ-{uuid.uuid4().hex[:4]}")
    eq = _ensure_equipment(db_session, f"EQ-Racket-{uuid.uuid4().hex[:4]}")
    user = db_session.query(User).first()
    booking_date = (date.today() + timedelta(days=6)).isoformat()

    resp = client.post(
        "/api/padel/bookings",
        json={
            "customer_id": user.id,
            "court_id": court.id,
            "booking_date": booking_date,
            "start_time": "10:00:00",
            "duration_minutes": 60,
            "equipment_rentals": [
                {"equipment_id": eq.id, "quantity": 2}
            ],
        },
        headers=TENANT_HEADERS,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["equipment_price_cents"] > 0
    assert data["total_price_cents"] > data["court_price_cents"]
    assert len(data["equipment_rentals"]) == 1
