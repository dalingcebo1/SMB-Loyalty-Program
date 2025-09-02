import pytest
from app.models import User, Tenant
from datetime import datetime
from app.plugins.auth.routes import create_access_token

DEV_EMAIL = 'devjobs@example.dev'

@pytest.fixture()
def jobs_seed(db_session):
    """Seed a developer user in current (function-scoped) DB.

    Replaces module-level setup_module which conflicted with per-test table
    resets, leading to missing user and 401 responses.
    """
    if not db_session.query(Tenant).filter_by(id='default').first():
        db_session.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', primary_domain='default', created_at=datetime.utcnow(), config={}))
    if not db_session.query(User).filter_by(email=DEV_EMAIL).first():
        existing = db_session.query(User).filter_by(phone='1').first()
        phone_val = '1' if not existing else '3'
        db_session.add(User(email=DEV_EMAIL, phone=phone_val, tenant_id='default', role='developer'))
    db_session.commit()
    return db_session


def _auth_headers():
    token = create_access_token(DEV_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def test_job_enqueue_and_run_next(client, jobs_seed):
    # list jobs
    # Debug: list registered /api/dev routes
    from app.main import app as _app
    paths = sorted([getattr(r,'path',None) for r in _app.router.routes if getattr(r,'path',None) and '/api/dev' in getattr(r,'path')])
    print('DEBUG dev routes:', paths)
    r = client.get('/api/dev/jobs', headers=_auth_headers())
    if r.status_code != 200:  # temporary debug aid
        print('DEBUG /api/dev/jobs status', r.status_code, 'body:', r.text)
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


def test_job_run_specific_and_failure(client, jobs_seed):
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
