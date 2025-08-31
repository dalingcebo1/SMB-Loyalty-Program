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
    # Enable RLS and add policy referencing custom GUC app.tenant_id
    for table in TENANT_TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        # Drop if exists to allow re-run idempotently (safe in dev)
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} FOR SELECT USING (tenant_id::text = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true))"
        )


def downgrade():
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
