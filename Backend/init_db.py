from dotenv import load_dotenv
import os
import sys
from sqlalchemy.exc import OperationalError

# so we can import database.py/models.py no matter cwd
sys.path.append(os.path.dirname(__file__))

# load DATABASE_URL, SECRET_KEY, etc from .env
load_dotenv()

from database import Base, engine
import models  # noqa: F401 — ensures all your ORM model classes are registered

def main():
    db_url = os.getenv("DATABASE_URL")
    print(f"▶️ init_db using DATABASE_URL: {db_url}")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set in environment")

    # 1) Test the connection
    try:
        with engine.connect() as conn:
            print("✅ Successfully connected to Postgres")
    except OperationalError as err:
        print("❌ ERROR connecting to Postgres:")
        print(err)
        sys.exit(1)

    # 2) Create any missing tables
    print("⏳ Creating any missing tables…")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created (or already existed).")

if __name__ == "__main__":
    main()
