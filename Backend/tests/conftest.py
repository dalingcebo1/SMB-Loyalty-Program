import os
# Set test DATABASE_URL before any app import
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
import sys
# ensure Backend/app is on PYTHONPATH for imports
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)
import pytest
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db, engine, SessionLocal as TestingSessionLocal
import main
app = main.app
# Eagerly create tables so module-level setup_module functions can access them
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

@pytest.fixture(scope="function", autouse=True)
def initialize_db():
    # Import all models to register with Base.metadata
    import app.models  # ensure core models are registered before creating tables
    # Recreate tables fresh for isolation
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception:
        pass
    Base.metadata.create_all(bind=engine)
    # Seed default tenant and a default user for tests
    from app.models import Tenant, User
    from config import settings
    from datetime import datetime
    session = TestingSessionLocal()
    if not session.query(Tenant).filter_by(id=settings.default_tenant).first():
        session.add(Tenant(
            id=settings.default_tenant,
            name="Default Tenant",
            loyalty_type="standard",
            created_at=datetime.utcnow()
        ))
    if not session.query(User).filter_by(email="testuser@example.com").first():
        # Seed a default test user
        session.add(User(
            email="testuser@example.com",
            hashed_password=None,
            onboarded=True,
            first_name="Test",
            last_name="User",
            phone="0812345678",
            tenant_id=settings.default_tenant,
            created_at=datetime.utcnow(),
            role="user",
        ))
    session.commit()
    session.close()
    yield

@pytest.fixture(scope="session", autouse=True)
def create_all_once():
    """Ensure tables exist before any module-level setup_module executes.

    Some test modules use setup_module to seed data; those run before
    function-scoped fixtures, so we need a session-level creation.
    """
    import app.models  # ensure models registered
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def reset_rate_limits():
    # Clear in-memory rate limiter state between tests to prevent cascading 429s
    from app.core import rate_limit as rl
    rl._BUCKETS.clear()  # type: ignore
    rl._PENALTIES.clear()  # type: ignore
    rl._CONFIG.clear()  # type: ignore  # clear dynamic overrides
    yield

@pytest.fixture(scope="function")
def db_session(initialize_db):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="function")
def client(db_session, monkeypatch):
    # Override get_db to use the test session
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Override auth dependencies for tests
    from app.plugins.auth.routes import require_staff, get_current_user
    from app.core.authz import developer_only
    from app.models import User
    from config import settings
    from datetime import datetime
    from fastapi import Request
    from jose import jwt, JWTError

    # Bypass staff requirement
    app.dependency_overrides[require_staff] = lambda: None

    # Provide a default current_user from the test DB
    def override_get_current_user(request: Request = None):  # type: ignore[override]
        """Test override that honors Authorization bearer token when provided.

        Falls back to the first user (seeded default) to maintain existing
        tests that rely on an implicit user when no header is sent.
        """
        try:
            if request is not None:
                auth = request.headers.get("Authorization")
                if auth:
                    token = auth.split()[1] if auth.lower().startswith("bearer ") else auth
                    try:
                        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
                        email = payload.get("sub")
                        if email:
                            u = db_session.query(User).filter_by(email=email).first()
                            if u:
                                return u
                    except JWTError:
                        pass
        except Exception:
            pass
        return db_session.query(User).first()

    app.dependency_overrides[get_current_user] = override_get_current_user
    # Do NOT override developer_only so authz role tests validate actual logic
    # Keep default public meta rate limit (tests assert 60 capacity)
    return TestClient(app)
