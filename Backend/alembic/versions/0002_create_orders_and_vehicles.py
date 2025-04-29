"""Create vehicles, orders, order_items, order_vehicles

Revision ID: 0002_create_orders_and_vehicles
Revises: 0001_add_user_id_to_users
Create Date: 2025-04-29 10:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_create_orders_and_vehicles'
down_revision = '0001_add_user_id_to_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'vehicles',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('plate', sa.String(), nullable=False, unique=True),
        sa.Column('make', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('total_amount', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_table(
        'order_items',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('extras', sa.JSON(), nullable=True),
        sa.Column('line_total', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'],   ['orders.id']),
        sa.ForeignKeyConstraint(['service_id'], ['services.id']),
    )
    op.create_table(
        'order_vehicles',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'],   ['orders.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
    )


def downgrade() -> None:
    op.drop_table('order_vehicles')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('vehicles')
