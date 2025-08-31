import pytest
from app.core.database import engine, SessionLocal

postgres_only = pytest.mark.skipif(engine.url.get_backend_name() != 'postgresql', reason='RLS only meaningful on Postgres')

TENANT_TABLES = [
    'users', 'rewards', 'orders', 'visit_counts', 'point_balances', 'redemptions',
    'payments', 'order_items', 'order_vehicles', 'aggregated_customer_metrics'
]
CRUD = ['select', 'insert', 'update', 'delete']

@postgres_only
def test_all_rls_policies_present():
    db = SessionLocal()
    for table in TENANT_TABLES:
        rows = db.execute(
            "SELECT policyname, cmd FROM pg_policies WHERE tablename = :t",
            {"t": table}
        ).fetchall()
        found = {(r.policyname, r.cmd.lower()) for r in rows}
        for action in CRUD:
            pname = f"{table}_tenant_{action}"
            assert any(pname == n and action == cmd for n, cmd in found), f"Missing policy {pname}"
    db.close()
