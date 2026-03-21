"""add_retail_inventory_models

Revision ID: ca0cb8108df7
Revises: f547a43c4eef
Create Date: 2026-02-05 09:33:49.719989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca0cb8108df7'
down_revision: Union[str, None] = 'f547a43c4eef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create retail inventory tables: suppliers, product_categories, products,
    inventory_levels, stock_movements, low_stock_alerts."""

    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contact_person', sa.String(200)),
        sa.Column('email', sa.String(200)),
        sa.Column('phone', sa.String(50)),
        sa.Column('address', sa.Text()),
        sa.Column('notes', sa.Text()),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )
    op.create_index('ix_suppliers_tenant_active', 'suppliers', ['tenant_id', 'active'])

    op.create_table(
        'product_categories',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('parent_id', sa.Integer()),
        sa.Column('display_order', sa.Integer(), server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['product_categories.id']),
    )
    op.create_index('ix_categories_tenant_active', 'product_categories', ['tenant_id', 'active'])

    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('sku', sa.String(100), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('category_id', sa.Integer()),
        sa.Column('supplier_id', sa.Integer()),
        sa.Column('cost_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('price_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('barcode', sa.String(100), index=True),
        sa.Column('unit_of_measure', sa.String(20), server_default='unit'),
        sa.Column('track_inventory', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('low_stock_threshold', sa.Integer(), server_default='10'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('featured', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['category_id'], ['product_categories.id']),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
    )
    op.create_index('ix_products_tenant_active', 'products', ['tenant_id', 'active'])
    op.create_index('ix_products_tenant_sku', 'products', ['tenant_id', 'sku'], unique=True)

    op.create_table(
        'inventory_levels',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('location', sa.String(100), server_default='main'),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reserved_quantity', sa.Integer(), server_default='0'),
        sa.Column('last_counted_at', sa.DateTime()),
        sa.Column('last_counted_by', sa.Integer()),
        sa.Column('last_restocked_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['last_counted_by'], ['users.id']),
    )
    op.create_index('ix_inventory_tenant_product', 'inventory_levels', ['tenant_id', 'product_id'])
    op.create_index('ix_inventory_tenant_location', 'inventory_levels', ['tenant_id', 'location'])

    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('location', sa.String(100), server_default='main'),
        sa.Column('type', sa.String(50), nullable=False, index=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('reference_type', sa.String(50)),
        sa.Column('reference_id', sa.Integer()),
        sa.Column('reason', sa.Text()),
        sa.Column('unit_cost_cents', sa.Integer()),
        sa.Column('performed_by', sa.Integer()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()'), index=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id']),
    )
    op.create_index('ix_movements_tenant_product', 'stock_movements', ['tenant_id', 'product_id'])
    op.create_index('ix_movements_tenant_created', 'stock_movements', ['tenant_id', 'created_at'])
    op.create_index('ix_movements_type', 'stock_movements', ['type'])

    op.create_table(
        'low_stock_alerts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(), nullable=False, index=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('location', sa.String(100), server_default='main'),
        sa.Column('current_quantity', sa.Integer(), nullable=False),
        sa.Column('threshold', sa.Integer(), nullable=False),
        sa.Column('acknowledged', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('acknowledged_at', sa.DateTime()),
        sa.Column('acknowledged_by', sa.Integer()),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('resolved_at', sa.DateTime()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id']),
    )


def downgrade() -> None:
    """Drop retail inventory tables in reverse order."""
    op.drop_table('low_stock_alerts')
    op.drop_table('stock_movements')
    op.drop_table('inventory_levels')
    op.drop_table('products')
    op.drop_table('product_categories')
    op.drop_table('suppliers')
