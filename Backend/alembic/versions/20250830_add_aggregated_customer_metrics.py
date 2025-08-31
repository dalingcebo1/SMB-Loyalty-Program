"""add aggregated_customer_metrics table

Revision ID: 20250830_add_agg_customer_metrics
Revises: 
Create Date: 2025-08-30
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '20250830_add_agg_customer_metrics'
down_revision = '20250829_add_perf_indexes'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'aggregated_customer_metrics',
        sa.Column('user_id', sa.Integer(), primary_key=True),
        sa.Column('last_visit_at', sa.DateTime(), nullable=True),
        sa.Column('first_visit_at', sa.DateTime(), nullable=True),
        sa.Column('lifetime_washes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('lifetime_revenue', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('washes_30d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('washes_90d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('revenue_30d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('revenue_90d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('loyalty_washes_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('loyalty_washes_30d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('points_redeemed_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('points_outstanding', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('points_redeemed_30d', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('r_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('f_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('m_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('segment', sa.String(), nullable=True),
        sa.Column('snapshot_at', sa.DateTime(), nullable=True, default=datetime.utcnow),
        sa.Column('tenant_id', sa.String(), nullable=True),
    )
    op.create_index('ix_acm_last_visit', 'aggregated_customer_metrics', ['last_visit_at'])
    op.create_index('ix_acm_segment', 'aggregated_customer_metrics', ['segment'])


def downgrade():
    op.drop_index('ix_acm_last_visit', table_name='aggregated_customer_metrics')
    op.drop_index('ix_acm_segment', table_name='aggregated_customer_metrics')
    op.drop_table('aggregated_customer_metrics')
