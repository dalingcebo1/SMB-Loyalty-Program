import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.plugins.auth.routes import require_admin, get_current_user
from app.models import User, Tenant
from config import settings
from datetime import datetime

@pytest.fixture(autouse=True)
def dev_client(client, db_session):
    # Ensure an admin user exists and override auth dependencies
    dev = db_session.query(User).first()
    dev.role = 'admin'  # Change to admin role since require_admin checks for 'admin'
    db_session.commit()
    app.dependency_overrides[require_admin] = lambda: dev
    app.dependency_overrides[get_current_user] = lambda: dev
    return client


def test_dev_status(dev_client):
    resp = dev_client.get("/api/dev/")
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'ok'
    assert 'tenants' in data


def test_reset_db(dev_client):
    # Create a dummy table entry
    resp = dev_client.post("/api/dev/reset-db")
    assert resp.status_code == 200
    assert resp.json()['message'] == 'Database reset complete.'
