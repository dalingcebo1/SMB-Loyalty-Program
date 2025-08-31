"""add extended roles (no enum constraint for now) & backfill

Revision ID: 20250831_add_roles_ext
Revises: 20250831_enable_rls
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = '20250831_add_roles_ext'
down_revision = '20250831_enable_rls'
branch_labels = None
depends_on = None

def upgrade():
    # Ensure role column exists and normalize legacy values
    # If column already present skip (SQLite dev safety)
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = [c['name'] for c in insp.get_columns('users')]
    if 'role' not in cols:
        op.add_column('users', sa.Column('role', sa.String(), nullable=False, server_default='user'))
        op.execute("UPDATE users SET role='user' WHERE role IS NULL OR role='' ")
    # Backfill: promote any legacy 'admin' kept; map developer emails heuristic (placeholder)
    # Example heuristic: any email ending with '@example.dev' -> developer
    op.execute("UPDATE users SET role='developer' WHERE email LIKE '%@example.dev' AND role='user'")

def downgrade():
    # We keep the column; safe no-op (data loss not desired). Could drop if needed.
    pass
