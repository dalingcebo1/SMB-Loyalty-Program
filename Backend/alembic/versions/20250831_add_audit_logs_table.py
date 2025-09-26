"""add audit_logs table

Revision ID: 20250831_add_audit_logs
Revises: 20250831_add_roles_ext
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

revision = '20250831_add_audit_logs'
down_revision = '20250831_add_roles_ext'
branch_labels = None
depends_on = None

def _has_index(insp, table: str, index: str) -> bool:
    try:
        return index in {i['name'] for i in insp.get_indexes(table)}
    except Exception:
        return False


def upgrade():
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # Create table only if it doesn't already exist (baseline may have created it)
    if 'audit_logs' not in insp.get_table_names():
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tenant_id', sa.String(), nullable=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('action', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('details', sa.JSON(), nullable=True),
        )

    # Create any missing indexes idempotently
    if conn.dialect.name == 'postgresql':
        op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id ON audit_logs (tenant_id)")
        op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)")
        op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action)")
        op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at)")
    else:
        # Fallback for engines without IF NOT EXISTS on CREATE INDEX
        if not _has_index(insp, 'audit_logs', 'ix_audit_logs_tenant_id'):
            op.create_index('ix_audit_logs_tenant_id', 'audit_logs', ['tenant_id'])
        if not _has_index(insp, 'audit_logs', 'ix_audit_logs_user_id'):
            op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
        if not _has_index(insp, 'audit_logs', 'ix_audit_logs_action'):
            op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
        if not _has_index(insp, 'audit_logs', 'ix_audit_logs_created_at'):
            op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])

def downgrade():
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_tenant_id', table_name='audit_logs')
    op.drop_table('audit_logs')
