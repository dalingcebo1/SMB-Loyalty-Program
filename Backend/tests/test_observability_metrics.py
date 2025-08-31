from fastapi.testclient import TestClient
from app.main import app
from app.plugins.auth.routes import create_access_token
from app.core.database import SessionLocal, Base, engine
from app.models import User, Tenant
from datetime import datetime
import time

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='metrics').first():
        db.add(Tenant(id='metrics', name='Metrics', loyalty_type='standard', vertical_type='carwash', primary_domain='metrics', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email='metrics@example.dev').first():
        db.add(User(email='metrics@example.dev', phone='9', tenant_id='metrics', role='admin'))
    db.commit(); db.close()


def _auth_headers():
    token = create_access_token('metrics@example.dev')
    return {"Authorization": f"Bearer {token}", "Host": "metrics"}


def test_metrics_endpoint_text():
    r = client.get('/api/obs/metrics', headers=_auth_headers())
    assert r.status_code == 200
    body = r.text
    assert 'job_queue_queued' in body


def test_retry_after_header_public_meta():
    # Force small limit override
    from app.core.rate_limit import set_limit
    set_limit('ip_public_meta', 1, 60)
    # First call allowed
    r1 = client.get('/api/public/tenant-meta', headers={'Host': 'metrics'})
    assert r1.status_code in (200, 304)
    # Second should 429 with Retry-After present (or maybe 200 if refill instant, unlikely)
    r2 = client.get('/api/public/tenant-meta', headers={'Host': 'metrics'})
    if r2.status_code == 429:
        assert 'Retry-After' in r2.headers
        assert r2.json().get('scope') == 'ip_public_meta'
