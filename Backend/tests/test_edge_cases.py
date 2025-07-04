import json
import hmac
import hashlib
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import pytest

from config import settings
from app.models import User, Service, Extra, VisitCount, Reward

@pytest.mark.usefixtures("db_session")
def test_auth_signup_existing(client: TestClient):
    # First signup
    resp1 = client.post("/api/auth/signup", json={"email": "dup@example.com", "password": "pass"})
    assert resp1.status_code == 201
    # Duplicate signup
    resp2 = client.post("/api/auth/signup", json={"email": "dup@example.com", "password": "pass"})
    assert resp2.status_code == 400
    assert resp2.json()["detail"] == "Email already registered"

@pytest.mark.usefixtures("db_session")
def test_users_vehicle_edge_cases(client: TestClient):
    # Nonexistent user
    resp = client.post("/api/users/users/999/vehicles", json={"plate": "X", "make": "M", "model": "D"})
    # Vehicle creation should still create record since FK not enforced in SQLite
    assert resp.status_code == 201
    vid = resp.json()["id"]
    # Delete non-existing vehicle
    resp2 = client.delete("/api/users/users/999/vehicles/0")
    assert resp2.status_code == 404
    assert resp2.json()["detail"] == "Vehicle not found"

@pytest.mark.usefixtures("db_session")
def test_catalog_empty(client: TestClient):
    # If no data seeded, should return empty structures
    resp1 = client.get("/api/catalog/services")
    assert resp1.status_code == 200
    assert resp1.json() == {}
    resp2 = client.get("/api/catalog/extras")
    assert resp2.status_code == 200
    assert resp2.json() == []

@pytest.mark.usefixtures("db_session")
def test_loyalty_no_reward(client: TestClient, db_session: Session):
    # Seed visit but no Reward defined
    user = db_session.query(User).first()
    vc = VisitCount(
        tenant_id=settings.default_tenant,
        user_id=user.id,
        count=3,
        updated_at=datetime.utcnow()
    )
    db_session.add(vc)
    db_session.commit()
    resp = client.get("/api/loyalty/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visits"] == 3
    assert data["rewards_ready"] == []
    assert data["upcoming_rewards"] == []

@pytest.mark.usefixtures("db_session")
def test_verify_loyalty_invalid(client: TestClient):
    # Invalid QR token
    invalid_jwt = "ey.invalid.token"
    resp = client.get("/api/payments/verify-loyalty", params={"qr": invalid_jwt})
    assert resp.status_code == 404 or resp.status_code == 401
    # Invalid PIN
    resp2 = client.get("/api/payments/verify-loyalty", params={"pin": "BADPIN"})
    assert resp2.status_code == 404
