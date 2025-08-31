"""enable RLS for tenant isolated tables

Revision ID: 20250831_enable_rls
Revises: 20250831_autogen_multivertical
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250831_enable_rls'
down_revision = '20250831_autogen_multivertical'
branch_labels = None
depends_on = None

TENANT_TABLES = [
    'users', 'rewards', 'orders', 'visit_counts', 'point_balances', 'redemptions',
    'payments', 'order_items', 'order_vehicles', 'aggregated_customer_metrics'
]

# Only apply if using PostgreSQL; guard with simple dialect check in runtime if needed.

def upgrade():
    # Enable RLS and add policies referencing custom GUC app.tenant_id
    for table in TENANT_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Drop if exists to allow re-run idempotently (safe in dev)
        for action in ("select", "insert", "update", "delete"):
            op.execute(f"DROP POLICY IF EXISTS {table}_tenant_{action} ON {table}")
        match_expr = "tenant_id::text = current_setting('app.tenant_id', true)"
        # SELECT
        op.execute(
            f"CREATE POLICY {table}_tenant_select ON {table} FOR SELECT USING ({match_expr})"
        )
        # INSERT
        op.execute(
            f"CREATE POLICY {table}_tenant_insert ON {table} FOR INSERT WITH CHECK ({match_expr})"
        )
        # UPDATE
        op.execute(
            f"CREATE POLICY {table}_tenant_update ON {table} FOR UPDATE USING ({match_expr}) WITH CHECK ({match_expr})"
        )
        # DELETE
        op.execute(
            f"CREATE POLICY {table}_tenant_delete ON {table} FOR DELETE USING ({match_expr})"
        )


def downgrade():
    for table in TENANT_TABLES:
        for action in ("select", "insert", "update", "delete"):
            op.execute(f"DROP POLICY IF EXISTS {table}_tenant_{action} ON {table}")
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
