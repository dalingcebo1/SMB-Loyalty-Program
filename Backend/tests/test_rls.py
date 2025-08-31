from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, engine
from app.models import Tenant, User, Reward
from datetime import datetime
import pytest

postgres_only = pytest.mark.skipif(engine.url.get_backend_name() != 'postgresql', reason='RLS only meaningful on Postgres')

client = TestClient(app)

@pytest.fixture(scope='module')
def seed_data():
    db = SessionLocal()
    # Two tenants
    t1 = Tenant(id='t1', name='Tenant 1', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow())
    t2 = Tenant(id='t2', name='Tenant 2', loyalty_type='standard', vertical_type='flowershop', created_at=datetime.utcnow())
    db.merge(t1)
    db.merge(t2)
    # Users
    u1 = User(email='u1@example.com', phone='1', tenant_id='t1', role='user')
    u2 = User(email='u2@example.com', phone='2', tenant_id='t2', role='user')
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1); db.refresh(u2)
    # Rewards
    r1 = Reward(tenant_id='t1', title='R1', type='points', created_at=datetime.utcnow())
    r2 = Reward(tenant_id='t2', title='R2', type='points', created_at=datetime.utcnow())
    db.add_all([r1, r2])
    db.commit()
    db.close()
    return {'u1': u1, 'u2': u2}

@postgres_only
def test_rls_blocks_cross_tenant(seed_data):
    # Simulate tenant context t1 and attempt to list rewards of t2 via raw query endpoint (if existed)
    # Since we don't have a dedicated rewards list endpoint yet in this snippet, we rely on direct DB-level
    # isolation expectation; creating a placeholder ensures policy presence.
    db = SessionLocal()
    # Expect only tenant t1 rewards visible when GUC is set (set by dependency). Manually set GUC here.
    db.execute("SELECT set_config('app.tenant_id', 't1', false)")
    rows = db.execute("SELECT id, tenant_id FROM rewards").fetchall()
    assert all(row.tenant_id == 't1' for row in rows)
    db.close()
