"""Point of Sale (POS) models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Sale(Base):
    """POS Sale Transaction - Complete sale with line items and payments."""
    __tablename__ = "sales"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Cashier/staff
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Customer making purchase
    
    receipt_number = Column(String(50), nullable=False, index=True)
    location = Column(String(100), default="main")
    
    # Totals in cents
    subtotal_cents = Column(Integer, nullable=False, default=0)
    tax_cents = Column(Integer, nullable=False, default=0)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    tax_rate = Column(Integer, nullable=False, default=0)  # basis points (1500 = 15%)
    
    sale_status = Column(String(20), nullable=False, default="pending", index=True)
    payment_status = Column(String(20), nullable=False, default="pending")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    voided_at = Column(DateTime)
    notes = Column(String(500))
    
    # Relationships
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    sale_payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")
    customer = relationship("User", foreign_keys=[customer_id])
    cashier = relationship("User", foreign_keys=[user_id])
    
    __table_args__ = (
        Index('ix_sales_tenant_receipt', 'tenant_id', 'receipt_number', unique=True),
        Index('ix_sales_tenant_date', 'tenant_id', 'created_at'),
    )


class SaleItem(Base):
    """Individual line item in a sale."""
    __tablename__ = "sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Product snapshot
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    sale = relationship("Sale", back_populates="items")


class SalePayment(Base):
    """Payment record for a POS sale (renamed to avoid conflict with order payments)."""
    __tablename__ = "sale_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    
    amount_cents = Column(Integer, nullable=False)
    payment_method = Column(String(20), nullable=False, index=True)
    transaction_id = Column(String(200))
    status = Column(String(20), nullable=False, default="pending")
    change_given_cents = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    error_message = Column(String(500))
    
    sale = relationship("Sale", back_populates="sale_payments")
