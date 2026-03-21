"""add_customer_fk_to_sales

Revision ID: 476e4d5e7b78
Revises: 59e49c46d097
Create Date: 2026-02-05 10:36:42.634116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '476e4d5e7b78'
down_revision: Union[str, None] = '59e49c46d097'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add customer foreign key and index to sales table."""
    op.create_index(op.f('ix_sales_customer_id'), 'sales', ['customer_id'], unique=False)
    op.create_foreign_key('fk_sales_customer_id_users', 'sales', 'users', ['customer_id'], ['id'])


def downgrade() -> None:
    """Remove customer foreign key and index from sales table."""
    op.drop_constraint('fk_sales_customer_id_users', 'sales', type_='foreignkey')
    op.drop_index(op.f('ix_sales_customer_id'), table_name='sales')
