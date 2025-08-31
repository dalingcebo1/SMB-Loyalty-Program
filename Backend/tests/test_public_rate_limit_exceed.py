from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models import Tenant
from datetime import datetime

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='default').first():
        db.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', primary_domain='default', created_at=datetime.utcnow(), config={}))
    db.commit(); db.close()

def test_public_meta_rate_limit_exceeded():
    # Exhaust capacity (60 per 60s). We'll do 61 sequential calls.
    allowed = 0
    last_status = None
    for i in range(61):
        r = client.get('/api/public/tenant-meta', headers={'Host': 'default'})
        last_status = r.status_code
        if r.status_code in (200, 304):
            allowed += 1
        if r.status_code == 429:
            # first 429 indicates limit hit; break
            break
    assert allowed <= 60
    assert last_status == 429
