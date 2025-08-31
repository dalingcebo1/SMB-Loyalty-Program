from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models import User, Tenant, AuditLog
from datetime import datetime, timedelta
from app.plugins.auth.routes import create_access_token

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Seed tenant and user
    if not db.query(Tenant).filter_by(id='obs1').first():
        db.add(Tenant(id='obs1', name='Obs T', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email='devobs@example.com').first():
        db.add(User(email='devobs@example.com', phone='555', tenant_id='obs1', role='admin'))
    if not db.query(User).filter_by(email='otheradmin@example.com').first():
        db.add(User(email='otheradmin@example.com', phone='666', tenant_id='obs1', role='admin'))
    db.commit(); db.close()


def _token():
    return create_access_token('devobs@example.com')


def test_observability_cache_endpoint():
    t = _token()
    r = client.get('/api/obs/tenant-cache', headers={'Authorization': f'Bearer {t}'})
    assert r.status_code == 200
    data = r.json()
    assert 'size' in data and 'capacity' in data and 'metrics' in data


def test_observability_audit_list_filters():
    # create a couple audit logs
    db = SessionLocal()
    db.add(AuditLog(tenant_id='obs1', user_id=1, action='tenant.create', created_at=datetime.utcnow(), details={'x':1}))
    db.add(AuditLog(tenant_id='obs1', user_id=1, action='tenant.update', created_at=datetime.utcnow(), details={'y':2}))
    db.commit(); db.close()
    t = _token()
    r = client.get('/api/obs/audit?action_prefix=tenant.c&limit=10', headers={'Authorization': f'Bearer {t}'})
    assert r.status_code == 200
    rows = r.json()
    assert any(row['action']=='tenant.create' for row in rows)
    assert all(row['action'].startswith('tenant.c') for row in rows)

def test_observability_since_and_pagination():
    db = SessionLocal()
    now = datetime.utcnow()
    # add older and newer
    db.add(AuditLog(tenant_id='obs1', user_id=1, action='tenant.old', created_at=now - timedelta(hours=2)))
    db.add(AuditLog(tenant_id='obs1', user_id=1, action='tenant.new', created_at=now))
    db.commit(); db.close()
    t = _token()
    since_iso = (now - timedelta(hours=1)).isoformat()
    r = client.get(f'/api/obs/audit?since={since_iso}&limit=5', headers={'Authorization': f'Bearer {t}'})
    assert r.status_code == 200
    acts = {row['action'] for row in r.json()}
    assert 'tenant.new' in acts and 'tenant.old' not in acts

def test_observability_request_metrics_and_errors():
    t = _token()
    # generate a couple requests
    client.get('/api/obs/tenant-cache', headers={'Authorization': f'Bearer {t}'})
    client.get('/api/obs/tenant-cache', headers={'Authorization': f'Bearer {t}'})
    # trigger error
    err = client.get('/api/obs/force-error', headers={'Authorization': f'Bearer {t}'})
    assert err.status_code == 500
    m = client.get('/api/obs/request-metrics', headers={'Authorization': f'Bearer {t}'})
    assert m.status_code == 200
    stats = m.json()
    assert stats['count'] >= 2
    e = client.get('/api/obs/errors', headers={'Authorization': f'Bearer {t}'})
    assert e.status_code == 200
    errs = e.json()
    assert any(er['error']=='RuntimeError' for er in errs)
