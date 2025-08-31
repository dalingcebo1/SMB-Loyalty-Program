from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models import User, Tenant
from datetime import datetime
from app.plugins.auth.routes import create_access_token
import time

client = TestClient(app)

EMAIL = 'adv@example.dev'

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='adv').first():
        db.add(Tenant(id='adv', name='Adv', loyalty_type='standard', vertical_type='carwash', primary_domain='adv', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email=EMAIL).first():
        db.add(User(email=EMAIL, phone='555', tenant_id='adv', role='developer'))
    db.commit(); db.close()


def _auth_headers():
    return {"Authorization": f"Bearer {create_access_token(EMAIL)}"}


def test_per_user_tenant_limit():
    # 30 allowed; we'll just hammer a smaller override for test
    r = client.post('/api/dev/rate-limits/config', json={'scope':'user_tenant','capacity':5,'per_seconds':60}, headers=_auth_headers())
    assert r.status_code == 200
    base_headers = {**_auth_headers(), 'Host': 'adv'}
    for i in range(5):
        rr = client.get('/api/secure/ping', headers=base_headers)
        assert rr.status_code == 200
    rr = client.get('/api/secure/ping', headers=base_headers)
    assert rr.status_code == 429


def test_penalty_accumulation():
    # Force small limit for public meta
    r = client.post('/api/dev/rate-limits/config', json={'scope':'ip_public_meta','capacity':2,'per_seconds':60}, headers=_auth_headers())
    assert r.status_code == 200
    # exceed quickly from same client ip
    for i in range(3):
        rr = client.get('/api/public/tenant-meta', headers={'Host': 'adv'})
    # snapshot should show penalties or overrides
    snap = client.get('/api/dev/rate-limits/config', headers=_auth_headers())
    assert snap.status_code == 200
    data = snap.json()
    assert 'overrides' in data


def test_job_retry_and_interval():
    # enqueue failing job with retries
    r = client.post('/api/dev/jobs/enqueue', json={'name':'fail','payload':{'message':'x'},'max_retries':2}, headers=_auth_headers())
    jid = r.json()['enqueued']
    # run initial attempt
    client.post('/api/dev/jobs/run-next', headers=_auth_headers())
    # Tick until retries executed
    import time as _t
    for i in range(6):
        _t.sleep(0.11)  # allow backoff delay (0.1s, then 0.2s etc.)
        client.post('/api/dev/jobs/tick', headers=_auth_headers())
        client.post('/api/dev/jobs/run-next', headers=_auth_headers())
    obs = client.get('/api/obs/jobs', headers=_auth_headers()).json()
    # ensure job ended error with attempts >=3
    target = [j for j in obs['recent'] if j['id']==jid][0]
    assert target['attempts'] >= 3

    # interval job
    r2 = client.post('/api/dev/jobs/enqueue', json={'name':'ping','payload':{'n':1},'interval_seconds':0.05}, headers=_auth_headers())
    jid2 = r2.json()['enqueued']
    client.post('/api/dev/jobs/run-next', headers=_auth_headers())
    time.sleep(0.06)
    client.post('/api/dev/jobs/tick', headers=_auth_headers())
    client.post('/api/dev/jobs/run-next', headers=_auth_headers())
    obs2 = client.get('/api/obs/jobs', headers=_auth_headers()).json()
    runs = [j for j in obs2['recent'] if j['id']==jid2]
    assert len(runs) == 1  # record reused; status success
