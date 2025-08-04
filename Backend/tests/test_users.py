import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.models import User, Vehicle
from config import settings


def create_test_user(db: Session) -> User:
    # Reuse existing test user seeded in initialize_db
    existing = db.query(User).filter_by(phone="0812345678").first()
    if existing:
        return existing
    user = User(
        email="testuser@example.com",
        hashed_password=None,
        onboarded=True,
        first_name="Test",
        last_name="User",
        phone="0812345678",
        tenant_id=settings.default_tenant,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    from sqlalchemy.exc import IntegrityError
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(User).filter_by(phone="0812345678").first()
    db.refresh(user)
    return user


def test_vehicle_crud(client: TestClient, db_session: Session):
    # Create a test user
    user = create_test_user(db_session)
    user_id = user.id

    # Add vehicle
    vehicle_data = {"plate": "ABC123", "make": "Ford", "model": "Fiesta"}
    resp = client.post(f"/api/users/{user_id}/vehicles", json=vehicle_data)
    assert resp.status_code == 201
    created = resp.json()
    assert created["plate"] == vehicle_data["plate"]
    assert created["make"] == vehicle_data["make"]
    assert created["model"] == vehicle_data["model"]
    vid = created["id"]

    # Get vehicles
    resp = client.get(f"/api/users/{user_id}/vehicles")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list) and len(items) == 1
    assert items[0]["id"] == vid

    # Update vehicle
    update_data = {"plate": "XYZ789", "make": "Toyota", "model": "Corolla"}
    resp = client.patch(f"/api/users/{user_id}/vehicles/{vid}", json=update_data)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Vehicle updated"
    # Verify update in DB
    v = db_session.query(Vehicle).get(vid)
    assert v.plate == update_data["plate"]
    assert v.make == update_data["make"]
    assert v.model == update_data["model"]

    # Delete vehicle
    resp = client.delete(f"/api/users/{user_id}/vehicles/{vid}")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Vehicle deleted"
    # Verify deletion
    v = db_session.query(Vehicle).get(vid)
    assert v is None


def test_search_users(client: TestClient, db_session: Session):
    # Create multiple users
    u1 = User(
        email="alice@example.com",
        hashed_password=None,
        onboarded=True,
        first_name="Alice",
        last_name="Smith",
        phone="0811111111",
        tenant_id=settings.default_tenant,
        created_at=datetime.utcnow(),
    )
    u2 = User(
        email="bob@example.com",
        hashed_password=None,
        onboarded=True,
        first_name="Bob",
        last_name="Jones",
        phone="0812222222",
        tenant_id=settings.default_tenant,
        created_at=datetime.utcnow(),
    )
    db_session.add_all([u1, u2])
    db_session.commit()

    # Search by first name
    resp = client.get("/api/users/search", params={"query": "Alice"})
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["email"] == u1.email

    # Search by phone (with 0 prefix)
    resp = client.get("/api/users/search", params={"query": "0812222222"})
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["email"] == u2.email
