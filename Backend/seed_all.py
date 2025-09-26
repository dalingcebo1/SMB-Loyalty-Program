"""Unified, idempotent seed script for local/dev environments.

Seeds (in order): schema, default tenant, services, rewards, users.

Usage:
  PYTHONPATH=Backend DATABASE_URL=sqlite:///./Backend/dev.db \
    python Backend/seed_all.py [--force-update]

Flags:
  --force-update  Force update of existing seeded users' password/role.

Exit codes: 0 success, non‑zero on failure.
"""
from __future__ import annotations

import argparse, importlib, sys, traceback
from datetime import datetime, timezone

# Ensure Backend/ root on path when executed from repo root
if 'Backend' not in sys.path[0]:  # naive guard
    sys.path.insert(0, 'Backend')

from config import settings
from app.core.database import Base, engine, SessionLocal
from app.models import Tenant  # canonical models (avoid legacy root-level models.py)


def log(msg: str):
    print(f"[seed_all] {datetime.now(timezone.utc).isoformat(timespec='seconds')} - {msg}")


def ensure_schema():
    log("Ensuring schema (create_all)…")
    Base.metadata.create_all(bind=engine)


def seed_default_tenant():
    from seed_default_tenant import seed_default as _seed, ensure_schema as _sch
    # ensure_schema already handled globally but safe / idempotent
    _sch()
    _seed()


def seed_services():
    """Import and run seed_services.seed_services()."""
    try:
        mod = importlib.import_module('seed_services')
    except Exception:
        log("Error importing seed_services module:")
        traceback.print_exc()
        return
    fn = getattr(mod, 'seed_services', None)
    if not fn:
        log("seed_services() not found in module – skipped")
        return
    try:
        fn()
    except Exception:
        log("Error executing seed_services():")
        traceback.print_exc()


def seed_rewards():
    """Import and run seed_rewards.main()."""
    try:
        mod = importlib.import_module('seed_rewards')
    except Exception:
        log("Error importing seed_rewards module:")
        traceback.print_exc()
        return
    fn = getattr(mod, 'main', None)
    if not fn:
        log("main() not found in seed_rewards – skipped")
        return
    try:
        fn()
    except Exception:
        log("Error executing seed_rewards.main():")
        traceback.print_exc()


def seed_users(force: bool):
    try:
        mod = importlib.import_module('seed_users')
        # Provide flag to underlying script logic if supports it
        if force:
            sys.argv = ['seed_users.py', '--force-update']
        else:
            sys.argv = ['seed_users.py']
        if hasattr(mod, 'main'):
            mod.main()
        else:
            log("seed_users module missing main() – skipped")
    except Exception:
        log("Error seeding users:")
        traceback.print_exc()


def summary():
    with SessionLocal() as s:
        tenant_count = s.query(Tenant).count()
    log(f"Summary: tenants={tenant_count}")


def reset_db():  # destructive
    from app.core.database import Base
    log("Dropping all tables (reset)…")
    Base.metadata.drop_all(bind=engine)
    log("Recreating tables…")
    Base.metadata.create_all(bind=engine)

def run(force_update: bool, reset: bool):
    log(f"Starting unified seed (force_update={force_update}, reset={reset}) for DB={settings.database_url}")
    if reset:
        reset_db()
    else:
        ensure_schema()
    seed_default_tenant()
    seed_services()
    seed_rewards()
    seed_users(force_update)
    summary()
    log("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--force-update', action='store_true', help='Force update existing users passwords/roles')
    parser.add_argument('--reset', action='store_true', help='Drop and recreate all tables before seeding (destructive)')
    args = parser.parse_args()
    run(args.force_update, args.reset)
