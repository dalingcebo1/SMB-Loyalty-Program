from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import Tenant
from datetime import datetime

client = TestClient(app)

def setup_module(module):
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='etag1').first():
        db.add(Tenant(id='etag1', name='ETag Carwash', loyalty_type='standard', vertical_type='carwash', primary_domain='etagcar.example.test', created_at=datetime.utcnow(), config={'branding': {}}))
    db.commit(); db.close()

def test_etag_and_304_flow():
    r1 = client.get('/api/public/tenant-meta', headers={'Host': 'etagcar.example.test'})
    assert r1.status_code == 200
    etag = r1.headers.get('ETag')
    assert etag
    r2 = client.get('/api/public/tenant-meta', headers={'Host': 'etagcar.example.test', 'If-None-Match': etag})
    assert r2.status_code == 304
    # No body expected
    assert r2.text in ('', 'null')

def test_vertical_tagline_injection():
    r = client.get('/api/public/tenant-meta', headers={'Host': 'etagcar.example.test'})
    meta = r.json()
    assert 'branding' in meta and 'tagline' in meta['branding']
    assert meta['branding']['tagline']  # non-empty
