"""Initial carwash vertical schema

Revision ID: carwash_001_initial
Revises: 
Create Date: 2025-12-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'carwash_001_initial'
down_revision = None
branch_labels = ('carwash',)
depends_on = None


def upgrade() -> None:
    # Create vehicles table
    op.create_table(
        'vehicles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('license_plate', sa.String(), nullable=False),
        sa.Column('make', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vehicles_tenant_id'), 'vehicles', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_vehicles_user_id'), 'vehicles', ['user_id'], unique=False)
    op.create_index(op.f('ix_vehicles_license_plate'), 'vehicles', ['license_plate'], unique=False)
    
    # Create wash_packages table
    op.create_table(
        'wash_packages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True, server_default=sa.text('30')),
        sa.Column('features', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('points_awarded', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wash_packages_tenant_id'), 'wash_packages', ['tenant_id'], unique=False)
    
    # Create carwash_memberships table
    op.create_table(
        'carwash_memberships',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tier', sa.String(), nullable=False),
        sa.Column('monthly_price_cents', sa.Integer(), nullable=False),
        sa.Column('washes_per_month', sa.Integer(), nullable=True, server_default=sa.text('4')),
        sa.Column('discount_percentage', sa.Float(), nullable=True, server_default=sa.text('0.0')),
        sa.Column('priority_service', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('status', sa.String(), nullable=True, server_default=sa.text("'active'")),
        sa.Column('billing_day', sa.Integer(), nullable=True, server_default=sa.text('1')),
        sa.Column('next_billing_date', sa.DateTime(), nullable=True),
        sa.Column('washes_used_this_month', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('last_reset_date', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_carwash_memberships_tenant_id'), 'carwash_memberships', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_carwash_memberships_user_id'), 'carwash_memberships', ['user_id'], unique=False)
    
    # Create wash_history table
    op.create_table(
        'wash_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), nullable=True),
        sa.Column('order_id', sa.String(), nullable=True),
        sa.Column('package_id', sa.Integer(), nullable=True),
        sa.Column('service_date', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('service_type', sa.String(), nullable=False),
        sa.Column('staff_user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True, server_default=sa.text("'pending'")),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('quality_rating', sa.Integer(), nullable=True),
        sa.Column('customer_notes', sa.Text(), nullable=True),
        sa.Column('staff_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.ForeignKeyConstraint(['package_id'], ['wash_packages.id'], ),
        sa.ForeignKeyConstraint(['staff_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wash_history_tenant_id'), 'wash_history', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_wash_history_user_id'), 'wash_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_wash_history_vehicle_id'), 'wash_history', ['vehicle_id'], unique=False)
    op.create_index(op.f('ix_wash_history_order_id'), 'wash_history', ['order_id'], unique=False)
    op.create_index(op.f('ix_wash_history_service_date'), 'wash_history', ['service_date'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order (handle foreign keys)
    op.drop_index(op.f('ix_wash_history_service_date'), table_name='wash_history')
    op.drop_index(op.f('ix_wash_history_order_id'), table_name='wash_history')
    op.drop_index(op.f('ix_wash_history_vehicle_id'), table_name='wash_history')
    op.drop_index(op.f('ix_wash_history_user_id'), table_name='wash_history')
    op.drop_index(op.f('ix_wash_history_tenant_id'), table_name='wash_history')
    op.drop_table('wash_history')
    
    op.drop_index(op.f('ix_carwash_memberships_user_id'), table_name='carwash_memberships')
    op.drop_index(op.f('ix_carwash_memberships_tenant_id'), table_name='carwash_memberships')
    op.drop_table('carwash_memberships')
    
    op.drop_index(op.f('ix_wash_packages_tenant_id'), table_name='wash_packages')
    op.drop_table('wash_packages')
    
    op.drop_index(op.f('ix_vehicles_license_plate'), table_name='vehicles')
    op.drop_index(op.f('ix_vehicles_user_id'), table_name='vehicles')
    op.drop_index(op.f('ix_vehicles_tenant_id'), table_name='vehicles')
    op.drop_table('vehicles')
