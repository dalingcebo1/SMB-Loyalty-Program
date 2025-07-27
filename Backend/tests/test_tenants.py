import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.plugins.auth.routes import require_admin, get_current_user
from app.models import Tenant, User
from config import settings
from datetime import datetime

@ pytest.fixture(autouse=True)
def admin_client(client, db_session):
    # Ensure an admin user exists and override auth dependencies
    admin = db_session.query(User).first()
    admin.role = 'admin'
    db_session.commit()
    # Override dependencies
    app.dependency_overrides[require_admin] = lambda: admin
    app.dependency_overrides[get_current_user] = lambda: admin
    return client


def test_list_tenants(admin_client):
    resp = admin_client.get("/api/tenants/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(t['id'] == settings.default_tenant for t in data)


def test_create_and_get_tenant(admin_client):
    payload = {'id': 'tenant1', 'name': 'Tenant 1', 'loyalty_type': 'premium'}
    resp = admin_client.post("/api/tenants/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data['id'] == 'tenant1'

    resp2 = admin_client.get(f"/api/tenants/{payload['id']}")
    assert resp2.status_code == 200
    assert resp2.json()['name'] == 'Tenant 1'


def test_update_tenant(admin_client):
    payload = {'name': 'Tenant One'}
    resp = admin_client.patch("/api/tenants/tenant1", json=payload)
    assert resp.status_code == 200
    assert resp.json()['name'] == 'Tenant One'


def test_assign_and_remove_admin(admin_client, db_session):
    # Create a new user to assign as admin
    new_user = User(
        email='u@example.com', hashed_password=None, onboarded=True,
        first_name='U', last_name='X', phone='000', tenant_id=settings.default_tenant,
        created_at=datetime.utcnow(), role='user'
    )
    db_session.add(new_user)
    db_session.commit()
    db_session.refresh(new_user)

    # Assign admin
    resp = admin_client.post(f"/api/tenants/tenant1/admins", json={'user_id': new_user.id})
    assert resp.status_code == 200
    data = resp.json()
    assert new_user.id in data['admin_ids']

    # Remove admin
    resp2 = admin_client.delete(f"/api/tenants/tenant1/admins/{new_user.id}")
    assert resp2.status_code == 200
    assert new_user.id not in resp2.json()['admin_ids']


def test_delete_tenant(admin_client):
    resp = admin_client.delete("/api/tenants/tenant1")
    assert resp.status_code == 204

    resp2 = admin_client.get("/api/tenants/tenant1")
    assert resp2.status_code == 404
