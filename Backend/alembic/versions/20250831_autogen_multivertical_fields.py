"""autogen multi-vertical fields

Revision ID: 20250831_autogen_multivertical
Revises: 20250830_add_agg_customer_metrics
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250831_autogen_multivertical'
down_revision = '20250830_add_agg_customer_metrics'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('tenants') as batch:
        batch.add_column(sa.Column('vertical_type', sa.String(), nullable=True))
        batch.add_column(sa.Column('primary_domain', sa.String(), nullable=True))
        batch.add_column(sa.Column('config', sa.JSON(), nullable=True))
        batch.create_index('ix_tenants_vertical_domain', ['vertical_type', 'primary_domain'])
    # Backfill defaults
    op.execute("UPDATE tenants SET vertical_type='carwash' WHERE vertical_type IS NULL")
    op.execute("UPDATE tenants SET config='{}'::json WHERE config IS NULL")
    # Enforce not null after backfill
    with op.batch_alter_table('tenants') as batch:
        batch.alter_column('vertical_type', existing_type=sa.String(), nullable=False)
        batch.alter_column('config', existing_type=sa.JSON(), nullable=False)


def downgrade():
    with op.batch_alter_table('tenants') as batch:
        batch.drop_index('ix_tenants_vertical_domain')
        batch.drop_column('config')
        batch.drop_column('primary_domain')
        batch.drop_column('vertical_type')
