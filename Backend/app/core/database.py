from config import settings

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator

# 1) Ensure DATABASE_URL is set
DATABASE_URL = settings.database_url

"""Database engine / session factory.

Test Fail Fix:
Pytest uses an in-memory SQLite URL (sqlite:///:memory:) set via the
DATABASE_URL environment variable. The previous configuration created a new
independent in-memory database per connection, so tables created in test
fixtures were invisible to new sessions (leading to 'no such table: orders').

Solution: For in-memory SQLite we must use StaticPool and identical
connect_args to ensure all sessions share the same transient database.
"""

# 2) Create the SQLAlchemy engine with tuned pool settings
engine_kwargs: dict = {
    "echo": True,
    "future": True,
    "pool_pre_ping": True,  # checks connections before using to avoid stale ones
}

if DATABASE_URL.startswith("sqlite"):
    # Always disable same-thread check for FastAPI + tests
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # Special handling for pure in-memory DB so all sessions share the same
    # database (otherwise each new connection is a fresh empty database)
    if ":memory:" in DATABASE_URL:
        engine_kwargs["poolclass"] = StaticPool
else:
    # Production / Postgres style settings
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_timeout": 30,
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

# --- Removed legacy self-heal logic ---
# All schema evolution is now managed exclusively via Alembic migrations.
# If a developer database is missing columns, run: `alembic upgrade head`.

# 3) Configure a Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,  # keep objects usable outside session scope (tests access attributes later)
    bind=engine,
    future=True,
)

# 4) Base class for models
Base = declarative_base()

# Optional: Set tenant GUC for RLS automatically on connection checkout (Postgres only)
try:
    if engine.url.get_backend_name().startswith("postgres"):
        from app.core.tenant_context import current_tenant_id  # local import to avoid circular at module import

        @event.listens_for(SessionLocal, "after_begin")
        def _configure_tenant(session, transaction, connection):  # pragma: no cover
            tid = current_tenant_id.get(None)
            if tid:
                try:
                    connection.execute(text("SELECT set_config('app.tenant_id', :tid, false)"), {"tid": tid})
                except Exception:
                    pass
except Exception:  # pragma: no cover
    pass

# 5) Dependency for FastAPI routes
def get_db() -> Generator[Session, None, None]:
    """
    Yields a SQLAlchemy Session, and ensures it's closed after use.
    Usage in a route:
        @router.get(...)
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
