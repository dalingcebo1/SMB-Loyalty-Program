"""
Financial services for invoice generation, expense tracking, and reporting.

This module provides:
- Invoice generation with automatic numbering
- PDF export for invoices
- Expense tracking and approval workflow
- Financial reporting (P&L, revenue, expenses)
- Year-over-year and period comparisons
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, extract, func
from sqlalchemy.orm import Session

from app.models import Order, Payment, Sale
from app.vertical_models.financial import (
    Expense,
    ExpenseCategory,
    FinancialYear,
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
)

logger = logging.getLogger(__name__)


class InvoiceService:
    """Service for invoice generation and management."""

    def __init__(self, db: Session):
        self.db = db

    def generate_invoice_number(self, tenant_id: str) -> str:
        """
        Generate unique invoice number for tenant.
        
        Format: INV-YYYY-NNNN
        Example: INV-2026-0001
        """
        current_year = datetime.now().year
        
        # Find the last invoice for this tenant in current year
        last_invoice = (
            self.db.query(Invoice)
            .filter(
                Invoice.tenant_id == tenant_id,
                Invoice.invoice_number.like(f"INV-{current_year}-%")
            )
            .order_by(Invoice.invoice_number.desc())
            .first()
        )
        
        if last_invoice:
            # Extract the sequence number and increment
            last_number = int(last_invoice.invoice_number.split("-")[-1])
            new_number = last_number + 1
        else:
            new_number = 1
        
        return f"INV-{current_year}-{new_number:04d}"

    def calculate_invoice_totals(
        self,
        line_items: List[Dict],
        tax_rate: int = 15,
        discount_cents: int = 0
    ) -> Tuple[int, int, int]:
        """
        Calculate invoice totals.
        
        Args:
            line_items: List of {description, quantity, unit_price_cents}
            tax_rate: Tax percentage (default 15% VAT)
            discount_cents: Discount amount in cents
            
        Returns:
            Tuple of (subtotal_cents, tax_cents, total_cents)
        """
        subtotal_cents = sum(
            item["quantity"] * item["unit_price_cents"]
            for item in line_items
        )
        
        # Apply discount to subtotal
        subtotal_after_discount = max(0, subtotal_cents - discount_cents)
        
        # Calculate tax on discounted subtotal
        tax_cents = int(subtotal_after_discount * tax_rate / 100)
        
        # Total = subtotal (after discount) + tax
        total_cents = subtotal_after_discount + tax_cents
        
        return subtotal_cents, tax_cents, total_cents

    def create_invoice(
        self,
        tenant_id: str,
        customer_name: str,
        line_items: List[Dict],
        created_by: int,
        customer_id: Optional[int] = None,
        due_days: int = 30,
        **kwargs
    ) -> Invoice:
        """
        Create new invoice with line items.
        
        Args:
            tenant_id: Tenant ID
            customer_id: Customer user ID (optional)
            customer_name: Customer name
            line_items: List of {description, quantity, unit_price_cents, product_id?}
            due_days: Days until due (default 30)
            created_by: User ID who created the invoice
            **kwargs: Additional invoice fields (customer_email, notes, terms, etc.)
            
        Returns:
            Created Invoice instance
        """
        # Generate invoice number
        invoice_number = self.generate_invoice_number(tenant_id)
        
        # Calculate totals
        tax_rate = kwargs.get("tax_rate", 15)
        discount_cents = kwargs.get("discount_cents", 0)
        subtotal_cents, tax_cents, total_cents = self.calculate_invoice_totals(
            line_items, tax_rate, discount_cents
        )
        
        # Create invoice
        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            customer_id=customer_id,
            customer_name=customer_name,
            customer_email=kwargs.get("customer_email"),
            customer_phone=kwargs.get("customer_phone"),
            customer_address=kwargs.get("customer_address"),
            subtotal_cents=subtotal_cents,
            tax_rate=tax_rate,
            tax_cents=tax_cents,
            discount_cents=discount_cents,
            total_cents=total_cents,
            status=InvoiceStatus.DRAFT,
            issue_date=kwargs.get("issue_date", date.today()),
            due_date=kwargs.get("due_date", date.today() + timedelta(days=due_days)),
            notes=kwargs.get("notes"),
            terms=kwargs.get("terms"),
            created_by=created_by,
        )
        
        self.db.add(invoice)
        self.db.flush()  # Get invoice ID
        
        # Create line items
        for i, item in enumerate(line_items):
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item["description"],
                quantity=item["quantity"],
                unit_price_cents=item["unit_price_cents"],
                total_cents=item["quantity"] * item["unit_price_cents"],
                product_id=item.get("product_id"),
                sort_order=i,
            )
            self.db.add(line_item)
        
        self.db.commit()
        self.db.refresh(invoice)
        
        logger.info(f"Created invoice {invoice.invoice_number} for tenant {tenant_id}")
        return invoice

    def mark_invoice_sent(self, invoice_id: int) -> Invoice:
        """Mark invoice as sent."""
        invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")
        
        invoice.status = InvoiceStatus.SENT
        self.db.commit()
        self.db.refresh(invoice)
        
        return invoice

    def mark_invoice_paid(
        self,
        invoice_id: int,
        payment_method: str,
        payment_reference: Optional[str] = None,
        paid_date: Optional[date] = None
    ) -> Invoice:
        """Mark invoice as paid."""
        invoice = self.db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")
        
        invoice.status = InvoiceStatus.PAID
        invoice.payment_method = payment_method
        invoice.payment_reference = payment_reference
        invoice.paid_date = paid_date or date.today()
        
        self.db.commit()
        self.db.refresh(invoice)
        
        logger.info(f"Invoice {invoice.invoice_number} marked as paid")
        return invoice


class ExpenseService:
    """Service for expense tracking and approval."""

    def __init__(self, db: Session):
        self.db = db

    def create_expense(
        self,
        tenant_id: str,
        description: str,
        category: ExpenseCategory,
        amount_cents: int,
        expense_date: date,
        created_by: int,
        **kwargs
    ) -> Expense:
        """
        Create new expense record.
        
        Args:
            tenant_id: Tenant ID
            description: Expense description
            category: Expense category
            amount_cents: Amount in cents
            expense_date: Date of expense
            created_by: User ID who created the expense
            **kwargs: Additional fields (vendor_name, payment_method, notes, etc.)
            
        Returns:
            Created Expense instance
        """
        expense = Expense(
            tenant_id=tenant_id,
            description=description,
            category=category,
            amount_cents=amount_cents,
            expense_date=expense_date,
            vendor_name=kwargs.get("vendor_name"),
            vendor_reference=kwargs.get("vendor_reference"),
            payment_method=kwargs.get("payment_method", "cash"),
            is_tax_deductible=kwargs.get("is_tax_deductible", True),
            tax_rate=kwargs.get("tax_rate"),
            receipt_path=kwargs.get("receipt_path"),
            receipt_url=kwargs.get("receipt_url"),
            notes=kwargs.get("notes"),
            created_by=created_by,
        )
        
        self.db.add(expense)
        self.db.commit()
        self.db.refresh(expense)
        
        logger.info(f"Created expense {expense.id} for tenant {tenant_id}")
        return expense

    def approve_expense(self, expense_id: int, approved_by: int) -> Expense:
        """Approve an expense."""
        expense = self.db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise ValueError(f"Expense {expense_id} not found")
        
        expense.is_approved = True
        expense.approved_by = approved_by
        expense.approved_at = datetime.now()
        
        self.db.commit()
        self.db.refresh(expense)
        
        logger.info(f"Expense {expense_id} approved by user {approved_by}")
        return expense

    def get_expenses_by_category(
        self,
        tenant_id: str,
        category: Optional[ExpenseCategory] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        approved_only: bool = False
    ) -> List[Expense]:
        """Get expenses filtered by category and date range."""
        query = self.db.query(Expense).filter(Expense.tenant_id == tenant_id)
        
        if category:
            query = query.filter(Expense.category == category)
        
        if start_date:
            query = query.filter(Expense.expense_date >= start_date)
        
        if end_date:
            query = query.filter(Expense.expense_date <= end_date)
        
        if approved_only:
            query = query.filter(Expense.is_approved == True)  # noqa: E712
        
        return query.order_by(Expense.expense_date.desc()).all()


class FinancialReportService:
    """Service for financial reporting and analytics."""

    def __init__(self, db: Session):
        self.db = db

    def get_revenue_summary(
        self,
        tenant_id: str,
        start_date: date,
        end_date: date
    ) -> Dict[str, int]:
        """
        Get revenue summary from all sources.
        
        Returns:
            {
                "orders_revenue_cents": int,      # From orders table
                "sales_revenue_cents": int,        # From sales table (POS)
                "payments_revenue_cents": int,     # From payments table
                "invoices_revenue_cents": int,     # From paid invoices
                "total_revenue_cents": int
            }
        """
        # Revenue from orders (e-commerce, carwash, etc.)
        orders_revenue = (
            self.db.query(func.sum(Order.total_amount_cents))
            .filter(
                Order.tenant_id == tenant_id,
                Order.status == "completed",  # Only count completed orders
                Order.created_at >= start_date,
                Order.created_at <= end_date
            )
            .scalar() or 0
        )
        
        # Revenue from sales (POS retail)
        sales_revenue = (
            self.db.query(func.sum(Sale.total_cents))
            .filter(
                Sale.tenant_id == tenant_id,
                Sale.created_at >= start_date,
                Sale.created_at <= end_date
            )
            .scalar() or 0
        )
        
        # Revenue from payments
        payments_revenue = (
            self.db.query(func.sum(Payment.amount_cents))
            .filter(
                Payment.tenant_id == tenant_id,
                Payment.created_at >= start_date,
                Payment.created_at <= end_date
            )
            .scalar() or 0
        )
        
        # Revenue from paid invoices
        invoices_revenue = (
            self.db.query(func.sum(Invoice.total_cents))
            .filter(
                Invoice.tenant_id == tenant_id,
                Invoice.status == InvoiceStatus.PAID,
                Invoice.paid_date >= start_date,
                Invoice.paid_date <= end_date
            )
            .scalar() or 0
        )
        
        total_revenue = orders_revenue + sales_revenue + payments_revenue + invoices_revenue
        
        return {
            "orders_revenue_cents": orders_revenue,
            "sales_revenue_cents": sales_revenue,
            "payments_revenue_cents": payments_revenue,
            "invoices_revenue_cents": invoices_revenue,
            "total_revenue_cents": total_revenue,
        }

    def get_expense_summary(
        self,
        tenant_id: str,
        start_date: date,
        end_date: date,
        approved_only: bool = True
    ) -> Dict[str, int]:
        """
        Get expense summary by category.
        
        Returns:
            {
                "inventory_cents": int,
                "rent_cents": int,
                "utilities_cents": int,
                ...
                "total_expenses_cents": int
            }
        """
        query = self.db.query(
            Expense.category,
            func.sum(Expense.amount_cents).label("total")
        ).filter(
            Expense.tenant_id == tenant_id,
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date
        )
        
        if approved_only:
            query = query.filter(Expense.is_approved == True)  # noqa: E712
        
        results = query.group_by(Expense.category).all()
        
        # Build summary by category
        summary = {f"{cat.value}_cents": 0 for cat in ExpenseCategory}
        total_expenses = 0
        
        for category, amount in results:
            summary[f"{category.value}_cents"] = amount
            total_expenses += amount
        
        summary["total_expenses_cents"] = total_expenses
        
        return summary

    def get_profit_and_loss(
        self,
        tenant_id: str,
        start_date: date,
        end_date: date
    ) -> Dict:
        """
        Generate profit and loss statement.
        
        Returns:
            {
                "revenue": {...},
                "expenses": {...},
                "gross_profit_cents": int,
                "net_profit_cents": int,
                "profit_margin": float  # Percentage
            }
        """
        revenue = self.get_revenue_summary(tenant_id, start_date, end_date)
        expenses = self.get_expense_summary(tenant_id, start_date, end_date)
        
        total_revenue = revenue["total_revenue_cents"]
        total_expenses = expenses["total_expenses_cents"]
        
        gross_profit = total_revenue - total_expenses
        profit_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        return {
            "revenue": revenue,
            "expenses": expenses,
            "gross_profit_cents": gross_profit,
            "net_profit_cents": gross_profit,  # Same as gross for SMBs
            "profit_margin": round(profit_margin, 2),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }

    def get_monthly_comparison(
        self,
        tenant_id: str,
        year: int
    ) -> List[Dict]:
        """
        Get month-by-month revenue and expense comparison for a year.
        
        Returns:
            List of {
                "month": 1-12,
                "month_name": "January",
                "revenue_cents": int,
                "expenses_cents": int,
                "profit_cents": int
            }
        """
        months = []
        
        for month in range(1, 13):
            start_date = date(year, month, 1)
            # Last day of month
            if month == 12:
                end_date = date(year, 12, 31)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            
            revenue = self.get_revenue_summary(tenant_id, start_date, end_date)
            expenses = self.get_expense_summary(tenant_id, start_date, end_date)
            
            months.append({
                "month": month,
                "month_name": start_date.strftime("%B"),
                "revenue_cents": revenue["total_revenue_cents"],
                "expenses_cents": expenses["total_expenses_cents"],
                "profit_cents": revenue["total_revenue_cents"] - expenses["total_expenses_cents"],
            })
        
        return months


def get_invoice_service(db: Session) -> InvoiceService:
    """Dependency injection for invoice service."""
    return InvoiceService(db)


def get_expense_service(db: Session) -> ExpenseService:
    """Dependency injection for expense service."""
    return ExpenseService(db)


def get_financial_report_service(db: Session) -> FinancialReportService:
    """Dependency injection for financial report service."""
    return FinancialReportService(db)
