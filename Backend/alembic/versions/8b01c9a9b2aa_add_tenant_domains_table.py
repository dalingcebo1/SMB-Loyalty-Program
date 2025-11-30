"""add_tenant_domains_table

Revision ID: 8b01c9a9b2aa
Revises: 20251006_add_tenant_logo_theme
Create Date: 2025-11-30 11:07:53.024064

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b01c9a9b2aa'
down_revision: Union[str, None] = '20251006_add_tenant_logo_theme'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create tenant_domains table
    op.create_table(
        'tenant_domains',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('domain', sa.String(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), default=False),
        sa.Column('environment', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain')
    )
    
    # Create indexes
    op.create_index('ix_tenant_domains_lookup', 'tenant_domains', ['domain', 'tenant_id'])
    op.create_index(op.f('ix_tenant_domains_tenant_id'), 'tenant_domains', ['tenant_id'])
    op.create_index(op.f('ix_tenant_domains_domain'), 'tenant_domains', ['domain'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_tenant_domains_domain'), table_name='tenant_domains')
    op.drop_index(op.f('ix_tenant_domains_tenant_id'), table_name='tenant_domains')
    op.drop_index('ix_tenant_domains_lookup', table_name='tenant_domains')
    op.drop_table('tenant_domains')
