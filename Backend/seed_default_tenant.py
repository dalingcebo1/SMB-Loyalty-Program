"""Idempotent seeding of the default tenant for local/dev environments.

Usage:
  PYTHONPATH=Backend DATABASE_URL=sqlite:///./Backend/dev.db python Backend/seed_default_tenant.py

Honors settings.default_tenant for the ID. Safe to run multiple times.
"""
from datetime import datetime
from config import settings
from app.core.database import SessionLocal, Base, engine
from app.models import Tenant, VerticalType


def ensure_schema():
    # In dev (especially sqlite) we might not have run migrations; create tables.
    Base.metadata.create_all(bind=engine)

def seed_default():
    session = SessionLocal()
    try:
        tid = settings.default_tenant or "default"
        existing = session.query(Tenant).filter(Tenant.id == tid).first()
        if existing:
            print(f"Tenant '{tid}' already present (primary_domain={existing.primary_domain}).")
            return
        tenant = Tenant(
            id=tid,
            name="Default Tenant",
            loyalty_type="standard",
            vertical_type=VerticalType.carwash.value,
            primary_domain=tid,  # allow Host: default resolution in dev
            created_at=datetime.utcnow(),
            config={"features": {}, "branding": {}},
        )
        session.add(tenant)
        session.commit()
        print(f"Inserted tenant '{tid}'.")
    finally:
        session.close()

if __name__ == "__main__":
    ensure_schema()
    seed_default()
