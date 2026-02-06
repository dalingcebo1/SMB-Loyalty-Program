"""add_beauty_packages_and_reviews

Revision ID: 9c93a6f761be
Revises: f288af129ebb
Create Date: 2026-02-06 09:07:38.871606

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c93a6f761be'
down_revision: Union[str, None] = 'f288af129ebb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create beauty_packages table
    op.create_table(
        'beauty_packages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.Column('discount_percent', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_duration_minutes', sa.Integer(), nullable=False),
        sa.Column('valid_from', sa.DateTime(), nullable=True),
        sa.Column('valid_until', sa.DateTime(), nullable=True),
        sa.Column('max_bookings', sa.Integer(), nullable=True),
        sa.Column('current_bookings', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('online_booking_enabled', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('requires_deposit', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('deposit_cents', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('points_multiplier', sa.Float(), nullable=True, server_default='1.0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_beauty_packages_tenant_active', 'beauty_packages', ['tenant_id', 'active'])
    
    # Create beauty_package_services association table
    op.create_table(
        'beauty_package_services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('package_id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['package_id'], ['beauty_packages.id'], ),
        sa.ForeignKeyConstraint(['service_id'], ['beauty_services.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_package_service', 'beauty_package_services', ['package_id', 'service_id'], unique=True)
    
    # Create beauty_package_bookings table
    op.create_table(
        'beauty_package_bookings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('package_id', sa.Integer(), nullable=False),
        sa.Column('package_name', sa.String(length=200), nullable=False),
        sa.Column('price_paid_cents', sa.Integer(), nullable=False),
        sa.Column('deposit_paid_cents', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('booked_at', sa.DateTime(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('customer_notes', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['package_id'], ['beauty_packages.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_package_bookings_customer', 'beauty_package_bookings', ['tenant_id', 'customer_id'])
    op.create_index('ix_package_bookings_status', 'beauty_package_bookings', ['tenant_id', 'status'])
    op.create_index(op.f('ix_beauty_package_bookings_booked_at'), 'beauty_package_bookings', ['booked_at'])
    
    # Create beauty_service_reviews table
    op.create_table(
        'beauty_service_reviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('appointment_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('stylist_id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('overall_rating', sa.Integer(), nullable=False),
        sa.Column('service_quality_rating', sa.Integer(), nullable=True),
        sa.Column('stylist_rating', sa.Integer(), nullable=True),
        sa.Column('cleanliness_rating', sa.Integer(), nullable=True),
        sa.Column('value_rating', sa.Integer(), nullable=True),
        sa.Column('review_text', sa.Text(), nullable=True),
        sa.Column('review_title', sa.String(length=200), nullable=True),
        sa.Column('approved', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('featured', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('flagged', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('moderation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['stylist_id'], ['stylists.id'], ),
        sa.ForeignKeyConstraint(['service_id'], ['beauty_services.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('appointment_id')
    )
    op.create_index('ix_reviews_tenant_approved', 'beauty_service_reviews', ['tenant_id', 'approved'])
    op.create_index('ix_reviews_stylist', 'beauty_service_reviews', ['stylist_id', 'approved'])
    op.create_index('ix_reviews_service', 'beauty_service_reviews', ['service_id', 'approved'])
    op.create_index(op.f('ix_beauty_service_reviews_created_at'), 'beauty_service_reviews', ['created_at'])
    
    # Create beauty_appointment_reminders table
    op.create_table(
        'beauty_appointment_reminders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('appointment_id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('reminder_type', sa.String(length=20), nullable=False),
        sa.Column('hours_before', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('external_id', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_reminders_status', 'beauty_appointment_reminders', ['tenant_id', 'status'])
    op.create_index('ix_reminders_appointment', 'beauty_appointment_reminders', ['appointment_id'])
    op.create_index(op.f('ix_beauty_appointment_reminders_created_at'), 'beauty_appointment_reminders', ['created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_reminders_appointment', table_name='beauty_appointment_reminders')
    op.drop_index('ix_reminders_status', table_name='beauty_appointment_reminders')
    op.drop_index(op.f('ix_beauty_appointment_reminders_created_at'), table_name='beauty_appointment_reminders')
    op.drop_table('beauty_appointment_reminders')
    
    op.drop_index('ix_reviews_service', table_name='beauty_service_reviews')
    op.drop_index('ix_reviews_stylist', table_name='beauty_service_reviews')
    op.drop_index('ix_reviews_tenant_approved', table_name='beauty_service_reviews')
    op.drop_index(op.f('ix_beauty_service_reviews_created_at'), table_name='beauty_service_reviews')
    op.drop_table('beauty_service_reviews')
    
    op.drop_index('ix_package_bookings_status', table_name='beauty_package_bookings')
    op.drop_index('ix_package_bookings_customer', table_name='beauty_package_bookings')
    op.drop_index(op.f('ix_beauty_package_bookings_booked_at'), table_name='beauty_package_bookings')
    op.drop_table('beauty_package_bookings')
    
    op.drop_index('ix_package_service', table_name='beauty_package_services')
    op.drop_table('beauty_package_services')
    
    op.drop_index('ix_beauty_packages_tenant_active', table_name='beauty_packages')
    op.drop_table('beauty_packages')
