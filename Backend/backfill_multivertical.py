"""One-off backfill for multi-vertical fields.

Usage (run once after applying migrations):
  python -m Backend.backfill_multivertical

Logic:
  - For any tenant missing vertical_type set to 'carwash' by default.
  - Optionally map known tenant IDs to domains / vertical overrides via MAPS below.
"""
from config import settings  # ensures DATABASE_URL loaded
from app.core.database import SessionLocal
from app.models import Tenant, VerticalType

# Customize these maps before running in production if needed
TENANT_VERTICAL_MAP = {
    # 'tenant123': VerticalType.dispensary.value,
}

TENANT_DOMAIN_MAP = {
    # 'tenant123': 'mytenant.example.com',
}


def run():
    db = SessionLocal()
    updated = 0
    try:
        tenants = db.query(Tenant).all()
        for t in tenants:
            changed = False
            if not t.vertical_type:
                t.vertical_type = VerticalType.carwash.value
                changed = True
            if t.id in TENANT_VERTICAL_MAP and t.vertical_type != TENANT_VERTICAL_MAP[t.id]:
                t.vertical_type = TENANT_VERTICAL_MAP[t.id]
                changed = True
            if t.id in TENANT_DOMAIN_MAP and t.primary_domain != TENANT_DOMAIN_MAP[t.id]:
                t.primary_domain = TENANT_DOMAIN_MAP[t.id]
                changed = True
            if t.config is None:
                t.config = {}
                changed = True
            if changed:
                updated += 1
        if updated:
            db.commit()
        print(f"Backfill complete. Tenants updated: {updated}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
