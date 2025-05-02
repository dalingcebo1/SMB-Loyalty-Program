import os
from dotenv import load_dotenv

# Load .env into environment
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# 1) Ensure DATABASE_URL is set
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in environment")

# 2) Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True, future=True)

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
