import os, sys

# Use isolated in-memory SQLite so this test doesn't mutate dev.db
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')

from fastapi.testclient import TestClient

# Ensure Backend package root is on sys.path for direct test execution from repo root
ROOT = os.path.dirname(__file__)
BACKEND_PATH = os.path.abspath(os.path.join(ROOT, '..', 'Backend'))
if os.path.isdir(BACKEND_PATH) and BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

from app.main import app  # type: ignore
from app.core.database import SessionLocal, Base, engine  # type: ignore
from app.models import Tenant  # type: ignore
from datetime import datetime

client = TestClient(app)

def setup_module(module):
    # Fresh schema for isolated in-memory DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='default').first():
        db.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', primary_domain='default', created_at=datetime.utcnow(), config={}))
    db.commit(); db.close()

def test_public_meta_ban_and_unban():
    from app.core.rate_limit import _BUCKETS, _PENALTIES, _BANS, set_limit  # type: ignore
    _BUCKETS.clear(); _PENALTIES.clear(); _BANS.clear()
    set_limit('ip_public_meta', 1, 60)
    r = client.get('/api/public/tenant-meta', headers={'Host': 'default'})
    assert r.status_code == 200
    ban_ip = None
    from app.core.rate_limit import _BANS  # type: ignore
    for _ in range(50):  # iterate until ban triggers
        r2 = client.get('/api/public/tenant-meta', headers={'Host': 'default'})
        assert r2.status_code in (200, 429)
        if _BANS:
            ban_ip = next(iter(_BANS.keys()))
            break
    assert ban_ip, 'Ban did not trigger as expected'
    # Clear ban directly
    _BANS.pop(ban_ip, None)
    assert not _BANS
