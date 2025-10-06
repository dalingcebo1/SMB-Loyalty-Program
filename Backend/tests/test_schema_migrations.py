import os
import pytest
from sqlalchemy import inspect
from app.core.database import engine, SessionLocal
from app.models import Tenant, User, Service, Order
from app.plugins.auth.routes import get_password_hash

@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Ensure Alembic migrations are applied before tests.
    Intentionally tolerant: fails hard only if required columns missing after attempt.
    """
    try:
        from alembic.config import Config
        from alembic import command
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        ini_path = os.path.join(backend_dir, 'alembic.ini')
        if os.path.exists(ini_path):
            cfg = Config(ini_path)
            command.upgrade(cfg, 'head')
    except Exception as e:  # pragma: no cover
        print(f"[WARN] Alembic upgrade attempt failed/skipped: {e}")

    inspector = inspect(engine)
    required = {
        ('orders', 'tenant_id'),
        ('orders', 'order_redeemed_at'),
        ('services', 'loyalty_eligible'),
        ('payments', 'source'),
        ('tenants', 'logo_url'),
        ('tenants', 'theme_color'),
    }
    missing = []
    tables = set(inspector.get_table_names())
    for table, col in required:
        if table not in tables:
            missing.append(f"table:{table}")
            continue
        cols = {c['name'] for c in inspector.get_columns(table)}
        if col not in cols:
            missing.append(f"{table}.{col}")
    if missing:
        raise RuntimeError(f"Schema missing required migrated objects: {missing}")


def test_required_columns_present():
    inspector = inspect(engine)
    # Spot check orders table
    orders_cols = {c['name'] for c in inspector.get_columns('orders')}
    assert 'tenant_id' in orders_cols
    assert 'order_redeemed_at' in orders_cols
    services_cols = {c['name'] for c in inspector.get_columns('services')}
    assert 'loyalty_eligible' in services_cols
    payments_cols = {c['name'] for c in inspector.get_columns('payments')}
    assert 'source' in payments_cols


def test_order_creation_sets_tenant_id():
    db = SessionLocal()
    try:
        t = Tenant(id='schema_test', name='SchemaTest', loyalty_type='standard')
        db.add(t); db.flush()
        u = User(email='schema_user@example.com', hashed_password=get_password_hash('pass'), tenant_id=t.id, role='user', onboarded=True)
        db.add(u); db.flush()
        svc = Service(category='wash', name='Schema Wash', base_price=500, loyalty_eligible=True)
        db.add(svc); db.flush()
        o = Order(service_id=svc.id, quantity=1, extras=[], status='pending', user_id=u.id, tenant_id=t.id, type='paid', amount=500)
        db.add(o); db.commit(); db.refresh(o)
        assert o.tenant_id == t.id
    finally:
        db.close()
