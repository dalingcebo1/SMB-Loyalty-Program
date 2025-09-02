from fastapi.testclient import TestClient
import os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.main import app  # type: ignore
from app.core.database import SessionLocal  # type: ignore
from app.models import User, Tenant  # type: ignore
from app.plugins.auth.routes import get_password_hash  # type: ignore


def ensure_admin():
    with SessionLocal() as s:
        tid = 'default'
        if not s.query(Tenant).filter_by(id=tid).first():
            from datetime import datetime
            s.add(Tenant(id=tid, name='Default', loyalty_type='standard', created_at=datetime.utcnow()))
            s.commit()
        if not s.query(User).filter_by(email='admin@example.com').first():
            u = User(email='admin@example.com', hashed_password=get_password_hash('pass'), first_name='A', last_name='D', tenant_id=tid, role='admin', onboarded=True)
            s.add(u)
            s.commit()


def test_ops_status_endpoint():
    ensure_admin()
    client = TestClient(app)
    # Login to get token
    resp = client.post('/api/auth/login', data={'username': 'admin@example.com', 'password': 'pass'})
    assert resp.status_code == 200, resp.text
    token = resp.json()['access_token']
    r = client.get('/api/ops/status', headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get('ok') is True
    assert 'uptime_seconds' in data
    assert 'tenants' in data
    assert 'rate_limit' in data and isinstance(data['rate_limit'], dict)
    assert 'jobs' in data and isinstance(data['jobs'], dict)
