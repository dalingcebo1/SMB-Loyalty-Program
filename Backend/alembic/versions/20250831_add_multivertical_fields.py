"""add multi-vertical fields to tenants

Revision ID: 20250831_mv_fields
Revises: 20250830_acm
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250831_mv_fields'
down_revision = '20250830_acm'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('tenants') as batch:
        batch.add_column(sa.Column('vertical_type', sa.String(), nullable=False, server_default='carwash'))
        batch.add_column(sa.Column('primary_domain', sa.String(), nullable=True))
        batch.add_column(sa.Column('config', sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")))
        batch.create_index('ix_tenants_vertical_domain', ['vertical_type', 'primary_domain'])
    # Optional: ensure server_default replaced to avoid future diffs
    op.execute("ALTER TABLE tenants ALTER COLUMN vertical_type DROP DEFAULT")
    op.execute("ALTER TABLE tenants ALTER COLUMN config DROP DEFAULT")


def downgrade():
    with op.batch_alter_table('tenants') as batch:
        batch.drop_index('ix_tenants_vertical_domain')
        batch.drop_column('config')
        batch.drop_column('primary_domain')
        batch.drop_column('vertical_type')
