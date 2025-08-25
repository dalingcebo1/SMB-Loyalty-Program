#!/usr/bin/env python3
"""Seed developer(admin) and staff accounts for local development.

Usage:
  python Backend/seed_users.py

Idempotent: will skip creating a user if the email already exists.
Update behavior: if user exists, it will NOT overwrite password or role unless
you pass the flag --force-update (then role/password will be updated).

IMPORTANT: Do NOT use these plaintext credentials in production.
"""

import os
import sys
from datetime import datetime
from typing import Tuple

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from app.core.database import SessionLocal  # type: ignore
from app.models import User, Tenant  # type: ignore
from app.plugins.auth import routes  # type: ignore

DEV_ADMIN_EMAIL = "dali.ngubane@chaosx.co.za"
STAFF_EMAIL = "dali.ngubane@gmail.com"
PLAINTEXT_PASSWORD = "It7742001"
DEFAULT_TENANT_ID = "default"


def ensure_tenant(session) -> None:
    if not session.query(Tenant).filter_by(id=DEFAULT_TENANT_ID).first():
        session.add(Tenant(id=DEFAULT_TENANT_ID, name="Default Tenant", loyalty_type="standard", created_at=datetime.utcnow()))
        session.commit()
        print("✓ Created default tenant")


def upsert_user(session, email: str, role: str, force: bool) -> Tuple[bool, bool]:
    """Create user if missing.
    Returns (created, updated)."""
    user = session.query(User).filter_by(email=email).first()
    if user:
        if force:
            user.hashed_password = routes.get_password_hash(PLAINTEXT_PASSWORD)
            user.role = role
            if not user.onboarded:
                user.onboarded = True
            updated = True
        else:
            updated = False
        return False, updated
    user = User(
        email=email,
        hashed_password=routes.get_password_hash(PLAINTEXT_PASSWORD),
        first_name="Dev" if role == "admin" else "Staff",
        last_name="User",
        phone=None,
        onboarded=True,
        created_at=datetime.utcnow(),
        tenant_id=DEFAULT_TENANT_ID,
        role=role,
    )
    session.add(user)
    return True, False


def main():
    force = "--force-update" in sys.argv
    with SessionLocal() as session:
        ensure_tenant(session)
        created_admin, updated_admin = upsert_user(session, DEV_ADMIN_EMAIL, "admin", force)
        created_staff, updated_staff = upsert_user(session, STAFF_EMAIL, "staff", force)
        session.commit()

    def status(created: bool, updated: bool) -> str:
        if created:
            return "created"
        if updated:
            return "updated"
        return "skipped (exists)"

    print("Developer(admin) user:", DEV_ADMIN_EMAIL, status(created_admin, updated_admin))
    print("Staff user:", STAFF_EMAIL, status(created_staff, updated_staff))
    if force:
        print("Passwords/roles forced to update.")
    print("Done. You can now login with the provided credentials.")


if __name__ == "__main__":
    main()
