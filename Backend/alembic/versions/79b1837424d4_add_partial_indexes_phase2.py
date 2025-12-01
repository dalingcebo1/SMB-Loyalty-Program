"""add_partial_indexes_phase2

Revision ID: 79b1837424d4
Revises: 42c7f6079484
Create Date: 2025-12-01 20:15:52.769099

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79b1837424d4'
down_revision: Union[str, None] = '42c7f6079484'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add partial indexes for Phase 2 performance optimization.
    
    These indexes target common WHERE clause patterns in production:
    - Completed orders (analytics, reporting)
    - Regular users vs staff (user queries)
    - Used redemptions (analytics)
    - Priority audit actions (security monitoring)
    """
    
    # 1. Orders: Partial index for completed orders (very common in analytics)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_completed_tenant_created
        ON orders(tenant_id, created_at)
        WHERE status = 'completed'
    """)
    
    # 2. Orders: Partial index for pending/processing orders (dashboard queries)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_active_tenant_created
        ON orders(tenant_id, created_at)
        WHERE status IN ('pending', 'processing', 'ready')
    """)
    
    # 3. Users: Partial index for regular users (exclude staff)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_tenant_regular
        ON users(tenant_id, created_at)
        WHERE role = 'user'
    """)
    
    # 4. Users: Partial index for staff/admin users
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_tenant_staff
        ON users(tenant_id, created_at)
        WHERE role IN ('staff', 'admin')
    """)
    
    # 5. Redemptions: Partial index for redeemed (completed) redemptions (analytics)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_redemptions_tenant_redeemed
        ON redemptions(tenant_id, created_at)
        WHERE redeemed_at IS NOT NULL
    """)
    
    # 6. Audit logs: Partial index for high-priority actions (security monitoring)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_audit_tenant_priority_actions
        ON audit_logs(tenant_id, created_at, action)
        WHERE action IN ('user_login', 'user_logout', 'order_created', 'payment_processed')
    """)


def downgrade() -> None:
    """Remove partial indexes."""
    op.execute("DROP INDEX IF EXISTS ix_orders_completed_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_orders_active_tenant_created")
    op.execute("DROP INDEX IF EXISTS ix_users_tenant_regular")
    op.execute("DROP INDEX IF EXISTS ix_users_tenant_staff")
    op.execute("DROP INDEX IF EXISTS ix_redemptions_tenant_redeemed")
    op.execute("DROP INDEX IF EXISTS ix_audit_tenant_priority_actions")
