"""add performance indexes (Phase 6)

Revision ID: 20250829_add_perf_indexes
Revises: 871a3def7395
Create Date: 2025-08-29

"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20250829_add_perf_indexes'
down_revision: Union[str, None] = '871a3def7395'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # These indexes accelerate dashboard analytics & wash history ranges
    with op.batch_alter_table('orders') as batch:
        batch.create_index('ix_orders_started_at', ['started_at'])
        batch.create_index('ix_orders_ended_at', ['ended_at'])
    with op.batch_alter_table('payments') as batch:
        batch.create_index('ix_payments_created_at', ['created_at'])
        batch.create_index('ix_payments_status_created_at', ['status', 'created_at'])
    with op.batch_alter_table('order_vehicles') as batch:
        batch.create_index('ix_order_vehicles_order_vehicle', ['order_id', 'vehicle_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('order_vehicles') as batch:
        batch.drop_index('ix_order_vehicles_order_vehicle')
    with op.batch_alter_table('payments') as batch:
        batch.drop_index('ix_payments_status_created_at')
        batch.drop_index('ix_payments_created_at')
    with op.batch_alter_table('orders') as batch:
        batch.drop_index('ix_orders_ended_at')
        batch.drop_index('ix_orders_started_at')
