import os
# Set test DATABASE_URL before any app import
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
import sys
# ensure Backend/app is on PYTHONPATH for imports
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
import main
app = main.app

# Use SQLite in-memory database with StaticPool for tests
dialect_url = os.environ.get("DATABASE_URL")  # use initial test DB URL
engine = create_engine(
    dialect_url,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function", autouse=True)
def initialize_db():
    # Import all models to register with Base.metadata
    import app.models  # ensure core models are registered before creating tables
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed default tenant and a default user for tests
    from app.models import Tenant, User
    from config import settings
    from datetime import datetime
    session = TestingSessionLocal()
    session.add(Tenant(
        id=settings.default_tenant,
        name="Default Tenant",
        loyalty_type="standard",
        created_at=datetime.utcnow()
    ))
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
    # Drop tables after test
    Base.metadata.drop_all(bind=engine)

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
    from datetime import datetime

    # Bypass staff requirement
    app.dependency_overrides[require_staff] = lambda: None

    # Provide a default current_user from the test DB
    def override_get_current_user():
        return db_session.query(User).first()

    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)
