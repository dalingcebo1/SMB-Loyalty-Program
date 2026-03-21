"""add_pos_sales_tables

Revision ID: 59e49c46d097
Revises: ca0cb8108df7
Create Date: 2026-02-05 10:12:10.261601

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59e49c46d097'
down_revision: Union[str, None] = 'ca0cb8108df7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create POS sales tables: sales, sale_items, sale_payments."""
    op.create_table(
        'sales',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=True),
        sa.Column('receipt_number', sa.String(50), nullable=False),
        sa.Column('location', sa.String(100), server_default='main'),
        sa.Column('subtotal_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tax_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('discount_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_cents', sa.Integer(), nullable=False),
        sa.Column('tax_rate', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sale_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('payment_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('voided_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index(op.f('ix_sales_id'), 'sales', ['id'])
    op.create_index(op.f('ix_sales_tenant_id'), 'sales', ['tenant_id'])
    op.create_index(op.f('ix_sales_receipt_number'), 'sales', ['receipt_number'])
    op.create_index(op.f('ix_sales_sale_status'), 'sales', ['sale_status'])
    op.create_index(op.f('ix_sales_created_at'), 'sales', ['created_at'])
    op.create_index('ix_sales_tenant_receipt', 'sales', ['tenant_id', 'receipt_number'], unique=True)
    op.create_index('ix_sales_tenant_date', 'sales', ['tenant_id', 'created_at'])

    op.create_table(
        'sale_items',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('sale_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price_cents', sa.Integer(), nullable=False),
        sa.Column('discount_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_cents', sa.Integer(), nullable=False),
        sa.Column('product_name', sa.String(200), nullable=False),
        sa.Column('product_sku', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
    )
    op.create_index(op.f('ix_sale_items_id'), 'sale_items', ['id'])
    op.create_index(op.f('ix_sale_items_sale_id'), 'sale_items', ['sale_id'])
    op.create_index(op.f('ix_sale_items_product_id'), 'sale_items', ['product_id'])

    op.create_table(
        'sale_payments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('sale_id', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('payment_method', sa.String(20), nullable=False),
        sa.Column('transaction_id', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('change_given_cents', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id']),
    )
    op.create_index(op.f('ix_sale_payments_id'), 'sale_payments', ['id'])
    op.create_index(op.f('ix_sale_payments_sale_id'), 'sale_payments', ['sale_id'])
    op.create_index(op.f('ix_sale_payments_payment_method'), 'sale_payments', ['payment_method'])
    op.create_index(op.f('ix_sale_payments_created_at'), 'sale_payments', ['created_at'])


def downgrade() -> None:
    """Drop POS sales tables."""
    op.drop_table('sale_payments')
    op.drop_table('sale_items')
    op.drop_table('sales')
