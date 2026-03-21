"""add_padel_court_booking_models

Revision ID: fb26681fb449
Revises: 38104d9314b0
Create Date: 2026-02-05 11:58:40.360276

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb26681fb449'
down_revision: Union[str, None] = '38104d9314b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create padel court, pricing, equipment, booking, and booking-equipment tables."""
    # --- padel_courts ---
    op.create_table(
        'padel_courts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('court_number', sa.String(50), nullable=False),
        sa.Column('court_type', sa.String(50), nullable=True),
        sa.Column('surface_type', sa.String(50), nullable=True),
        sa.Column('has_lighting', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('base_price_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('maintenance_mode', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )
    op.create_index(op.f('ix_padel_courts_id'), 'padel_courts', ['id'])
    op.create_index(op.f('ix_padel_courts_tenant_id'), 'padel_courts', ['tenant_id'])
    op.create_index('ix_padel_courts_tenant_active', 'padel_courts', ['tenant_id', 'active'])

    # --- court_pricing ---
    op.create_table(
        'court_pricing',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('court_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('price_per_hour_cents', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(100), nullable=True),
        sa.Column('priority', sa.Integer(), server_default='0'),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['court_id'], ['padel_courts.id']),
    )
    op.create_index(op.f('ix_court_pricing_id'), 'court_pricing', ['id'])
    op.create_index(op.f('ix_court_pricing_court_id'), 'court_pricing', ['court_id'])
    op.create_index('ix_court_pricing_court_day', 'court_pricing', ['court_id', 'day_of_week'])

    # --- padel_equipment ---
    op.create_table(
        'padel_equipment',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('equipment_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('quantity_available', sa.Integer(), server_default='1'),
        sa.Column('rental_price_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )
    op.create_index(op.f('ix_padel_equipment_id'), 'padel_equipment', ['id'])
    op.create_index(op.f('ix_padel_equipment_tenant_id'), 'padel_equipment', ['tenant_id'])
    op.create_index('ix_padel_equipment_tenant_type', 'padel_equipment', ['tenant_id', 'equipment_type'])

    # --- court_bookings ---
    op.create_table(
        'court_bookings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('court_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('court_price_cents', sa.Integer(), nullable=False),
        sa.Column('equipment_price_cents', sa.Integer(), server_default='0'),
        sa.Column('total_price_cents', sa.Integer(), nullable=False),
        sa.Column('player_count', sa.Integer(), server_default='4'),
        sa.Column('player_names', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('customer_notes', sa.Text(), nullable=True),
        sa.Column('staff_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.Column('paid', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('reminder_sent', sa.Boolean(), server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['court_id'], ['padel_courts.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id']),
    )
    op.create_index(op.f('ix_court_bookings_id'), 'court_bookings', ['id'])
    op.create_index(op.f('ix_court_bookings_tenant_id'), 'court_bookings', ['tenant_id'])
    op.create_index(op.f('ix_court_bookings_court_id'), 'court_bookings', ['court_id'])
    op.create_index(op.f('ix_court_bookings_customer_id'), 'court_bookings', ['customer_id'])
    op.create_index(op.f('ix_court_bookings_booking_date'), 'court_bookings', ['booking_date'])
    op.create_index('ix_court_bookings_date_court', 'court_bookings', ['booking_date', 'court_id'])
    op.create_index('ix_court_bookings_customer', 'court_bookings', ['customer_id', 'booking_date'])
    op.create_index('ix_court_bookings_status', 'court_bookings', ['tenant_id', 'status'])

    # --- booking_equipment ---
    op.create_table(
        'booking_equipment',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('booking_id', sa.Integer(), nullable=False),
        sa.Column('equipment_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('price_cents', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['court_bookings.id']),
        sa.ForeignKeyConstraint(['equipment_id'], ['padel_equipment.id']),
    )
    op.create_index(op.f('ix_booking_equipment_id'), 'booking_equipment', ['id'])
    op.create_index(op.f('ix_booking_equipment_booking_id'), 'booking_equipment', ['booking_id'])
    op.create_index(op.f('ix_booking_equipment_equipment_id'), 'booking_equipment', ['equipment_id'])
    op.create_index('ix_booking_equipment_booking', 'booking_equipment', ['booking_id'])


def downgrade() -> None:
    """Drop padel court booking tables in reverse dependency order."""
    op.drop_table('booking_equipment')
    op.drop_table('court_bookings')
    op.drop_table('padel_equipment')
    op.drop_table('court_pricing')
    op.drop_table('padel_courts')
