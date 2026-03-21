"""add onboarding_completed to tenants

Revision ID: 20260321_onboarding
Revises: ac2175519b17
Create Date: 2026-03-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260321_onboarding"
down_revision = "ac2175519b17"
branch_labels = None
depends_on = None


def _has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not _has_column(inspector, "tenants", "onboarding_completed"):
        op.add_column(
            "tenants",
            sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _has_column(inspector, "tenants", "onboarding_completed"):
        op.drop_column("tenants", "onboarding_completed")
