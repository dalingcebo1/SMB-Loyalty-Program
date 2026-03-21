"""
Financial API endpoints for invoices, expenses, and reporting.

This module provides:
- Invoice management (create, update, send, mark paid)
- Expense tracking (create, approve, categorize)
- Financial reports (P&L, revenue, expense summaries)
- Year-over-year comparisons
"""

import logging
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import Tenant, User
from app.plugins.auth.routes import get_current_user
from app.services.export_service import generate_csv, generate_pdf_report
from app.services.financial import (
    ExpenseService,
    FinancialReportService,
    InvoiceService,
    get_expense_service,
    get_financial_report_service,
    get_invoice_service,
)
from app.vertical_models.financial import (
    Expense,
    ExpenseCategory,
    Invoice,
    InvoiceStatus,
    PaymentMethod,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Dependency Functions
# ============================================================================

def get_invoice_service(db: Session = Depends(get_db)) -> "InvoiceService":
    """Dependency to get InvoiceService instance."""
    return InvoiceService(db)


def get_expense_service(db: Session = Depends(get_db)) -> "ExpenseService":
    """Dependency to get ExpenseService instance."""
    return ExpenseService(db)


def get_financial_report_service(db: Session = Depends(get_db)) -> "FinancialReportService":
    """Dependency to get FinancialReportService instance."""
    return FinancialReportService(db)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class InvoiceLineItemCreate(BaseModel):
    """
    Line item for invoice creation.
    
    Each invoice can have multiple line items representing products or services sold.
    Prices are stored in cents to avoid floating-point issues.
    
    Example:
        ```json
        {
            "description": "Premium Widget (Model XL)",
            "quantity": 5,
            "unit_price_cents": 129900,
            "product_id": 42
        }
        ```
    """
    description: str = Field(
        ..., 
        min_length=1, 
        max_length=500,
        description="Product or service description",
        example="Premium Widget (Model XL)"
    )
    quantity: int = Field(
        ..., 
        gt=0,
        description="Quantity sold",
        example=5
    )
    unit_price_cents: int = Field(
        ..., 
        ge=0,
        description="Price per unit in cents (e.g., R1,299.00 = 129900 cents)",
        example=129900
    )
    product_id: Optional[int] = Field(
        None,
        description="Optional catalog product ID for inventory tracking",
        example=42
    )


class InvoiceCreate(BaseModel):
    """
    Invoice creation request.
    
    Creates a new invoice with line items, tax, and discount calculations.
    Invoice starts in DRAFT status and can be sent to customer via email.
    
    Example:
        ```json
        {
            "customer_id": 123,
            "customer_name": "Acme Corporation",
            "customer_email": "billing@acme.com",
            "customer_phone": "+27821234567",
            "customer_address": "123 Business St, Cape Town, 8001",
            "line_items": [
                {
                    "description": "Consulting Services - February 2026",
                    "quantity": 40,
                    "unit_price_cents": 125000,
                    "product_id": null
                },
                {
                    "description": "Software License (Annual)",
                    "quantity": 1,
                    "unit_price_cents": 599900,
                    "product_id": 15
                }
            ],
            "tax_rate": 15,
            "discount_cents": 50000,
            "due_days": 30,
            "notes": "Thank you for your business!",
            "terms": "Payment due within 30 days. Late payments subject to 2% monthly interest."
        }
        ```
    
    Calculations:
        - Subtotal = Sum of (quantity × unit_price_cents) for all line items
        - Tax = Subtotal × (tax_rate / 100)
        - Total = Subtotal + Tax - discount_cents
    """
    customer_id: Optional[int] = Field(
        None,
        description="Existing customer ID (optional, for linking to customer record)",
        example=123
    )
    customer_name: str = Field(
        ..., 
        min_length=1, 
        max_length=200,
        description="Customer or company name",
        example="Acme Corporation"
    )
    customer_email: Optional[str] = Field(
        None,
        description="Customer email for sending invoice",
        example="billing@acme.com"
    )
    customer_phone: Optional[str] = Field(
        None,
        description="Customer phone number",
        example="+27821234567"
    )
    customer_address: Optional[str] = Field(
        None,
        description="Full billing address",
        example="123 Business St, Cape Town, 8001"
    )
    line_items: List[InvoiceLineItemCreate] = Field(
        ..., 
        min_items=1,
        description="List of invoice line items (at least one required)"
    )
    tax_rate: int = Field(
        15, 
        ge=0, 
        le=100,
        description="Tax percentage (e.g., 15 for 15% VAT)",
        example=15
    )
    discount_cents: int = Field(
        0, 
        ge=0,
        description="Discount amount in cents (e.g., R500 = 50000 cents)",
        example=50000
    )
    due_days: int = Field(
        30, 
        gt=0,
        description="Number of days until payment is due",
        example=30
    )
    notes: Optional[str] = Field(
        None,
        description="Public notes visible to customer",
        example="Thank you for your business!"
    )
    terms: Optional[str] = Field(
        None,
        description="Payment terms and conditions",
        example="Payment due within 30 days. Late payments subject to 2% monthly interest."
    )


class InvoiceUpdate(BaseModel):
    """Invoice update request (draft only)."""
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class InvoiceMarkPaid(BaseModel):
    """Mark invoice as paid."""
    payment_method: PaymentMethod
    payment_reference: Optional[str] = None
    paid_date: Optional[date] = None


class InvoiceResponse(BaseModel):
    """Invoice response."""
    id: int
    tenant_id: str
    invoice_number: str
    customer_id: Optional[int]
    customer_name: str
    customer_email: Optional[str]
    customer_phone: Optional[str]
    subtotal_cents: int
    tax_rate: int
    tax_cents: int
    discount_cents: int
    total_cents: int
    status: InvoiceStatus
    issue_date: date
    due_date: date
    paid_date: Optional[date]
    payment_method: Optional[PaymentMethod]
    is_overdue: bool
    days_overdue: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    """Expense creation request."""
    description: str = Field(..., min_length=1, max_length=500)
    category: ExpenseCategory
    amount_cents: int = Field(..., gt=0)
    expense_date: date
    vendor_name: Optional[str] = None
    vendor_reference: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    is_tax_deductible: bool = True
    tax_rate: Optional[int] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    """Expense update request."""
    description: Optional[str] = None
    category: Optional[ExpenseCategory] = None
    amount_cents: Optional[int] = Field(None, gt=0)
    expense_date: Optional[date] = None
    vendor_name: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    """Expense response."""
    id: int
    tenant_id: str
    description: str
    category: ExpenseCategory
    amount_cents: int
    expense_date: date
    vendor_name: Optional[str]
    vendor_reference: Optional[str]
    payment_method: PaymentMethod
    is_tax_deductible: bool
    is_approved: bool
    approved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ProfitAndLossResponse(BaseModel):
    """P&L report response."""
    revenue: dict
    expenses: dict
    gross_profit_cents: int
    net_profit_cents: int
    profit_margin: float
    start_date: str
    end_date: str


class MonthlyComparisonResponse(BaseModel):
    """Monthly comparison response."""
    month: int
    month_name: str
    revenue_cents: int
    expenses_cents: int
    profit_cents: int


# ============================================================================
# Invoice Endpoints
# ============================================================================

@router.post("/invoices/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    invoice_service: InvoiceService = Depends(get_invoice_service)
):
    """
    Create a new invoice with line items.
    
    - Automatically generates invoice number (INV-YYYY-NNNN)
    - Calculates totals with tax and discount
    - Creates draft invoice for review
    """
    try:
        line_items_data = [item.model_dump() for item in data.line_items]
        
        invoice = invoice_service.create_invoice(
            tenant_id=tenant_ctx.tenant_id,
            customer_id=data.customer_id,
            customer_name=data.customer_name,
            line_items=line_items_data,
            due_days=data.due_days,
            created_by=current_user.id,
            customer_email=data.customer_email,
            customer_phone=data.customer_phone,
            customer_address=data.customer_address,
            tax_rate=data.tax_rate,
            discount_cents=data.discount_cents,
            notes=data.notes,
            terms=data.terms,
        )
        
        return invoice
    except Exception as e:
        logger.error(f"Error creating invoice: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices/", response_model=List[InvoiceResponse])
async def list_invoices(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[InvoiceStatus] = Query(None),
    customer_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    List invoices with optional filters.
    
    - Filter by status (draft, sent, paid, overdue, cancelled)
    - Filter by customer
    - Paginated results
    """
    query = db.query(Invoice).filter(Invoice.tenant_id == tenant_ctx.tenant_id)
    
    if status:
        query = query.filter(Invoice.status == status)
    
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    
    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    
    return invoices


@router.get("/invoices/export")
def export_invoices(
    format: str = Query("csv", description="Export format: csv"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export invoices as CSV."""
    query = db.query(Invoice).filter(Invoice.tenant_id == current_user.tenant_id)

    if status:
        query = query.filter(Invoice.status == status)

    invoices = query.order_by(Invoice.created_at.desc()).all()

    columns = [
        ("invoice_number", "Invoice #"),
        ("customer_name", "Customer"),
        ("customer_email", "Email"),
        ("issue_date", "Issue Date"),
        ("due_date", "Due Date"),
        ("status", "Status"),
        ("subtotal", "Subtotal (ZAR)"),
        ("tax", "Tax (ZAR)"),
        ("discount", "Discount (ZAR)"),
        ("total", "Total (ZAR)"),
    ]

    export_rows = []
    for inv in invoices:
        export_rows.append({
            "invoice_number": inv.invoice_number or "",
            "customer_name": inv.customer_name or "",
            "customer_email": inv.customer_email or "",
            "issue_date": inv.issue_date.isoformat() if inv.issue_date else "",
            "due_date": inv.due_date.isoformat() if inv.due_date else "",
            "status": inv.status.value if inv.status else "",
            "subtotal": f"{(inv.subtotal_cents or 0) / 100:.2f}",
            "tax": f"{(inv.tax_cents or 0) / 100:.2f}",
            "discount": f"{(inv.discount_cents or 0) / 100:.2f}",
            "total": f"{(inv.total_cents or 0) / 100:.2f}",
        })

    today = date.today().isoformat()
    return generate_csv(export_rows, columns, f"invoices_{today}.csv")


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invoice details by ID."""
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.line_items))
        .filter(Invoice.id == invoice_id, Invoice.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update invoice (draft only).
    
    Only draft invoices can be updated.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be updated"
        )
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    db.commit()
    db.refresh(invoice)
    
    return invoice


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    invoice_service: InvoiceService = Depends(get_invoice_service)
):
    """
    Mark invoice as sent.
    
    Changes status from DRAFT to SENT.
    """
    try:
        invoice = invoice_service.mark_invoice_sent(invoice_id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/invoices/{invoice_id}/mark-paid", response_model=InvoiceResponse)
async def mark_invoice_paid(
    invoice_id: int,
    data: InvoiceMarkPaid,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    invoice_service: InvoiceService = Depends(get_invoice_service)
):
    """
    Mark invoice as paid.
    
    Records payment details and updates status to PAID.
    """
    try:
        invoice = invoice_service.mark_invoice_paid(
            invoice_id,
            payment_method=data.payment_method.value,
            payment_reference=data.payment_reference,
            paid_date=data.paid_date
        )
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete invoice (draft only).
    
    Only draft invoices can be deleted.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Only draft invoices can be deleted"
        )
    
    db.delete(invoice)
    db.commit()
    
    return None


# ============================================================================
# Expense Endpoints
# ============================================================================

@router.post("/expenses/", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    expense_service: ExpenseService = Depends(get_expense_service)
):
    """
    Create a new expense record.
    
    - Categorize expenses for reporting
    - Track vendor information
    - Upload receipts (TODO: file upload)
    """
    try:
        expense = expense_service.create_expense(
            tenant_id=tenant_ctx.tenant_id,
            description=data.description,
            category=data.category,
            amount_cents=data.amount_cents,
            expense_date=data.expense_date,
            created_by=current_user.id,
            vendor_name=data.vendor_name,
            vendor_reference=data.vendor_reference,
            payment_method=data.payment_method.value,
            is_tax_deductible=data.is_tax_deductible,
            tax_rate=data.tax_rate,
            notes=data.notes,
        )
        
        return expense
    except Exception as e:
        logger.error(f"Error creating expense: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/expenses/", response_model=List[ExpenseResponse])
async def list_expenses(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    category: Optional[ExpenseCategory] = Query(None),
    approved_only: bool = Query(False),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """
    List expenses with optional filters.
    
    - Filter by category
    - Filter by approval status
    - Filter by date range
    - Paginated results
    """
    query = db.query(Expense).filter(Expense.tenant_id == tenant_ctx.tenant_id)
    
    if category:
        query = query.filter(Expense.category == category)
    
    if approved_only:
        query = query.filter(Expense.is_approved == True)  # noqa: E712
    
    if start_date:
        query = query.filter(Expense.expense_date >= start_date)
    
    if end_date:
        query = query.filter(Expense.expense_date <= end_date)
    
    expenses = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit).all()
    
    return expenses


@router.get("/expenses/export")
def export_expenses(
    format: str = Query("csv", description="Export format: csv"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export expenses as CSV."""
    query = db.query(Expense).filter(Expense.tenant_id == current_user.tenant_id)

    if category:
        query = query.filter(Expense.category == category)

    expenses = query.order_by(Expense.expense_date.desc()).all()

    columns = [
        ("expense_date", "Date"),
        ("description", "Description"),
        ("category", "Category"),
        ("vendor_name", "Vendor"),
        ("payment_method", "Payment Method"),
        ("amount", "Amount (ZAR)"),
        ("is_tax_deductible", "Tax Deductible"),
        ("is_approved", "Approved"),
    ]

    export_rows = []
    for exp in expenses:
        export_rows.append({
            "expense_date": exp.expense_date.isoformat() if exp.expense_date else "",
            "description": exp.description or "",
            "category": exp.category.value if exp.category else "",
            "vendor_name": exp.vendor_name or "",
            "payment_method": exp.payment_method.value if exp.payment_method else "",
            "amount": f"{(exp.amount_cents or 0) / 100:.2f}",
            "is_tax_deductible": "Yes" if exp.is_tax_deductible else "No",
            "is_approved": "Yes" if exp.is_approved else "No",
        })

    today = date.today().isoformat()
    return generate_csv(export_rows, columns, f"expenses_{today}.csv")


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get expense details by ID."""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return expense


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update expense details."""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)
    
    db.commit()
    db.refresh(expense)
    
    return expense


@router.post("/expenses/{expense_id}/approve", response_model=ExpenseResponse)
async def approve_expense(
    expense_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    expense_service: ExpenseService = Depends(get_expense_service)
):
    """
    Approve an expense.
    
    Records who approved and when.
    """
    try:
        expense = expense_service.approve_expense(expense_id, current_user.id)
        return expense
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an expense record."""
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(expense)
    db.commit()
    
    return None


# ============================================================================
# Financial Reports Endpoints
# ============================================================================

@router.get("/reports/profit-loss", response_model=ProfitAndLossResponse)
async def get_profit_and_loss(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: date = Query(..., description="Report start date"),
    end_date: date = Query(..., description="Report end date"),
    report_service: FinancialReportService = Depends(get_financial_report_service)
):
    """
    Generate Profit & Loss statement.
    
    - Total revenue from all sources
    - Total expenses by category
    - Gross profit and profit margin
    - Custom date range
    """
    try:
        report = report_service.get_profit_and_loss(
            tenant_id=tenant_ctx.tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return report
    except Exception as e:
        logger.error(f"Error generating P&L report: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/profit-loss/export")
def export_profit_loss(
    format: str = Query("pdf", description="Export format: pdf or csv"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export Profit & Loss report as PDF or CSV."""
    report_service = FinancialReportService(db)

    effective_start = start_date or date.today().replace(month=1, day=1)
    effective_end = end_date or date.today()

    report = report_service.get_profit_and_loss(
        tenant_id=current_user.tenant_id,
        start_date=effective_start,
        end_date=effective_end,
    )

    revenue = report.get("revenue", {})
    expenses = report.get("expenses", {})

    rows: list[dict] = []

    # Revenue lines
    for key, value in revenue.items():
        if key == "total_revenue_cents":
            continue
        label = key.replace("_cents", "").replace("_", " ").title()
        rows.append({"category": f"Revenue: {label}", "amount": f"{value / 100:.2f}"})

    rows.append({"category": "Total Revenue", "amount": f"{revenue.get('total_revenue_cents', 0) / 100:.2f}"})
    rows.append({"category": "", "amount": ""})

    # Expense lines
    for key, value in expenses.items():
        if key == "total_expenses_cents":
            continue
        label = key.replace("_cents", "").replace("_", " ").title()
        rows.append({"category": f"Expense: {label}", "amount": f"{value / 100:.2f}"})

    rows.append({"category": "Total Expenses", "amount": f"{expenses.get('total_expenses_cents', 0) / 100:.2f}"})
    rows.append({"category": "", "amount": ""})

    gross_profit = report.get("gross_profit_cents", 0)
    net_profit = report.get("net_profit_cents", 0)
    margin = report.get("profit_margin", 0)

    rows.append({"category": "Gross Profit", "amount": f"{gross_profit / 100:.2f}"})
    rows.append({"category": "Net Profit", "amount": f"{net_profit / 100:.2f}"})
    rows.append({"category": "Profit Margin", "amount": f"{margin:.2f}%"})

    columns = [("category", "Category"), ("amount", "Amount (ZAR)")]
    date_range = f"{effective_start.isoformat()} to {effective_end.isoformat()}"
    filename_base = f"profit_loss_{effective_start.isoformat()}_{effective_end.isoformat()}"

    if format == "csv":
        return generate_csv(rows, columns, f"{filename_base}.csv")

    # Default: PDF
    totals = {
        "category": "Net Profit",
        "amount": f"{net_profit / 100:.2f}",
    }
    return generate_pdf_report(
        title="Profit & Loss Report",
        subtitle=date_range,
        columns=columns,
        rows=rows,
        totals=totals,
        filename=f"{filename_base}.pdf",
        business_name="",
    )


@router.get("/reports/monthly-comparison", response_model=List[MonthlyComparisonResponse])
async def get_monthly_comparison(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    year: int = Query(..., ge=2020, le=2100),
    report_service: FinancialReportService = Depends(get_financial_report_service)
):
    """
    Get month-by-month comparison for a year.
    
    - Revenue, expenses, and profit for each month
    - Useful for trend analysis and charts
    - Year-over-year comparisons
    """
    try:
        comparison = report_service.get_monthly_comparison(
            tenant_id=tenant_ctx.tenant_id,
            year=year
        )
        
        return comparison
    except Exception as e:
        logger.error(f"Error generating monthly comparison: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/revenue-summary")
async def get_revenue_summary(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: date = Query(...),
    end_date: date = Query(...),
    report_service: FinancialReportService = Depends(get_financial_report_service)
):
    """
    Get revenue summary from all sources.
    
    - Orders revenue (e-commerce, carwash)
    - Sales revenue (POS retail)
    - Payments revenue
    - Invoices revenue (paid invoices)
    """
    try:
        summary = report_service.get_revenue_summary(
            tenant_id=tenant_ctx.tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return summary
    except Exception as e:
        logger.error(f"Error generating revenue summary: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/expense-summary")
async def get_expense_summary(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: date = Query(...),
    end_date: date = Query(...),
    approved_only: bool = Query(True),
    report_service: FinancialReportService = Depends(get_financial_report_service)
):
    """
    Get expense summary by category.
    
    - Total expenses
    - Breakdown by category
    - Optional: approved expenses only
    """
    try:
        summary = report_service.get_expense_summary(
            tenant_id=tenant_ctx.tenant_id,
            start_date=start_date,
            end_date=end_date,
            approved_only=approved_only
        )
        
        return summary
    except Exception as e:
        logger.error(f"Error generating expense summary: {e}")
        raise HTTPException(status_code=400, detail=str(e))
