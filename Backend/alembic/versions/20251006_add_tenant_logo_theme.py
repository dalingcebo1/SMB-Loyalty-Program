"""add tenant logo and theme columns

Revision ID: 20251006_add_tenant_logo_theme
Revises: 20251006_add_tenant_subdomain
Create Date: 2025-10-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20251006_add_tenant_logo_theme"
down_revision = "20251006_add_tenant_subdomain"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "tenants" not in inspector.get_table_names():
        return

    with op.batch_alter_table("tenants") as batch:
        if not _has_column(inspector, "tenants", "logo_url"):
            batch.add_column(sa.Column("logo_url", sa.String(), nullable=True))
        if not _has_column(inspector, "tenants", "theme_color"):
            batch.add_column(sa.Column("theme_color", sa.String(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "tenants" not in inspector.get_table_names():
        return

    with op.batch_alter_table("tenants") as batch:
        if _has_column(inspector, "tenants", "theme_color"):
            batch.drop_column("theme_color")
        if _has_column(inspector, "tenants", "logo_url"):
            batch.drop_column("logo_url")
