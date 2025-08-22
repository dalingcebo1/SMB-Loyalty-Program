import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.plugins.auth.routes import require_admin, get_current_user
from app.models import User, Tenant, InviteToken
from config import settings
from datetime import datetime

@ pytest.fixture(autouse=True)
def admin_override(client, db_session):
    # create or get admin user
    admin = db_session.query(User).first()
    if not admin:
        admin = User(
            email="admin@example.com",
            hashed_password=None,
            onboarded=True,
            first_name="Admin",
            last_name="User",
            phone="0812345678",
            tenant_id=settings.default_tenant,
            created_at=datetime.utcnow(),
            role="admin"
        )
        db_session.add(admin)
        db_session.commit()
    else:
        admin.role = "admin"
        db_session.commit()
    # override dependencies
    app.dependency_overrides[require_admin] = lambda: admin
    app.dependency_overrides[get_current_user] = lambda: admin
    return client


def test_tenant_provision_and_invite(admin_override, db_session):
    tenant_payload = {"id": "testtenant", "name": "Test Tenant", "loyalty_type": "standard"}
    # create tenant
    resp = admin_override.post("/api/tenants/", json=tenant_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "testtenant"

    # invite an admin
    invite_email = "user@client.com"
    resp2 = admin_override.post(f"/api/tenants/{tenant_payload['id']}/invite", json={"email": invite_email})
    assert resp2.status_code == 200
    invite_data = resp2.json()
    token = invite_data["token"]
    assert token

    # validate invite
    resp3 = admin_override.get(f"/api/auth/validate-invite?token={token}")
    assert resp3.status_code == 200
    assert resp3.json()["tenant_id"] == "testtenant"

    # complete invite
    complete_payload = {
        "token": token,
        "email": invite_email,
        "password": "password123",
        "first_name": "First",
        "last_name": "Last",
        "phone": "0821234567",
    }
    resp4 = admin_override.post("/api/auth/complete-invite", json=complete_payload)
    assert resp4.status_code == 201
    assert "access_token" in resp4.json()

    # ensure invite marked used
    invite = db_session.query(InviteToken).filter_by(token=token).first()
    assert invite.used is True
