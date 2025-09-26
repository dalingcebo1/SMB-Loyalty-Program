"""autogen multi-vertical fields

Revision ID: 20250831_autogen_mv
Revises: 20250830_acm
Create Date: 2025-08-31
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250831_autogen_mv'
down_revision = '20250830_acm'
branch_labels = None
depends_on = None

def _has_column(insp, table: str, column: str) -> bool:
    try:
        return column in {c['name'] for c in insp.get_columns(table)}
    except Exception:
        return False


def _has_index(insp, table: str, index: str) -> bool:
    try:
        return index in {i['name'] for i in insp.get_indexes(table)}
    except Exception:
        return False


def upgrade():
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # Prefer explicit SQL with IF NOT EXISTS on Postgres to avoid duplicate errors when branches merge
    if conn.dialect.name == 'postgresql':
        op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical_type VARCHAR")
        op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_domain VARCHAR")
        op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS config JSON")
        op.execute("CREATE INDEX IF NOT EXISTS ix_tenants_vertical_domain ON tenants (vertical_type, primary_domain)")
    else:
        # Fallback for SQLite or others
        with op.batch_alter_table('tenants') as batch:
            if not _has_column(insp, 'tenants', 'vertical_type'):
                batch.add_column(sa.Column('vertical_type', sa.String(), nullable=True))
            if not _has_column(insp, 'tenants', 'primary_domain'):
                batch.add_column(sa.Column('primary_domain', sa.String(), nullable=True))
            if not _has_column(insp, 'tenants', 'config'):
                batch.add_column(sa.Column('config', sa.JSON(), nullable=True))
            if not _has_index(insp, 'tenants', 'ix_tenants_vertical_domain'):
                batch.create_index('ix_tenants_vertical_domain', ['vertical_type', 'primary_domain'])

    # Backfill defaults where applicable
    if _has_column(insp, 'tenants', 'vertical_type'):
        op.execute("UPDATE tenants SET vertical_type='carwash' WHERE vertical_type IS NULL")
    if _has_column(insp, 'tenants', 'config'):
        try:
            op.execute("UPDATE tenants SET config='{}'::json WHERE config IS NULL")
        except Exception:
            # SQLite fallback
            op.execute("UPDATE tenants SET config='{}' WHERE config IS NULL")

    # Enforce not null after backfill, but only when columns exist
    with op.batch_alter_table('tenants') as batch:
        if _has_column(insp, 'tenants', 'vertical_type'):
            try:
                batch.alter_column('vertical_type', existing_type=sa.String(), nullable=False)
            except Exception:
                pass
        if _has_column(insp, 'tenants', 'config'):
            try:
                batch.alter_column('config', existing_type=sa.JSON(), nullable=False)
            except Exception:
                pass


def downgrade():
    insp = sa.inspect(op.get_bind())
    with op.batch_alter_table('tenants') as batch:
        if _has_index(insp, 'tenants', 'ix_tenants_vertical_domain'):
            batch.drop_index('ix_tenants_vertical_domain')
        if _has_column(insp, 'tenants', 'config'):
            batch.drop_column('config')
        if _has_column(insp, 'tenants', 'primary_domain'):
            batch.drop_column('primary_domain')
        if _has_column(insp, 'tenants', 'vertical_type'):
            batch.drop_column('vertical_type')
