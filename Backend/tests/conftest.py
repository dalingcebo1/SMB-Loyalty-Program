"""Backend test fixtures.

Strips prior debug/diagnostic path prints now that import stability is solved.
Provides DB setup, rate limit reset, and a configured TestClient with auth
dependency overrides where appropriate.
"""
import os
from typing import Optional

# Ensure the test database URL is configured *before* importing the database layer
# so the engine and SessionLocal bind to the fast in-memory sqlite database even if
# a developer has a local DATABASE_URL configured for Postgres.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from app.core.database import Base, get_db, engine, SessionLocal as TestingSessionLocal
import main

app = main.app
try:  # best-effort initial metadata creation
    Base.metadata.create_all(bind=engine)
except Exception:  # pragma: no cover
    pass

@pytest.fixture(scope="function", autouse=True)
def initialize_db():
    # Import all models to register with Base.metadata
    import app.models  # ensure core models registered
    # Ensure tables exist (do not drop to preserve module-level seed data)
    Base.metadata.create_all(bind=engine)
    # Seed default tenant and a default user for tests
    from app.models import Tenant, User
    # Also import loyalty-related tables to ensure a clean slate per test
    from app.models import VisitCount, Reward, Redemption, Vehicle, OrderVehicle
    from config import settings
    from datetime import datetime
    session = TestingSessionLocal()
    # Clean loyalty-related tables to avoid cross-test contamination
    try:
        session.query(VisitCount).delete()
        session.query(Redemption).delete()
        session.query(Reward).delete()
        # Clean vehicle-related tables to avoid cross-test contamination
        # Delete child rows first to satisfy FK constraints
        session.query(OrderVehicle).delete()
        session.query(Vehicle).delete()
    except Exception:
        # Best effort; if tables don't exist yet they will be created below
        session.rollback()
    if not session.query(Tenant).filter_by(id=settings.default_tenant).first():
        session.add(Tenant(
            id=settings.default_tenant,
            name="Default Tenant",
            loyalty_type="standard",
            primary_domain=settings.default_tenant,
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

    if hasattr(rl, "_BUCKETS"):
        getattr(rl, "_BUCKETS").clear()
    if hasattr(rl, "_PENALTIES"):
        getattr(rl, "_PENALTIES").clear()
    if hasattr(rl, "_CONFIG"):
        getattr(rl, "_CONFIG").clear()
    yield


@pytest.fixture(autouse=True)
def reset_jobs_queue():
    """Clear in-memory job queue state between tests.

    Prevents cross-test contamination where a previously enqueued job could
    be executed by later tests expecting a clean queue (e.g. run-next).
    """
    from app.core import jobs

    if hasattr(jobs, "_queue"):
        getattr(jobs, "_queue").clear()
    if hasattr(jobs, "_jobs"):
        getattr(jobs, "_jobs").clear()
    if hasattr(jobs, "_history"):
        getattr(jobs, "_history").clear()
    if hasattr(jobs, "_DEAD_LETTER"):
        getattr(jobs, "_DEAD_LETTER").clear()
    if hasattr(jobs, "_scheduled"):
        getattr(jobs, "_scheduled").clear()
    if hasattr(jobs, "_overflow_rejections"):
        try:
            setattr(jobs, "_overflow_rejections", 0)
        except Exception:
            pass
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
    from app.models import User
    from config import settings
    from datetime import datetime, UTC
    from fastapi import Request
    from jose import jwt, JWTError

    # Bypass staff requirement
    app.dependency_overrides[require_staff] = lambda: None

    # Provide a default current_user from the test DB
    def override_get_current_user(request: Optional[Request] = None):
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
        # Fallback: first user in DB
        return db_session.query(User).first()

    app.dependency_overrides[get_current_user] = override_get_current_user
    # Do NOT override developer_only so authz role tests validate actual logic
    return TestClient(app)
