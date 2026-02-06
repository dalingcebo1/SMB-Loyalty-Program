"""
Financial models for invoicing, expense tracking, and P&L reporting.

This module provides comprehensive financial management capabilities:
- Invoice generation with line items and PDF export
- Expense tracking with categories and receipts
- Financial reporting and analytics
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum as SQLEnum, ForeignKey,
    Integer, String, Text, func
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class InvoiceStatus(str, Enum):
    """Invoice payment status."""
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ExpenseCategory(str, Enum):
    """Expense categories for financial reporting."""
    INVENTORY = "inventory"  # Product purchases, supplies
    RENT = "rent"  # Office/store rent
    UTILITIES = "utilities"  # Electricity, water, internet
    SALARIES = "salaries"  # Staff wages
    MARKETING = "marketing"  # Advertising, campaigns
    EQUIPMENT = "equipment"  # Furniture, tools, machinery
    MAINTENANCE = "maintenance"  # Repairs, upkeep
    INSURANCE = "insurance"  # Business insurance
    TAXES = "taxes"  # VAT, income tax
    PROFESSIONAL_SERVICES = "professional_services"  # Legal, accounting
    TRAVEL = "travel"  # Business travel
    OTHER = "other"  # Miscellaneous


class PaymentMethod(str, Enum):
    """Payment methods for invoices and expenses."""
    CASH = "cash"
    CARD = "card"
    EFT = "eft"
    CHEQUE = "cheque"
    OTHER = "other"


class Invoice(Base):
    """
    Customer invoices for services/products.
    
    Supports:
    - Multiple line items
    - Tax calculations
    - Payment tracking
    - PDF generation
    - Email delivery
    """
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Invoice identification
    invoice_number = Column(String, unique=True, nullable=False, index=True)
    
    # Customer information
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(Text, nullable=True)
    
    # Financial details
    subtotal_cents = Column(Integer, nullable=False, default=0)  # Before tax
    tax_rate = Column(Integer, nullable=False, default=15)  # VAT percentage (15%)
    tax_cents = Column(Integer, nullable=False, default=0)  # Calculated tax
    discount_cents = Column(Integer, nullable=False, default=0)  # Discount amount
    total_cents = Column(Integer, nullable=False, default=0)  # Final amount
    
    # Status and dates
    status = Column(SQLEnum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT, index=True)
    issue_date = Column(Date, nullable=False, default=func.current_date())
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)
    
    # Payment details
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True)
    payment_reference = Column(String, nullable=True)
    
    # Additional information
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)  # Payment terms
    
    # PDF generation
    pdf_path = Column(String, nullable=True)  # Path to generated PDF
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="invoices")
    customer = relationship("User", foreign_keys=[customer_id], backref="invoices_received")
    creator = relationship("User", foreign_keys=[created_by], backref="invoices_created")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    
    @property
    def is_overdue(self) -> bool:
        """Check if invoice is overdue."""
        if self.status == InvoiceStatus.PAID:
            return False
        return self.due_date < datetime.now().date() if self.due_date else False
    
    @property
    def days_overdue(self) -> int:
        """Calculate days overdue."""
        if not self.is_overdue:
            return 0
        return (datetime.now().date() - self.due_date).days


class InvoiceLineItem(Base):
    """
    Individual line items on invoices.
    """
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    
    # Item details
    description = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price_cents = Column(Integer, nullable=False)  # Price per unit
    total_cents = Column(Integer, nullable=False)  # quantity * unit_price
    
    # Optional product reference
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    # Display order
    sort_order = Column(Integer, nullable=False, default=0)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")
    product = relationship("Product", backref="invoice_line_items")


class Expense(Base):
    """
    Business expense tracking with receipt management.
    
    Supports:
    - Multiple expense categories
    - Receipt uploads
    - Vendor tracking
    - Tax deductible flags
    - Approval workflow
    """
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Expense details
    description = Column(String, nullable=False)
    category = Column(SQLEnum(ExpenseCategory), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    
    # Vendor information
    vendor_name = Column(String, nullable=True)
    vendor_reference = Column(String, nullable=True)  # Invoice/receipt number
    
    # Payment details
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False, default=PaymentMethod.CASH)
    
    # Tax information
    is_tax_deductible = Column(Boolean, nullable=False, default=True)
    tax_rate = Column(Integer, nullable=True)  # VAT percentage if applicable
    
    # Receipt management
    receipt_path = Column(String, nullable=True)  # Path to uploaded receipt
    receipt_url = Column(String, nullable=True)  # URL if using cloud storage
    
    # Approval workflow
    is_approved = Column(Boolean, nullable=False, default=False, index=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="expenses")
    creator = relationship("User", foreign_keys=[created_by], backref="expenses_created")
    approver = relationship("User", foreign_keys=[approved_by], backref="expenses_approved")


class FinancialYear(Base):
    """
    Financial year configuration for reporting.
    
    Supports:
    - Custom fiscal year start dates
    - Year-end closing
    - Audit trails
    """
    __tablename__ = "financial_years"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Year identification
    year = Column(Integer, nullable=False, index=True)  # e.g., 2026
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_closed = Column(Boolean, nullable=False, default=False)
    closed_at = Column(DateTime, nullable=True)
    closed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="financial_years")
    closer = relationship("User", backref="financial_years_closed")
