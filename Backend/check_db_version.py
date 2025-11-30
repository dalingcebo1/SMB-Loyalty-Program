import os
from sqlalchemy import create_engine, text

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not set")
    exit(1)

engine = create_engine(db_url)
with engine.connect() as conn:
    result = conn.execute(text("SELECT version_num FROM alembic_version"))
    version = result.scalar()
    print(f"Current database version: {version}")
