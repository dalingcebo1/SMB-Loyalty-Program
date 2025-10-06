"""add tenant subdomain column

Revision ID: 20251006_add_tenant_subdomain
Revises: 20251004_add_tenant_integrations
Create Date: 2025-10-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20251006_add_tenant_subdomain"
down_revision = "20251004_add_tenant_integrations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("subdomain", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "subdomain")
