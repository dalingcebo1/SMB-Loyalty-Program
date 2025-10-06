"""add tenant integrations table

Revision ID: 20251004_add_tenant_integrations
Revises: 20250901_add_tenant_branding
Create Date: 2025-10-04
"""
from __future__ import annotations

from datetime import datetime
import json
from typing import Any, Dict

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20251004_add_tenant_integrations"
down_revision = "20250901_add_tenant_branding"
branch_labels = None
depends_on = None


TENANT_INTEGRATIONS = "tenant_integrations"


def upgrade() -> None:
    op.create_table(
        TENANT_INTEGRATIONS,
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("secrets", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "category", "provider", name="uq_tenant_category_provider"),
    )
    op.create_index(
        "ix_tenant_integrations_tenant_id",
        TENANT_INTEGRATIONS,
        ["tenant_id"],
    )

    connection = op.get_bind()
    tenants = connection.execute(sa.text("SELECT id, config FROM tenants"))
    insert_sql = sa.text(
        """
        INSERT INTO tenant_integrations
        (tenant_id, category, provider, config, secrets, created_at, updated_at)
        VALUES
        (:tenant_id, :category, :provider, :config, :secrets, :created_at, :updated_at)
        """
    )

    now = datetime.utcnow()
    for tenant_id, config in tenants:
        cfg: Dict[str, Any] = config or {}

        email_cfg = dict(cfg.get("email") or {})
        if email_cfg:
            provider = (email_cfg.get("provider") or "sendgrid").lower()
            secret_val = email_cfg.pop("sendgrid_api_key", None)
            secrets_payload = {}
            if secret_val:
                secrets_payload["api_key"] = {
                    "vault_name": f"tenant-{tenant_id}-sendgrid-api-key",
                    "fallback": secret_val,
                }
            connection.execute(
                insert_sql,
                {
                    "tenant_id": tenant_id,
                    "category": "email",
                    "provider": provider,
                    "config": json.dumps(email_cfg),
                    "secrets": json.dumps(secrets_payload),
                    "created_at": now,
                    "updated_at": now,
                },
            )

        payments_cfg = dict(cfg.get("payments") or {})
        if payments_cfg:
            provider = (payments_cfg.get("provider") or "yoco").lower()
            secret_val = payments_cfg.pop("secret_key", None)
            webhook_secret = payments_cfg.pop("webhook_secret", None)
            secrets_payload = {}
            if secret_val:
                secrets_payload["secret_key"] = {
                    "vault_name": f"tenant-{tenant_id}-{provider}-secret",
                    "fallback": secret_val,
                }
            if webhook_secret:
                secrets_payload["webhook_secret"] = {
                    "vault_name": f"tenant-{tenant_id}-{provider}-webhook",
                    "fallback": webhook_secret,
                }
            connection.execute(
                insert_sql,
                {
                    "tenant_id": tenant_id,
                    "category": "payments",
                    "provider": provider,
                    "config": json.dumps(payments_cfg),
                    "secrets": json.dumps(secrets_payload),
                    "created_at": now,
                    "updated_at": now,
                },
            )


def downgrade() -> None:
    op.drop_index("ix_tenant_integrations_tenant_id", table_name=TENANT_INTEGRATIONS)
    op.drop_table(TENANT_INTEGRATIONS)
