"""
POS (Point of Sale) Models

Models for retail sales transactions, payments, and receipts.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum

from app.core.database import Base


class PaymentMethod(str, Enum):
    """Payment methods accepted at POS."""
    CASH = "cash"
    CARD = "card"
    MOBILE = "mobile"
    WALLET = "wallet"
    OTHER = "other"


class SaleStatus(str, Enum):
    """Sale transaction status."""
    PENDING = "pending"
    COMPLETED = "completed"
    VOIDED = "voided"
    REFUNDED = "refunded"


class PaymentStatus(str, Enum):
    """Payment processing status."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Sale(Base):
    """
    POS Sale Transaction
    
    Represents a complete sale at point of sale, including all line items
    and payments. Links to customer for loyalty tracking.
    """
    __tablename__ = "sales"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Staff who processed the sale
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Customer (optional, for loyalty)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    
    # Receipt identification
    receipt_number = Column(String(50), nullable=False, index=True)
    location = Column(String(100), default="main")
    
    # Financial totals (in cents)
    subtotal_cents = Column(Integer, nullable=False, default=0)
    tax_cents = Column(Integer, nullable=False, default=0)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Tax rate applied (e.g., 15.0 for 15% VAT)
    tax_rate = Column(Integer, nullable=False, default=0)  # stored as basis points (1500 = 15%)
    
    # Status
    sale_status = Column(
        SQLEnum(SaleStatus),
        nullable=False,
        default=SaleStatus.PENDING,
        index=True
    )
    payment_status = Column(
        SQLEnum(PaymentStatus),
        nullable=False,
        default=PaymentStatus.PENDING
    )
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    voided_at = Column(DateTime)
    
    # Notes (e.g., void reason)
    notes = Column(String(500))
    
    # Relationships
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="sale", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_sales_tenant_receipt', 'tenant_id', 'receipt_number', unique=True),
        Index('ix_sales_tenant_date', 'tenant_id', 'created_at'),
        Index('ix_sales_tenant_customer', 'tenant_id', 'customer_id'),
    )
    
    @property
    def is_paid(self) -> bool:
        """Check if sale is fully paid."""
        return self.payment_status == PaymentStatus.COMPLETED
    
    @property
    def amount_paid_cents(self) -> int:
        """Total amount paid across all payments."""
        if not self.payments:
            return 0
        return sum(p.amount_cents for p in self.payments if p.status == PaymentStatus.COMPLETED)
    
    @property
    def amount_due_cents(self) -> int:
        """Remaining amount due."""
        return max(0, self.total_cents - self.amount_paid_cents)


class SaleItem(Base):
    """
    Individual line item in a sale.
    
    Records product, quantity, pricing at time of sale.
    Immutable once sale is completed.
    """
    __tablename__ = "sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    # Quantity sold
    quantity = Column(Integer, nullable=False)
    
    # Pricing at time of sale (in cents)
    unit_price_cents = Column(Integer, nullable=False)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Product details snapshot (in case product is deleted later)
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    sale = relationship("Sale", back_populates="items")
    
    __table_args__ = (
        Index('ix_sale_items_sale', 'sale_id'),
        Index('ix_sale_items_product', 'product_id'),
    )


class Payment(Base):
    """
    Payment record for a sale.
    
    A sale can have multiple payments (e.g., partial payment with cash,
    remainder with card).
    """
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    
    # Payment details
    amount_cents = Column(Integer, nullable=False)
    payment_method = Column(
        SQLEnum(PaymentMethod),
        nullable=False,
        index=True
    )
    
    # External transaction reference (for card/mobile payments)
    transaction_id = Column(String(200))
    
    # Payment status
    status = Column(
        SQLEnum(PaymentStatus),
        nullable=False,
        default=PaymentStatus.PENDING
    )
    
    # Change given (for cash payments)
    change_given_cents = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    
    # Error message (if payment failed)
    error_message = Column(String(500))
    
    # Relationships
    sale = relationship("Sale", back_populates="payments")
    
    __table_args__ = (
        Index('ix_payments_sale', 'sale_id'),
        Index('ix_payments_method', 'payment_method'),
        Index('ix_payments_transaction', 'transaction_id'),
    )
