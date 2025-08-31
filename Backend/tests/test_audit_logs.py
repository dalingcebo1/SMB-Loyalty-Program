from app.core.database import SessionLocal, Base, engine
from app.models import AuditLog, Tenant, User
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='aud1').first():
        db.add(Tenant(id='aud1', name='Aud', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email='auditadmin@example.com').first():
        db.add(User(email='auditadmin@example.com', phone='999', tenant_id='aud1', role='admin'))
    db.commit(); db.close()

from app.plugins.auth.routes import create_access_token

def _token():
    return create_access_token('auditadmin@example.com')

def test_tenant_create_generates_audit_log():
    t = _token()
    r = client.post('/api/tenants', json={'id':'audx','name':'Aud X','loyalty_type':'standard'}, headers={'Authorization': f'Bearer {t}'})
    assert r.status_code in (201,400)
    db = SessionLocal()
    rows = db.query(AuditLog).filter(AuditLog.action=='tenant.create').all()
    assert rows, 'expected at least one tenant.create audit log'
    db.close()
