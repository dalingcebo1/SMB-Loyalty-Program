from config import settings

from sqlalchemy import create_engine, event, text, inspect
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
engine_kwargs = dict(
    echo=True,
    future=True,
    pool_pre_ping=True,  # checks connections before using to avoid stale ones
)

if DATABASE_URL.startswith("sqlite"):
    # Always disable same-thread check for FastAPI + tests
    engine_kwargs.update(connect_args={"check_same_thread": False})
    # Special handling for pure in-memory DB so all sessions share the same
    # database (otherwise each new connection is a fresh empty database)
    if ":memory:" in DATABASE_URL:
        engine_kwargs.update(poolclass=StaticPool)
else:
    # Production / Postgres style settings
    engine_kwargs.update(
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
    )

engine = create_engine(DATABASE_URL, **engine_kwargs)

# --- Optional schema self-heal for missing multi-vertical columns (dev safety) ---
def _ensure_multivertical_columns():  # pragma: no cover (environment-specific)
    try:
        if not engine.url.get_backend_name().startswith("postgres"):
            return
        insp = inspect(engine)
        cols = {c['name'] for c in insp.get_columns('tenants')}
        needed = []
        if 'vertical_type' not in cols:
            needed.append("ADD COLUMN vertical_type VARCHAR NOT NULL DEFAULT 'carwash'")
        if 'primary_domain' not in cols:
            needed.append("ADD COLUMN primary_domain VARCHAR NULL")
        if 'config' not in cols:
            needed.append("ADD COLUMN config JSON NOT NULL DEFAULT '{}'::json")
        if needed:
            with engine.begin() as conn:
                for stmt in needed:
                    conn.execute(text(f"ALTER TABLE tenants {stmt}"))
                # Drop defaults to mirror migration after backfill
                if 'vertical_type' not in cols:
                    conn.execute(text("ALTER TABLE tenants ALTER COLUMN vertical_type DROP DEFAULT"))
                if 'config' not in cols:
                    conn.execute(text("ALTER TABLE tenants ALTER COLUMN config DROP DEFAULT"))
                # Create composite index if absent
                idx = {i['name'] for i in insp.get_indexes('tenants')}
                if 'ix_tenants_vertical_domain' not in idx:
                    conn.execute(text("CREATE INDEX ix_tenants_vertical_domain ON tenants(vertical_type, primary_domain)"))
    except Exception:
        # silent: do not break app startup
        pass

_ensure_multivertical_columns()

# 3) Configure a Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
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
