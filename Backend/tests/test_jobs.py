from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models import User, Tenant
from datetime import datetime
from app.plugins.auth.routes import create_access_token

client = TestClient(app)

DEV_EMAIL = 'devjobs@example.dev'

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='default').first():
        db.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', primary_domain='default', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email=DEV_EMAIL).first():
        db.add(User(email=DEV_EMAIL, phone='1', tenant_id='default', role='developer'))
    db.commit(); db.close()


def _auth_headers():
    token = create_access_token(DEV_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def test_job_enqueue_and_run_next():
    # list jobs
    r = client.get('/api/dev/jobs', headers=_auth_headers())
    assert r.status_code == 200
    assert 'ping' in r.json()['registered']

    # enqueue ping
    r = client.post('/api/dev/jobs/enqueue', json={'name': 'ping', 'payload': {'x': 1}}, headers=_auth_headers())
    assert r.status_code == 200
    jid = r.json()['enqueued']

    # run next
    r = client.post('/api/dev/jobs/run-next', headers=_auth_headers())
    assert r.status_code == 200
    assert r.json()['ran'] == jid

    # snapshot shows success
    r = client.get('/api/obs/jobs', headers=_auth_headers())
    assert r.status_code == 200
    recent = r.json()['recent']
    assert any(j['id'] == jid and j['status'] == 'success' for j in recent)


def test_job_run_specific_and_failure():
    # enqueue fail job
    r = client.post('/api/dev/jobs/enqueue', json={'name': 'fail', 'payload': {'message': 'boom'}}, headers=_auth_headers())
    assert r.status_code == 200
    jid = r.json()['enqueued']

    # run by id
    r = client.post(f'/api/dev/jobs/{jid}/run', headers=_auth_headers())
    assert r.status_code == 200
    # should now be error
    r = client.get('/api/obs/jobs', headers=_auth_headers())
    assert r.status_code == 200
    recent = r.json()['recent']
    assert any(j['id'] == jid and j['status'] == 'error' for j in recent)
