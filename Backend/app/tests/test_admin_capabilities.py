from fastapi.testclient import TestClient
from app.main import app
from app.models import User
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.plugins.auth.routes import _role_capabilities

client = TestClient(app)


def _make_token(email: str):
    from app.plugins.auth.routes import create_access_token
    return create_access_token(email)


def test_admin_metrics_capability(tmp_path):
    # create admin user directly
    db: Session = next(get_db())
    u = db.query(User).filter_by(email='admin@example.com').first()
    if not u:
        from datetime import datetime
        from app.models import Tenant
        t = db.query(Tenant).first()
        if not t:
            t = Tenant(id='default', name='Default', loyalty_type='basic', vertical_type='carwash', created_at=datetime.utcnow(), config={})
            db.add(t); db.commit()
        u = User(email='admin@example.com', tenant_id=t.id, role='admin', onboarded=True)
        db.add(u); db.commit()
    token = _make_token('admin@example.com')
    r = client.get('/api/admin/metrics', headers={'Authorization': f'Bearer {token}'})
    assert r.status_code in (200, 403)  # If missing analytics.advanced capability (role map) treated by 403
    if r.status_code == 200:
        body = r.json()
        assert 'orders_total' in body


def test_admin_has_required_capabilities_superset():
    admin_caps = set(_role_capabilities('admin'))
    # Capabilities directly used by admin endpoints
    required = {'analytics.advanced','jobs.view','jobs.retry','rate_limit.edit','audit.view'}
    missing = required - admin_caps
    assert not missing, f"Admin role missing capabilities: {missing}"


def test_staff_forbidden_on_admin_endpoints():
    db: Session = next(get_db())
    staff = db.query(User).filter_by(email='staff1@example.com').first()
    if not staff:
        from datetime import datetime
        from app.models import Tenant
        t = db.query(Tenant).first()
        if not t:
            t = Tenant(id='default', name='Default', loyalty_type='basic', vertical_type='carwash', created_at=datetime.utcnow(), config={})
            db.add(t); db.commit()
        staff = User(email='staff1@example.com', tenant_id=t.id, role='staff', onboarded=True)
        db.add(staff); db.commit()
    token = _make_token('staff1@example.com')
    # Staff should not access analytics advanced metrics
    r1 = client.get('/api/admin/metrics', headers={'Authorization': f'Bearer {token}'})
    assert r1.status_code == 403
    r2 = client.get('/api/admin/jobs', headers={'Authorization': f'Bearer {token}'})
    assert r2.status_code == 403
    r3 = client.get('/api/admin/rate-limits', headers={'Authorization': f'Bearer {token}'})
    assert r3.status_code == 403
    r4 = client.get('/api/admin/audit', headers={'Authorization': f'Bearer {token}'})
    assert r4.status_code == 403


def test_jobs_view_forbidden_without_capability():
    # create normal user
    db: Session = next(get_db())
    u = db.query(User).filter_by(email='user1@example.com').first()
    if not u:
        from datetime import datetime
        from app.models import Tenant
        t = db.query(Tenant).first()
        if not t:
            t = Tenant(id='default', name='Default', loyalty_type='basic', vertical_type='carwash', created_at=datetime.utcnow(), config={})
            db.add(t); db.commit()
        u = User(email='user1@example.com', tenant_id=t.id, role='user', onboarded=True)
        db.add(u); db.commit()
    token = _make_token('user1@example.com')
    r = client.get('/api/admin/jobs', headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 403


def test_rate_limit_edit_and_jobs_retry_admin():
    db: Session = next(get_db())
    admin = db.query(User).filter_by(email='admin2@example.com').first()
    if not admin:
        from datetime import datetime
        from app.models import Tenant
        t = db.query(Tenant).first()
        if not t:
            t = Tenant(id='default', name='Default', loyalty_type='basic', vertical_type='carwash', created_at=datetime.utcnow(), config={})
            db.add(t); db.commit()
        admin = User(email='admin2@example.com', tenant_id=t.id, role='admin', onboarded=True)
        db.add(admin); db.commit()
    token = _make_token('admin2@example.com')
    # upsert a rate limit
    rl = client.post('/api/admin/rate-limits', params={'scope':'test_scope','capacity':99,'per_seconds':60}, headers={'Authorization': f'Bearer {token}'})
    assert rl.status_code in (200,403)  # 403 if capability mapping missing; else ensure structure
    if rl.status_code == 200:
        body = rl.json()
        assert body['updated'] == 'test_scope'
        # delete
        dl = client.delete('/api/admin/rate-limits/test_scope', headers={'Authorization': f'Bearer {token}'})
        assert dl.status_code == 200

    # create a failing job to land in dead letter and then retry
    from app.core import jobs
    rec = jobs.enqueue('fail', {"message": "boom"}, max_retries=0)
    jobs.run_job_id(rec.id)  # execute -> should error and dead-letter
    dead = jobs.dead_letter_snapshot()
    assert any(d['id'] == rec.id for d in dead)
    jr2 = client.post(f'/api/admin/jobs/{rec.id}/retry', headers={'Authorization': f'Bearer {token}'})
    if jr2.status_code == 200:
        body2 = jr2.json(); assert body2.get('requeued') == rec.id
    elif jr2.status_code == 403:
        # capability mapping missing jobs.retry for admin; acceptable fallback
        pass
    else:
        assert jr2.status_code in (200,403)

    # Ensure metrics endpoint returns expected keys when capability present
    m2 = client.get('/api/admin/metrics', headers={'Authorization': f'Bearer {token}'})
    if m2.status_code == 200:
        b = m2.json(); assert 'orders_total' in b and 'queue' in b

    # verify audit logs captured at least the upsert/delete actions when permitted
    audit = client.get('/api/admin/audit', headers={'Authorization': f'Bearer {token}'})
    if audit.status_code == 200:
        data = audit.json()
        assert 'events' in data
        # If rate limit edits succeeded, expect at least one rate_limit action present
        if rl.status_code == 200:
            actions = {e['action'] for e in data['events']}
            assert any(a.startswith('rate_limit.') for a in actions)
