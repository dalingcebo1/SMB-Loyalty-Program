"""
Retail Inventory Models

Database models for product catalog, inventory tracking, and stock management.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class Supplier(Base):
    """Supplier/Vendor information for retail products."""
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    address = Column(Text)
    notes = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    products = relationship("Product", back_populates="supplier")
    
    __table_args__ = (
        Index('ix_suppliers_tenant_active', 'tenant_id', 'active'),
    )


class ProductCategory(Base):
    """Product categories for organization and reporting."""
    __tablename__ = "product_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    parent_id = Column(Integer, ForeignKey("product_categories.id"))
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    products = relationship("Product", back_populates="category")
    parent = relationship("ProductCategory", remote_side=[id], backref="subcategories")
    
    __table_args__ = (
        Index('ix_categories_tenant_active', 'tenant_id', 'active'),
    )


class Product(Base):
    """Product catalog item with pricing and supplier information."""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    sku = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    
    # Pricing (stored in cents)
    cost_cents = Column(Integer, nullable=False, default=0)  # What we pay
    price_cents = Column(Integer, nullable=False, default=0)  # What customer pays
    
    # Physical attributes
    barcode = Column(String(100), index=True)
    unit_of_measure = Column(String(20), default='unit')  # unit, kg, liter, etc.
    
    # Stock management
    track_inventory = Column(Boolean, default=True, nullable=False)
    low_stock_threshold = Column(Integer, default=10)
    
    # Status
    active = Column(Boolean, default=True, nullable=False)
    featured = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    category = relationship("ProductCategory", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory_levels = relationship("InventoryLevel", back_populates="product", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_products_tenant_active', 'tenant_id', 'active'),
        Index('ix_products_tenant_sku', 'tenant_id', 'sku', unique=True),
    )
    
    @property
    def cost(self) -> float:
        """Cost in currency (dollars/rands)."""
        return self.cost_cents / 100.0
    
    @property
    def price(self) -> float:
        """Price in currency (dollars/rands)."""
        return self.price_cents / 100.0
    
    @property
    def margin_percent(self) -> float:
        """Profit margin percentage."""
        if self.price_cents == 0:
            return 0.0
        return ((self.price_cents - self.cost_cents) / self.price_cents) * 100


class InventoryLevel(Base):
    """Current inventory levels per product and location."""
    __tablename__ = "inventory_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')  # main, warehouse, store-1, etc.
    
    quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, default=0)  # Reserved for pending orders
    
    # Computed fields
    last_counted_at = Column(DateTime)
    last_counted_by = Column(Integer, ForeignKey("users.id"))
    last_restocked_at = Column(DateTime)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = relationship("Product", back_populates="inventory_levels")
    
    __table_args__ = (
        Index('ix_inventory_tenant_product', 'tenant_id', 'product_id'),
        Index('ix_inventory_tenant_location', 'tenant_id', 'location'),
    )
    
    @property
    def available_quantity(self) -> int:
        """Quantity available for sale (total - reserved)."""
        return max(0, self.quantity - self.reserved_quantity)
    
    @property
    def is_low_stock(self) -> bool:
        """Check if inventory is below product's low stock threshold."""
        if self.product and self.product.track_inventory:
            return self.available_quantity <= (self.product.low_stock_threshold or 0)
        return False


class StockMovement(Base):
    """Audit trail of all stock changes (purchases, sales, adjustments)."""
    __tablename__ = "stock_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')
    
    # Movement details
    type = Column(String(50), nullable=False, index=True)  # purchase, sale, adjustment, transfer, return
    quantity = Column(Integer, nullable=False)  # Positive for increase, negative for decrease
    
    # Context
    reference_type = Column(String(50))  # order, purchase_order, adjustment, etc.
    reference_id = Column(Integer)  # ID of related record
    reason = Column(Text)  # Explanation for adjustment/transfer
    
    # Pricing at time of movement (in cents)
    unit_cost_cents = Column(Integer)
    
    # Metadata
    performed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    product = relationship("Product", back_populates="stock_movements")
    
    __table_args__ = (
        Index('ix_movements_tenant_product', 'tenant_id', 'product_id'),
        Index('ix_movements_tenant_created', 'tenant_id', 'created_at'),
        Index('ix_movements_type', 'type'),
    )
    
    @property
    def unit_cost(self) -> float:
        """Unit cost in currency."""
        return (self.unit_cost_cents or 0) / 100.0


class LowStockAlert(Base):
    """Alerts for products that have fallen below threshold."""
    __tablename__ = "low_stock_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')
    
    current_quantity = Column(Integer, nullable=False)
    threshold = Column(Integer, nullable=False)
    
    # Alert status
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"))
    acknowledged_at = Column(DateTime)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    __table_args__ = (
        Index('ix_alerts_tenant_unresolved', 'tenant_id', 'resolved'),
    )
