import pytest
from app.models import User, Tenant
from datetime import datetime


@pytest.fixture()
def authz_seed(db_session):
    """Seed dedicated authz tenant + users within per-test DB session.

    Previous version used setup_module + a module-level TestClient, but our
    function-scoped DB reset fixture dropped those tables before each test,
    causing 401s (user disappeared). This fixture ensures seeding happens
    *after* the reset and within the same session used by request handling.
    """
    if not db_session.query(Tenant).filter_by(id='authz').first():
        db_session.add(Tenant(id='authz', name='AuthZ', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow()))
    if not db_session.query(User).filter_by(email='dev@example.dev').first():
        db_session.add(User(email='dev@example.dev', phone='1', tenant_id='authz', role='developer'))
    if not db_session.query(User).filter_by(email='staff@example.com').first():
        db_session.add(User(email='staff@example.com', phone='2', tenant_id='authz', role='staff'))
    db_session.commit()
    return db_session

def _token(email: str):
    # Leverage login route by inserting passwordless? For simplicity we mint token directly replicating create_access_token logic.
    # Import inside to avoid circulars.
    from app.plugins.auth.routes import create_access_token
    return create_access_token(email)

def test_developer_can_access_dev_console(client, authz_seed):
    t = _token('dev@example.dev')
    r = client.get('/api/dev/', headers={'Authorization': f'Bearer {t}', 'X-Tenant-ID': 'authz'})
    assert r.status_code == 200

def test_staff_blocked_from_dev_console(client, authz_seed):
    t = _token('staff@example.com')
    r = client.get('/api/dev/', headers={'Authorization': f'Bearer {t}', 'X-Tenant-ID': 'authz'})
    assert r.status_code in (403, 401)
