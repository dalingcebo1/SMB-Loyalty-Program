from config import settings

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# 1) Ensure DATABASE_URL is set
DATABASE_URL = settings.database_url

# 2) Create the SQLAlchemy engine with tuned pool settings
engine_kwargs = dict(
    echo=True,
    future=True,
    pool_pre_ping=True,  # checks connections before using to avoid stale ones
)
# Disable specific pool sizing args for SQLite (e.g., in-memory tests)
if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update(
        pool_size=20,        # number of persistent connections
        max_overflow=10,     # additional connections beyond pool_size
        pool_timeout=30,     # seconds to wait before giving up on getting a connection
    )
engine = create_engine(DATABASE_URL, **engine_kwargs)

# 3) Configure a Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

# 4) Base class for models
Base = declarative_base()

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
