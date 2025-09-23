"""add tenant/loyalty/payment new columns

Revision ID: 20250901_add_tenant_loyalty_payment_columns
Revises: add_inventory_items
Create Date: 2025-09-01

This migration formalizes columns that were previously introduced via a
runtime "self-heal" fallback in app.core.database:

* orders.tenant_id (nullable for historical rows; backfilled from users)
* orders.order_redeemed_at (nullable)
* services.loyalty_eligible (BOOLEAN NOT NULL DEFAULT false then drop default)
* payments.source (VARCHAR NULL; optional descriptor of payment origin)
* ix_orders_tenant_id index aligning with ORM index=True

The upgrade is idempotent: it checks for column/index existence to allow
safe execution in dev environments where the self-heal already added them.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250901_add_tenant_loyalty_payment_columns'
# Depends on placeholder merge revision that unifies previous heads
down_revision = 'add_inventory_items'
branch_labels = None
depends_on = None


def _has_column(insp, table: str, column: str) -> bool:
    return column in {c['name'] for c in insp.get_columns(table)}


def _has_index(insp, table: str, index: str) -> bool:
    return index in {i['name'] for i in insp.get_indexes(table)}


def upgrade():  # noqa: D401
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # orders table columns & index
    if 'orders' in insp.get_table_names():
        with op.batch_alter_table('orders') as batch:
            if not _has_column(insp, 'orders', 'tenant_id'):
                batch.add_column(sa.Column('tenant_id', sa.String(), nullable=True))
            if not _has_column(insp, 'orders', 'order_redeemed_at'):
                batch.add_column(sa.Column('order_redeemed_at', sa.DateTime(), nullable=True))
            if not _has_index(insp, 'orders', 'ix_orders_tenant_id'):
                batch.create_index('ix_orders_tenant_id', ['tenant_id'])
        # Backfill tenant_id from users if newly added & users table present
        if _has_column(sa.inspect(conn), 'orders', 'tenant_id') and 'users' in insp.get_table_names():
            # Only fill rows still NULL
            op.execute(
                """
                UPDATE orders
                SET tenant_id = users.tenant_id
                FROM users
                WHERE orders.user_id = users.id AND orders.tenant_id IS NULL
                """
            )

    # services.loyalty_eligible
    if 'services' in insp.get_table_names():
        added_loyalty_col = False
        with op.batch_alter_table('services') as batch:
            if not _has_column(insp, 'services', 'loyalty_eligible'):
                batch.add_column(sa.Column('loyalty_eligible', sa.Boolean(), nullable=False, server_default=sa.text('0')))
                added_loyalty_col = True
        if added_loyalty_col:
            # Drop default to match model (default handled at app layer) for Postgres
            try:
                op.execute("ALTER TABLE services ALTER COLUMN loyalty_eligible DROP DEFAULT")
            except Exception:
                pass  # Ignore on SQLite or if dialect doesn't support

    # payments.source
    if 'payments' in insp.get_table_names():
        with op.batch_alter_table('payments') as batch:
            if not _has_column(insp, 'payments', 'source'):
                batch.add_column(sa.Column('source', sa.String(), nullable=True))
        # Optional backfill: set 'yoco' where NULL and method indicates yoco
        if _has_column(sa.inspect(conn), 'payments', 'source'):
            try:
                op.execute("UPDATE payments SET source='yoco' WHERE source IS NULL AND (method='yoco' OR method='paystack')")
            except Exception:
                pass


def downgrade():  # noqa: D401
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'payments' in insp.get_table_names() and _has_column(insp, 'payments', 'source'):
        with op.batch_alter_table('payments') as batch:
            batch.drop_column('source')

    if 'services' in insp.get_table_names() and _has_column(insp, 'services', 'loyalty_eligible'):
        with op.batch_alter_table('services') as batch:
            batch.drop_column('loyalty_eligible')

    if 'orders' in insp.get_table_names():
        with op.batch_alter_table('orders') as batch:
            if _has_index(insp, 'orders', 'ix_orders_tenant_id'):
                batch.drop_index('ix_orders_tenant_id')
            if _has_column(insp, 'orders', 'order_redeemed_at'):
                batch.drop_column('order_redeemed_at')
            if _has_column(insp, 'orders', 'tenant_id'):
                batch.drop_column('tenant_id')
