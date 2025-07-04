import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app

# Use SQLite in-memory database for tests
dialect_url = "sqlite:///:memory:"
engine = create_engine(dialect_url, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def initialize_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed default tenant for foreign key constraints
    from app.models import Tenant
    from config import settings
    from datetime import datetime
    session = TestingSessionLocal()
    session.add(Tenant(
        id=settings.default_tenant,
        name="Default Tenant",
        loyalty_type="standard",
        created_at=datetime.utcnow()
    ))
    session.commit()
    session.close()
    yield
    # Drop tables after tests
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
        try:
            yield db_session
        finally:
            pass

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
        user = db_session.query(User).first()
        if not user:
            user = User(
                email="testuser@example.com",
                hashed_password=None,
                onboarded=True,
                first_name="Test",
                last_name="User",
                phone="0812345678",
                tenant_id=settings.default_tenant,
                created_at=datetime.utcnow(),
                role="user",
            )
            db_session.add(user)
            db_session.commit()
            db_session.refresh(user)
        return user

    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)
