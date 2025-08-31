from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import User, Tenant
from datetime import datetime

client = TestClient(app)

def setup_module(module):
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='authz').first():
        db.add(Tenant(id='authz', name='AuthZ', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow()))
    # seed users
    if not db.query(User).filter_by(email='dev@example.dev').first():
        db.add(User(email='dev@example.dev', phone='1', tenant_id='authz', role='developer'))
    if not db.query(User).filter_by(email='staff@example.com').first():
        db.add(User(email='staff@example.com', phone='2', tenant_id='authz', role='staff'))
    db.commit(); db.close()

def _token(email: str):
    # Leverage login route by inserting passwordless? For simplicity we mint token directly replicating create_access_token logic.
    # Import inside to avoid circulars.
    from app.plugins.auth.routes import create_access_token
    return create_access_token(email)

def test_developer_can_access_dev_console():
    t = _token('dev@example.dev')
    r = client.get('/api/dev/', headers={'Authorization': f'Bearer {t}', 'X-Tenant-ID': 'authz'})
    assert r.status_code == 200

def test_staff_blocked_from_dev_console():
    t = _token('staff@example.com')
    r = client.get('/api/dev/', headers={'Authorization': f'Bearer {t}', 'X-Tenant-ID': 'authz'})
    assert r.status_code in (403, 401)
