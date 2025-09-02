"""placeholder migration for legacy 'add_inventory_items'

Revision ID: add_inventory_items
Revises: 20250831_add_audit_logs, 20250831_add_multivertical_fields
Create Date: 2025-09-01

This file was introduced to satisfy an existing alembic_version entry in a
development database that referenced a now-missing revision id
'add_inventory_items'. It performs no schema changes.

Subsequent real migration: 20250901_add_tenant_loyalty_payment_cols now points
to this placeholder to yield a linear upgrade path.
"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision = 'add_inventory_items'
down_revision = ('20250831_add_audit_logs', '20250831_add_multivertical_fields')
branch_labels = None
depends_on = None


def upgrade():  # pragma: no cover
    pass  # no-op


def downgrade():  # pragma: no cover
    pass  # no-op
