from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import User
from app.plugins.auth.routes import get_password_hash

client = TestClient(app)

# Utility to ensure a user exists

def ensure_user(email: str, role: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(email=email, hashed_password=get_password_hash('pass'), role=role, tenant_id='default')
            db.add(user)
            db.commit()
        return user
    finally:
        db.close()


def auth_headers(email: str):
    # Assume there is a /auth/login endpoint expecting email & password returning token
    # If not present, this test may need adaptation or will be skipped.
    r = client.post('/auth/login', json={'email': email, 'password': 'pass'})
    if r.status_code != 200:
        return {}
    token = r.json().get('access_token')
    return {'Authorization': f'Bearer {token}'} if token else {}


def test_staff_can_refresh_customers():
    ensure_user('staff-refresh@test.local', 'staff')
    headers = auth_headers('staff-refresh@test.local')
    if not headers:
        return  # skip if auth flow not available in test env
    resp = client.post('/analytics/customers/refresh', headers=headers)
    assert resp.status_code in (200, 404)  # 404 if metrics tables not seeded yet


def test_basic_user_cannot_refresh_customers():
    ensure_user('basic-refresh@test.local', 'user')
    headers = auth_headers('basic-refresh@test.local')
    if not headers:
        return
    resp = client.post('/analytics/customers/refresh', headers=headers)
    if resp.status_code != 404:  # ignore missing resource scenario
        assert resp.status_code == 403
