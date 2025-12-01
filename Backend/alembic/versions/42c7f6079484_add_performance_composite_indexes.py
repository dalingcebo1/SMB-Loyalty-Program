"""add_performance_composite_indexes

Revision ID: 42c7f6079484
Revises: 41b3557b61f7
Create Date: 2025-12-01 19:17:13.165965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42c7f6079484'
down_revision: Union[str, None] = '41b3557b61f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite indexes for common query patterns based on actual schema.
    
    These indexes improve performance for:
    - Dashboard queries (tenant + status + created_at)
    - Timeline queries (user + created_at)
    - Analytics (tenant + action + created_at)
    - Filtered queries (partial indexes for common WHERE clauses)
    """
    
    # Note: Using CREATE INDEX (not CONCURRENTLY) since we're in dev/test environment
    # For production, consider using CONCURRENTLY or run during low-traffic window
    
    # 1. Orders: Common dashboard query pattern (tenant + status + created_at)
    op.create_index(
        'ix_orders_tenant_status_created',
        'orders',
        ['tenant_id', 'status', 'created_at'],
        unique=False
    )
    
    # 2. Orders: Partial index for non-null started_at (analytics queries)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_started_at_notnull 
        ON orders(started_at) 
        WHERE started_at IS NOT NULL
    """)
    
    # 3. Notifications: User timeline queries
    op.create_index(
        'ix_notifications_user_created',
        'notifications',
        ['user_id', 'created_at'],
        unique=False
    )
    
    # 4. Notifications: Partial index for unread notifications (very common query)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_notifications_user_unread 
        ON notifications(user_id, created_at) 
        WHERE read_at IS NULL
    """)
    
    # 5. Redemptions: Tenant analytics queries
    op.create_index(
        'ix_redemptions_tenant_created',
        'redemptions',
        ['tenant_id', 'created_at'],
        unique=False
    )
    
    # 6. Vehicles: User lookup (no created_at column in vehicles table)
    op.create_index(
        'ix_vehicles_user_id',
        'vehicles',
        ['user_id'],
        unique=False
    )
    
    # 7. Audit logs: Compliance and analytics queries
    op.create_index(
        'ix_audit_logs_tenant_action_created',
        'audit_logs',
        ['tenant_id', 'action', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    """Remove composite indexes."""
    
    # Drop in reverse order
    op.drop_index('ix_audit_logs_tenant_action_created', table_name='audit_logs')
    op.drop_index('ix_vehicles_user_id', table_name='vehicles')
    op.drop_index('ix_redemptions_tenant_created', table_name='redemptions')
    op.execute('DROP INDEX IF EXISTS ix_notifications_user_unread')
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.execute('DROP INDEX IF EXISTS ix_orders_started_at_notnull')
    op.drop_index('ix_orders_tenant_status_created', table_name='orders')
