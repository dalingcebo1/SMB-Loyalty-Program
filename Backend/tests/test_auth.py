import pytest
from fastapi.testclient import TestClient
from app.models import User
from app.plugins.auth.routes import get_password_hash
from sqlalchemy.orm import Session
from config import settings

def test_signup_and_login_flow(client: TestClient, db_session: Session):
    email = "alice@example.com"
    password = "securepassword"
    # Signup
    resp = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert resp.status_code == 201
    assert resp.json()["message"] == "Signup successful. Please complete onboarding to verify your phone."

    # Login before onboarding should succeed but indicate onboarding required
    resp = client.post("/api/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert data["onboarding_required"] == True
    assert data["next_step"] == "PROFILE_INFO"
    assert "access_token" in data

    # Confirm OTP to complete onboarding and get token
    otp_payload = {
        "session_id": "test_session_1234567890",  # Valid 10+ char session ID
        "code": "123456",  # Valid 6-digit code
        "first_name": "Alice",
        "last_name": "Smith",
        # Use proper phone format with country code
        "phone": "+27821234567",
        "email": email,
        "tenant_id": settings.default_tenant
    }
    resp = client.post("/api/auth/confirm-otp", json=otp_payload)
    assert resp.status_code == 200
    token = resp.json().get("access_token")
    assert token is not None

    # Login after onboarding should succeed
    resp = client.post("/api/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["access_token"] != ""

    # Ensure user record updated in DB
    user = db_session.query(User).filter_by(email=email).first()
    assert user is not None
    assert user.onboarded is True
    assert user.first_name == "Alice"
    assert user.last_name == "Smith"


def test_invalid_login(client: TestClient):
    # Unknown credentials
    resp = client.post("/api/auth/login", data={"username": "noone@example.com", "password": "nopass"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


def test_long_password_is_rejected_cleanly(client: TestClient, db_session: Session):
    email = "longpass@example.com"
    user = User(
        email=email,
        hashed_password=get_password_hash("short-pass"),
        onboarded=True,
        first_name="Long",
        last_name="Pass",
        phone="0800000000",
        tenant_id=settings.default_tenant,
        role="user",
    )
    db_session.add(user)
    db_session.commit()

    resp = client.post(
        "/api/auth/login",
        data={
            "username": email,
            "password": "p" * 120,
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"
