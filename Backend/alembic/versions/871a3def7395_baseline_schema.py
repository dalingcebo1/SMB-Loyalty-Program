"""baseline schema

Revision ID: 871a3def7395
Revises: 
Create Date: 2025-05-06 13:15:43.484532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '871a3def7395'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: create base tables and indexes for a fresh database."""
    # Create base tables (in dependency order)
    op.create_table(
        'tenants',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('loyalty_type', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.PrimaryKeyConstraint('id', name='tenants_pkey'),
        postgresql_ignore_search_path=False,
    )

    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('email', sa.VARCHAR(), nullable=True),
        sa.Column('phone', sa.VARCHAR(), nullable=True),
        sa.Column('hashed_password', sa.VARCHAR(), nullable=True),
        sa.Column('first_name', sa.VARCHAR(), nullable=True),
        sa.Column('last_name', sa.VARCHAR(), nullable=True),
        sa.Column('onboarded', sa.BOOLEAN(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='users_tenant_id_fkey'),
        postgresql_ignore_search_path=False,
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_phone', 'users', ['phone'], unique=True)

    op.create_table(
        'services',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('category', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('base_price', sa.INTEGER(), nullable=False),
        postgresql_ignore_search_path=False,
    )
    # Keep these non-unique indexes to match legacy expectations
    op.create_index('ix_services_id', 'services', ['id'], unique=False)
    op.create_index('ix_services_category', 'services', ['category'], unique=False)

    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('service_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('extras', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.VARCHAR(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.Column('started_at', postgresql.TIMESTAMP(), nullable=True),
        sa.Column('ended_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], name='orders_service_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='orders_user_id_fkey'),
    )

    op.create_table(
        'extras',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('price_map', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id', name='extras_pkey'),
    )
    op.create_index('ix_extras_id', 'extras', ['id'], unique=False)

    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('method', sa.VARCHAR(), nullable=False),
        sa.Column('status', sa.VARCHAR(), nullable=True),
        sa.Column('transaction_id', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name='payments_order_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='payments_pkey'),
    )

    op.create_table(
        'point_balances',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='point_balances_tenant_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='point_balances_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='point_balances_pkey'),
    )

    op.create_table(
        'visit_counts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('updated_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='visit_counts_tenant_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='visit_counts_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='visit_counts_pkey'),
    )

    op.create_table(
        'vehicles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('plate', sa.VARCHAR(), nullable=False),
        sa.Column('make', sa.VARCHAR(), nullable=True),
        sa.Column('model', sa.VARCHAR(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='vehicles_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='vehicles_pkey'),
        sa.UniqueConstraint('plate', name='uq_vehicle_plate'),
    )

    op.create_table(
        'order_vehicles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name='order_vehicles_order_id_fkey'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], name='order_vehicles_vehicle_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='order_vehicles_pkey'),
    )

    op.create_table(
        'rewards',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.Column('title', sa.VARCHAR(), nullable=False),
        sa.Column('description', sa.TEXT(), nullable=True),
        sa.Column('type', sa.VARCHAR(), nullable=False),
        sa.Column('milestone', sa.Integer(), nullable=True),
        sa.Column('cost', sa.Integer(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='rewards_tenant_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='rewards_pkey'),
        postgresql_ignore_search_path=False,
    )

    op.create_table(
        'redemptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('reward_id', sa.Integer(), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['reward_id'], ['rewards.id'], name='redemptions_reward_id_fkey'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='redemptions_tenant_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='redemptions_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='redemptions_pkey'),
    )
    
    # Additional baseline tables used by the app
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.VARCHAR(), nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.VARCHAR(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.VARCHAR(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.VARCHAR(), nullable=False),
        sa.Column('action_url', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(), nullable=False),
        sa.Column('read_at', postgresql.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='notifications_tenant_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='notifications_user_id_fkey'),
    )
    op.create_index('ix_notifications_tenant_id', 'notifications', ['tenant_id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_type', 'notifications', ['type'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema: drop objects created in upgrade."""
    # Drop in reverse dependency order
    # Drop indexes before tables where needed
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_type', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_index('ix_notifications_tenant_id', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_table('redemptions')
    op.drop_table('rewards')
    op.drop_table('order_vehicles')
    op.drop_table('vehicles')
    op.drop_table('visit_counts')
    op.drop_table('point_balances')
    op.drop_table('payments')
    op.drop_index('ix_extras_id', table_name='extras')
    op.drop_table('extras')
    op.drop_table('orders')
    op.drop_index('ix_services_category', table_name='services')
    op.drop_index('ix_services_id', table_name='services')
    op.drop_table('services')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_phone', table_name='users')
    op.drop_table('users')
    op.drop_table('tenants')
    # ### end Alembic commands ###
