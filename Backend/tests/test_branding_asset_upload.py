import os, sys, io
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402
from app.core.database import SessionLocal, Base, engine  # noqa: E402
from app.models import Tenant, User, TenantBranding  # noqa: E402
from app.plugins.auth.routes import get_password_hash, create_access_token  # noqa: E402
from datetime import datetime  # noqa: E402

client = TestClient(app)


def _admin_token():
    db = SessionLocal()
    # ensure tenant and admin user
    if not db.query(Tenant).filter_by(id='default').first():
        db.add(Tenant(id='default', name='Default', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow()))
        db.commit()
    admin = db.query(User).filter_by(email='asset_admin@example.com').first()
    if not admin:
        admin = User(email='asset_admin@example.com', hashed_password=get_password_hash('pass'), tenant_id='default', role='admin')
        db.add(admin); db.commit(); db.refresh(admin)
    db.close()
    return create_access_token(admin.email)


def test_upload_success_png():
    token = _admin_token()
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"0"*100  # minimal fake png signature with data
    resp = client.post('/api/tenants/default/branding/assets/logo_light', files={'file': ('logo.png', png_bytes, 'image/png')}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body['field'] == 'logo_light'
    assert body['url'].startswith('/static/branding/default/logo_light-')
    assert body['etag']


def test_upload_invalid_type():
    token = _admin_token()
    resp = client.post('/api/tenants/default/branding/assets/logo_light', files={'file': ('logo.txt', b'not-an-image', 'text/plain')}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 400


def test_upload_oversize():
    token = _admin_token()
    big = b'\x89PNG\r\n\x1a\n' + os.urandom(600*1024)  # >512KB
    resp = client.post('/api/tenants/default/branding/assets/logo_light', files={'file': ('big.png', big, 'image/png')}, headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 413


def test_branding_record_updated():
    token = _admin_token()
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"1"*200
    client.post('/api/tenants/default/branding/assets/logo_dark', files={'file': ('dark.png', png_bytes, 'image/png')}, headers={'Authorization': f'Bearer {token}'})
    db = SessionLocal()
    b = db.query(TenantBranding).filter_by(tenant_id='default').first()
    assert b is not None and b.logo_dark_url is not None
    db.close()
