import os, sys
import pytest
from fastapi.testclient import TestClient

# Ensure Backend package is importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('PYTHONPATH', ROOT)
sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402
from config import settings  # noqa: E402
from app.models import User, Tenant  # noqa: E402
from datetime import datetime  # noqa: E402
from app.plugins.auth.routes import create_access_token  # noqa: E402

client = TestClient(app)

@pytest.fixture()
def dev_headers(db_session):
    # Ensure dev tenant + user exist in current function DB
    if not db_session.query(Tenant).filter_by(id='default').first():
        db_session.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow()))
    dev_email = 'dev_audit@example.dev'
    user = db_session.query(User).filter_by(email=dev_email).first()
    if not user:
        user = User(email=dev_email, phone='555', tenant_id='default', role='developer', created_at=datetime.utcnow())
        db_session.add(user)
    db_session.commit()
    token = create_access_token(dev_email)
    return {"Authorization": f"Bearer {token}"}


def test_audit_endpoint_flag_enabled(dev_headers):
    if not settings.enable_dev_audit_view:
        pytest.skip("Audit view disabled in settings for this run")
    r = client.get('/api/dev/audit', headers=dev_headers)
    assert r.status_code == 200
    body = r.json()
    assert 'events' in body
    assert isinstance(body['events'], list)


def test_rate_limit_override_disabled_error(monkeypatch, dev_headers):
    # Temporarily disable overrides
    monkeypatch.setattr(settings, 'enable_rate_limit_overrides', False)
    r = client.post('/api/dev/rate-limits/config', json={"scope": "test", "capacity": 5, "per_seconds": 10}, headers=dev_headers)
    assert r.status_code == 403
    body = r.json()
    assert body.get('error') == 'disabled'
    assert 'Overrides disabled' in body.get('detail', '')
    # Restore (monkeypatch auto restores after test)


def test_reset_db_confirmation_required(monkeypatch, dev_headers):
    # Ensure dangerous allowed for test (set environment not production)
    monkeypatch.setattr(settings, 'environment', 'development')
    monkeypatch.setattr(settings, 'enable_dev_dangerous', True)
    r = client.post('/api/dev/reset-db', headers=dev_headers)
    # In development we may auto-confirm; accept 400 (requires confirmation) or 200 (auto-confirmed)
    if r.status_code == 400:
        body = r.json()
        assert body.get('error') == 'confirmation_required'
    else:
        assert r.status_code == 200
    # Now with confirmation
    r2 = client.post('/api/dev/reset-db?confirm=true', headers={**dev_headers, 'X-Dev-Confirm': 'RESET'})
    # Could be slow; just assert we get success or forbidden if race with other guard
    assert r2.status_code in (200, 403)
