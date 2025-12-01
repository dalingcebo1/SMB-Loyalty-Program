"""add_schema_name_column_for_schema_isolation

Revision ID: 41b3557b61f7
Revises: 8b01c9a9b2aa
Create Date: 2025-12-01 11:54:35.348025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41b3557b61f7'
down_revision: Union[str, None] = '8b01c9a9b2aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add schema_name column to tenants table for schema-per-tenant support.
    
    This column is nullable to support gradual migration:
    - NULL = tenant uses row-level isolation (legacy, backward compatible)
    - Non-NULL = tenant uses dedicated PostgreSQL schema
    """
    # Add schema_name column
    op.add_column('tenants', sa.Column('schema_name', sa.String(), nullable=True))
    
    # Create unique index to ensure schema names are unique across tenants
    op.create_index(
        op.f('ix_tenants_schema_name'),
        'tenants',
        ['schema_name'],
        unique=True
    )


def downgrade() -> None:
    """Remove schema_name column and index."""
    op.drop_index(op.f('ix_tenants_schema_name'), table_name='tenants')
    op.drop_column('tenants', 'schema_name')
