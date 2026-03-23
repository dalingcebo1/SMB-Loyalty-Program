"""Cannabis dispensary models."""
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
    Float,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DispensaryProductCategory(Base):
    """Product categories for cannabis dispensary."""
    __tablename__ = "dispensary_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)  # Flower, Edibles, Concentrates, Topicals, etc.
    description = Column(Text)
    icon = Column(String(50))
    display_order = Column(Integer, default=0)
    requires_medical_card = Column(Boolean, default=False)  # Some products may require medical card
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    products = relationship("DispensaryProduct", back_populates="category")
    
    __table_args__ = (
        Index('ix_dispensary_categories_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'name', name='uq_dispensary_category_name_per_tenant'),
    )


class DispensaryProduct(Base):
    """Cannabis products with compliance tracking."""
    __tablename__ = "dispensary_products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("dispensary_categories.id"), nullable=False, index=True)
    
    # Basic info
    name = Column(String(200), nullable=False)
    strain = Column(String(100))  # Strain name (e.g., "Blue Dream", "OG Kush")
    strain_type = Column(String(20))  # indica, sativa, hybrid
    description = Column(Text)
    sku = Column(String(50))
    
    # Cannabis-specific details
    thc_percentage = Column(Float)  # THC content percentage
    cbd_percentage = Column(Float)  # CBD content percentage
    terpenes = Column(Text)  # Comma-separated terpene profile
    effects = Column(Text)  # Comma-separated effects (relaxed, energetic, creative, etc.)
    medical_uses = Column(Text)  # Comma-separated medical uses
    
    # Pricing
    price_cents = Column(Integer, nullable=False)  # Price per unit in cents
    unit_size = Column(String(50))  # "1g", "3.5g", "7g", "14g", "28g" for flower; "10mg", "100mg" for edibles
    
    # Inventory
    stock_quantity = Column(Integer, default=0)
    batch_number = Column(String(100))  # Batch/lot number for compliance
    harvest_date = Column(Date)  # Harvest date for flower
    package_date = Column(Date)  # Packaging date
    expiry_date = Column(Date)  # Expiration date (important for edibles)
    
    # Product classification
    requires_medical_card = Column(Boolean, default=False)  # True for medical-only products
    potency_level = Column(String(20))  # low, medium, high, very_high
    
    # Images and display
    image_url = Column(String(500))
    featured = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    
    # Status
    active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("DispensaryProductCategory", back_populates="products")
    sale_items = relationship("DispensarySaleItem", back_populates="product")
    
    __table_args__ = (
        Index('ix_dispensary_products_tenant', 'tenant_id'),
        Index('ix_dispensary_products_category', 'category_id'),
        Index('ix_dispensary_products_active', 'active'),
        Index('ix_dispensary_products_strain_type', 'strain_type'),
    )


class DispensaryCustomerVerification(Base):
    """Customer age and medical card verification for compliance."""
    __tablename__ = "dispensary_customer_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Age verification
    age_verified = Column(Boolean, default=False)
    date_of_birth = Column(Date)
    age_verification_date = Column(DateTime(timezone=True))
    age_verification_method = Column(String(50))  # id_card, drivers_license, passport
    
    # Medical card verification (optional, for medical dispensaries)
    has_medical_card = Column(Boolean, default=False)
    medical_card_number = Column(String(100))
    medical_card_expiry = Column(Date)
    medical_card_verified_date = Column(DateTime(timezone=True))
    medical_condition = Column(String(200))  # Optional, for record keeping
    
    # Verification documents
    id_document_type = Column(String(50))
    id_document_number = Column(String(100))
    id_document_expiry = Column(Date)
    
    # Staff verification
    verified_by_staff_id = Column(Integer, ForeignKey("users.id"))
    
    # Status
    verification_status = Column(String(20), default='pending')  # pending, verified, rejected, expired
    notes = Column(Text)  # Staff notes
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    verified_by = relationship("User", foreign_keys=[verified_by_staff_id])
    
    __table_args__ = (
        Index('ix_disp_verifications_tenant', 'tenant_id'),
        Index('ix_disp_verifications_customer', 'customer_id'),
        Index('ix_disp_verifications_status', 'verification_status'),
        UniqueConstraint('tenant_id', 'customer_id', name='uq_dispensary_verification_per_customer'),
    )


class DispensaryPurchaseLimitTracking(Base):
    """Track customer purchase limits for compliance (daily/monthly limits)."""
    __tablename__ = "dispensary_purchase_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Purchase limits (in grams for flower, mg for edibles)
    daily_limit_grams = Column(Float, default=28.0)  # Default 28g (1 oz) per day
    monthly_limit_grams = Column(Float, default=150.0)  # Default 150g per month
    
    # Current period tracking
    current_day = Column(Date, nullable=False, index=True)
    current_month = Column(String(7), nullable=False, index=True)  # YYYY-MM format
    
    daily_purchased_grams = Column(Float, default=0.0)
    monthly_purchased_grams = Column(Float, default=0.0)
    
    # Transaction counting
    daily_transaction_count = Column(Integer, default=0)
    monthly_transaction_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User")
    
    __table_args__ = (
        Index('ix_disp_limits_tenant', 'tenant_id'),
        Index('ix_disp_limits_customer', 'customer_id'),
        Index('ix_disp_limits_day', 'current_day'),
        Index('ix_disp_limits_month', 'current_month'),
        UniqueConstraint('tenant_id', 'customer_id', 'current_day', name='uq_dispensary_limit_per_customer_day'),
    )


class DispensarySale(Base):
    """Cannabis sales transactions with compliance tracking."""
    __tablename__ = "dispensary_sales"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    verification_id = Column(Integer, ForeignKey("dispensary_customer_verifications.id"), nullable=False, index=True)
    
    # Sale details
    sale_number = Column(String(50), unique=True, nullable=False, index=True)
    sale_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Compliance tracking
    customer_age_at_sale = Column(Integer, nullable=False)  # Age verification
    medical_card_used = Column(Boolean, default=False)  # Whether medical card was used
    total_grams_sold = Column(Float, default=0.0)  # Total cannabis weight sold (for limits)
    
    # Staff
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Pricing
    subtotal_cents = Column(Integer, nullable=False)
    tax_cents = Column(Integer, default=0)  # Cannabis may have special tax rates
    discount_cents = Column(Integer, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Payment
    payment_method = Column(String(50))  # cash, card, debit
    payment_status = Column(String(20), default='completed')  # completed, refunded
    payment_reference = Column(String(100))
    
    # Loyalty points
    loyalty_points_awarded = Column(Integer, default=0)
    loyalty_points_awarded_at = Column(DateTime(timezone=True))
    
    # Compliance notes
    compliance_notes = Column(Text)  # Any compliance-related notes
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    staff = relationship("User", foreign_keys=[staff_id])
    verification = relationship("DispensaryCustomerVerification")
    items = relationship("DispensarySaleItem", back_populates="sale", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_dispensary_sales_tenant', 'tenant_id'),
        Index('ix_dispensary_sales_customer', 'customer_id'),
        Index('ix_dispensary_sales_date', 'sale_date'),
        Index('ix_dispensary_sales_number', 'sale_number'),
    )


class DispensarySaleItem(Base):
    """Line items in dispensary sales."""
    __tablename__ = "dispensary_sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("dispensary_sales.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("dispensary_products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)  # Price at time of sale
    subtotal_cents = Column(Integer, nullable=False)
    
    # Compliance tracking
    grams_sold = Column(Float, default=0.0)  # Weight in grams (for limit tracking)
    batch_number = Column(String(100))  # Batch number at time of sale (for recalls)
    
    # Product snapshot (in case product is deleted/changed)
    product_name = Column(String(200), nullable=False)
    thc_percentage = Column(Float)
    cbd_percentage = Column(Float)
    strain_type = Column(String(20))
    
    # Relationships
    sale = relationship("DispensarySale", back_populates="items")
    product = relationship("DispensaryProduct", back_populates="sale_items")
    
    __table_args__ = (
        Index('ix_dispensary_sale_items_sale', 'sale_id'),
    )
