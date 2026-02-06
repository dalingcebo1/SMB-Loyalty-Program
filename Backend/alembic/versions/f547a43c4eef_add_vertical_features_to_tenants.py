"""add_vertical_features_to_tenants

Adds support for vertical-specific features and configuration:
- vertical_features JSONB column on tenants table for feature flags
- tenant_vertical_config table for vertical-specific settings

Revision ID: f547a43c4eef
Revises: ac2175519b17
Create Date: 2026-02-05 08:51:37.945022

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f547a43c4eef'
down_revision: Union[str, None] = 'ac2175519b17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # Add vertical_features JSONB column to tenants table
    # Stores enabled/disabled features per tenant (e.g., {"appointments": true, "inventory": false})
    op.add_column(
        'tenants',
        sa.Column(
            'vertical_features', 
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb")  # Default to empty object
        )
    )
    
    # Create tenant_vertical_config table for vertical-specific settings
    # Allows storing arbitrary vertical configuration separate from main tenant config
    op.create_table(
        'tenant_vertical_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('config_key', sa.String(100), nullable=False),
        sa.Column('config_value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()'), onupdate=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'config_key', name='uq_tenant_config_key')
    )
    
    # Add indexes for performance
    op.create_index(
        'ix_tenant_vertical_config_tenant_id',
        'tenant_vertical_config',
        ['tenant_id']
    )
    
    op.create_index(
        'ix_tenant_vertical_config_key',
        'tenant_vertical_config',
        ['config_key']
    )
    
    # Populate default vertical_features based on existing vertical_type
    # This ensures existing tenants get appropriate features enabled
    op.execute("""
        UPDATE tenants
        SET vertical_features = CASE vertical_type
            WHEN 'carwash' THEN '{"vehicle_tracking": true, "wash_packages": true, "qr_checkin": true, "membership_tiers": true, "loyalty_multiplier": true}'::jsonb
            WHEN 'retail' THEN '{"inventory": true, "pos": true, "customer_loyalty": true}'::jsonb
            WHEN 'beauty' THEN '{"appointments": true, "stylist_management": true, "service_menu": true, "client_profiles": true, "package_deals": true}'::jsonb
            WHEN 'padel' THEN '{"court_booking": true, "time_slot_management": true, "player_profiles": true, "equipment_rental": true}'::jsonb
            WHEN 'flowershop' THEN '{"product_catalog": true, "delivery_scheduling": true, "occasion_reminders": true}'::jsonb
            WHEN 'dispensary' THEN '{"product_catalog": true, "age_verification": true, "compliance_tracking": true, "batch_tracking": true}'::jsonb
            ELSE '{}'::jsonb
        END
        WHERE vertical_features IS NULL OR vertical_features = '{}'::jsonb
    """)


def downgrade() -> None:
    """Downgrade schema."""
    
    # Drop indexes
    op.drop_index('ix_tenant_vertical_config_key', table_name='tenant_vertical_config')
    op.drop_index('ix_tenant_vertical_config_tenant_id', table_name='tenant_vertical_config')
    
    # Drop tenant_vertical_config table
    op.drop_table('tenant_vertical_config')
    
    # Drop vertical_features column from tenants
    op.drop_column('tenants', 'vertical_features')
