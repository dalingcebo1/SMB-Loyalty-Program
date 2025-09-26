"""add tenant branding table

Revision ID: 20250901_add_tenant_branding
Revises: 20250901_tenant_loyalty_pay
Create Date: 2025-09-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250901_add_tenant_branding'
down_revision = '20250901_tenant_loyalty_pay'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'tenant_branding',
        sa.Column('tenant_id', sa.String(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('public_name', sa.String(), nullable=True),
        sa.Column('short_name', sa.String(), nullable=True),
        sa.Column('primary_color', sa.String(), nullable=True),
        sa.Column('secondary_color', sa.String(), nullable=True),
        sa.Column('accent_color', sa.String(), nullable=True),
        sa.Column('logo_light_url', sa.String(), nullable=True),
        sa.Column('logo_dark_url', sa.String(), nullable=True),
        sa.Column('favicon_url', sa.String(), nullable=True),
        sa.Column('app_icon_url', sa.String(), nullable=True),
        sa.Column('support_email', sa.String(), nullable=True),
        sa.Column('support_phone', sa.String(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('extra', sa.JSON(), nullable=False, server_default=sa.text("'{}'"))
    )


def downgrade():
    op.drop_table('tenant_branding')
