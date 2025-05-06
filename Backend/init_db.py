#!/usr/bin/env python3
import sys
import os

# add project root to PYTHONPATH so "models" is importable
HERE = os.path.dirname(__file__)            # Backend/
ROOT = os.path.abspath(os.path.join(HERE, ".."))  # project root
sys.path.insert(0, ROOT)

from database import Base, engine
from sqlalchemy.orm import Session
from models import Tenant

# Make sure ALL of your table-definitions get loaded into Base.metadata:
import models       # <-- this is your Backend/models.py
# (if you have any tables defined elsewhere, import those too,
# e.g. `import routes.orders` so that Order is registered)

def reset_db():
    print("⚠️  Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("✅ All tables dropped.")
    print("⚙️  Recreating all tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created.")

    with Session(engine) as session:
        if not session.query(Tenant).filter_by(id="default").first():
            session.add(Tenant(id="default", name="Default Tenant", loyalty_type="standard"))
            session.commit()
            print("Inserted default tenant.")

if __name__ == "__main__":
    reset_db()
