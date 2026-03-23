"""Flowershop models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Table,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class FlowerCategory(Base):
    """Product categories for flower shop."""
    __tablename__ = "flower_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))  # Emoji or icon identifier
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    products = relationship("FlowerProduct", back_populates="category")
    
    __table_args__ = (
        Index('ix_flower_categories_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'name', name='uq_flower_category_name_per_tenant'),
    )


class FlowerOccasion(Base):
    """Occasions for flower orders (birthdays, anniversaries, etc.)."""
    __tablename__ = "flower_occasions"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)  # Birthday, Anniversary, Sympathy, etc.
    description = Column(Text)
    icon = Column(String(50))
    color_scheme = Column(String(50))  # Suggested color palette
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    products = relationship("FlowerProduct", secondary="product_occasions", back_populates="occasions")
    
    __table_args__ = (
        Index('ix_flower_occasions_tenant', 'tenant_id'),
    )


class FlowerProduct(Base):
    """Flower products (bouquets, arrangements, plants)."""
    __tablename__ = "flower_products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("flower_categories.id"), nullable=False, index=True)
    
    name = Column(String(200), nullable=False)
    description = Column(Text)
    sku = Column(String(50))
    
    # Pricing
    price_cents = Column(Integer, nullable=False)  # Base price in cents
    sale_price_cents = Column(Integer)  # Optional sale price
    
    # Inventory
    stock_quantity = Column(Integer, default=0)
    track_inventory = Column(Boolean, default=True)
    low_stock_threshold = Column(Integer, default=5)
    
    # Product details
    size = Column(String(50))  # Small, Medium, Large, etc.
    color_scheme = Column(String(100))  # Red roses, Mixed colors, etc.
    includes_vase = Column(Boolean, default=False)
    includes_card = Column(Boolean, default=True)
    
    # Images and display
    image_url = Column(String(500))
    featured = Column(Boolean, default=False)
    seasonal = Column(Boolean, default=False)  # Valentine's, Mother's Day, etc.
    display_order = Column(Integer, default=0)
    
    # Status
    active = Column(Boolean, default=True)
    available_for_delivery = Column(Boolean, default=True)
    available_for_pickup = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("FlowerCategory", back_populates="products")
    occasions = relationship("FlowerOccasion", secondary="product_occasions", back_populates="products")
    order_items = relationship("FlowerOrderItem", back_populates="product")
    
    __table_args__ = (
        Index('ix_flower_products_tenant', 'tenant_id'),
        Index('ix_flower_products_category', 'category_id'),
        Index('ix_flower_products_active_featured', 'active', 'featured'),
    )


# Association table for products and occasions (many-to-many)
product_occasions = Table(
    'product_occasions',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('flower_products.id'), primary_key=True),
    Column('occasion_id', Integer, ForeignKey('flower_occasions.id'), primary_key=True),
    Index('ix_product_occasions_product', 'product_id'),
    Index('ix_product_occasions_occasion', 'occasion_id'),
)


class FlowerOrder(Base):
    """Customer flower orders with delivery details."""
    __tablename__ = "flower_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Order details
    order_number = Column(String(50), unique=True, nullable=False)
    order_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Delivery details
    delivery_type = Column(String(20), nullable=False)  # delivery, pickup
    delivery_date = Column(Date, nullable=False)
    delivery_time_slot = Column(String(50))  # "9AM-12PM", "12PM-3PM", "3PM-6PM"
    
    # Recipient information
    recipient_name = Column(String(200), nullable=False)
    recipient_phone = Column(String(20))
    
    # Delivery address (for delivery orders)
    delivery_address_line1 = Column(String(200))
    delivery_address_line2 = Column(String(200))
    delivery_city = Column(String(100))
    delivery_postal_code = Column(String(20))
    delivery_instructions = Column(Text)
    
    # Gift message
    gift_message = Column(Text)  # max 200 chars validated in API
    include_sender_name = Column(Boolean, default=True)
    
    # Pricing
    subtotal_cents = Column(Integer, nullable=False)
    delivery_fee_cents = Column(Integer, default=0)
    discount_cents = Column(Integer, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Payment
    payment_status = Column(String(20), default='pending')  # pending, paid, failed, refunded
    payment_method = Column(String(50))  # card, cash, eft
    payment_reference = Column(String(100))
    
    # Order status
    status = Column(String(20), default='pending')  # pending, confirmed, preparing, out_for_delivery, delivered, cancelled
    
    # Staff notes
    staff_notes = Column(Text)
    
    # Loyalty points
    loyalty_points_awarded = Column(Integer, default=0)
    loyalty_points_awarded_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer = relationship("User")
    items = relationship("FlowerOrderItem", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_flower_orders_tenant', 'tenant_id'),
        Index('ix_flower_orders_customer', 'customer_id'),
        Index('ix_flower_orders_status', 'status'),
        Index('ix_flower_orders_delivery_date', 'delivery_date'),
        Index('ix_flower_orders_order_number', 'order_number'),
    )


class FlowerOrderItem(Base):
    """Line items in flower orders."""
    __tablename__ = "flower_order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("flower_orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("flower_products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)  # Price at time of order
    subtotal_cents = Column(Integer, nullable=False)
    
    # Product snapshot (in case product is deleted/changed)
    product_name = Column(String(200), nullable=False)
    product_description = Column(Text)
    
    # Relationships
    order = relationship("FlowerOrder", back_populates="items")
    product = relationship("FlowerProduct", back_populates="order_items")
    
    __table_args__ = (
        Index('ix_flower_order_items_order', 'order_id'),
    )


class DeliverySlot(Base):
    """Available delivery time slots per day."""
    __tablename__ = "delivery_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    delivery_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(50), nullable=False)  # "9AM-12PM", "12PM-3PM", "3PM-6PM"
    
    # Capacity
    max_deliveries = Column(Integer, default=10)
    current_bookings = Column(Integer, default=0)
    available = Column(Boolean, default=True)
    
    # Pricing
    fee_cents = Column(Integer, default=0)  # Delivery fee for this slot
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_delivery_slots_tenant', 'tenant_id'),
        Index('ix_delivery_slots_date', 'delivery_date'),
        UniqueConstraint('tenant_id', 'delivery_date', 'time_slot', name='uq_delivery_slot_per_tenant'),
    )
