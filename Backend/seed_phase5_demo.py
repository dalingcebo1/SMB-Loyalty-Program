"""
Seed script for Phase 5 demo data: Campaigns and Financial records.

Creates realistic demo data for testing marketing campaigns and financial management features.

Usage:
    cd Backend
    python seed_phase5_demo.py

Requirements:
    - Existing tenant (created by seed_all.py or seed_default_tenant.py)
    - Customer records in database
"""
import sys
import logging
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Add Backend to path
if 'Backend' not in sys.path[0]:
    sys.path.insert(0, 'Backend')

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models import User, Tenant
from models import Customer, Product

# Import Phase 5 models
from app.vertical_models.campaigns import (
    Campaign,
    CampaignRecipient,
    CampaignType,
    CampaignStatus,
    SegmentType,
    DeliveryStatus,
)
from app.vertical_models.financial import (
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
    PaymentMethod,
    Expense,
    ExpenseCategory,
    ExpenseStatus,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_or_create_admin_user(db: Session, tenant_id: str) -> User:
    """Get existing admin user or create demo admin."""
    admin = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.role == 'admin'
    ).first()
    
    if not admin:
        logger.info(f"Creating demo admin user for tenant {tenant_id}")
        admin = User(
            tenant_id=tenant_id,
            email=f"admin@{tenant_id}.com",
            name="Demo Admin",
            role="admin",
            is_active=True,
        )
        # Note: Set password via proper auth flow in real scenarios
        db.add(admin)
        db.flush()
    
    return admin


def create_sample_customers(db: Session, tenant_id: str, count: int = 50) -> list:
    """Create sample customers if not enough exist."""
    existing = db.query(Customer).filter(Customer.tenant_id == tenant_id).all()
    
    if len(existing) >= count:
        logger.info(f"✓ Found {len(existing)} existing customers for tenant {tenant_id}")
        return existing[:count]
    
    logger.info(f"Creating {count - len(existing)} sample customers...")
    
    first_names = [
        "Sarah", "John", "Emma", "Michael", "Olivia", "James", "Ava", "Robert",
        "Isabella", "David", "Sophia", "William", "Mia", "Richard", "Charlotte",
        "Thomas", "Amelia", "Charles", "Emily", "Daniel"
    ]
    
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
        "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor",
        "Thomas", "Moore", "Jackson", "Martin", "Lee", "White", "Harris"
    ]
    
    customers = list(existing)
    
    for i in range(count - len(existing)):
        first = random.choice(first_names)
        last = random.choice(last_names)
        
        customer = Customer(
            tenant_id=tenant_id,
            name=f"{first} {last}",
            email=f"{first.lower()}.{last.lower()}{i}@example.com",
            phone=f"+2782{random.randint(1000000, 9999999)}",
            is_active=True,
            created_at=datetime.now() - timedelta(days=random.randint(1, 365)),
        )
        db.add(customer)
        customers.append(customer)
    
    db.flush()
    logger.info(f"✓ Created {count - len(existing)} new customers")
    return customers


def seed_campaigns(db: Session, tenant_id: str, admin_user: User, customers: list):
    """Create sample marketing campaigns with recipients."""
    logger.info("Seeding marketing campaigns...")
    
    # Check if campaigns already exist
    existing_count = db.query(Campaign).filter(Campaign.tenant_id == tenant_id).count()
    if existing_count > 0:
        logger.info(f"✓ Found {existing_count} existing campaigns, skipping...")
        return
    
    campaigns_data = [
        {
            "name": "VIP Customer Appreciation (Sent)",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.COMPLETED,
            "segment_type": SegmentType.HIGH_VALUE,
            "subject": "Thank You for Being a VIP Customer! 🎁",
            "content": """
                <h1>You're Amazing!</h1>
                <p>As one of our most valued customers, we wanted to say a huge thank you!</p>
                <p>Your support means the world to us. Enjoy 25% off your next purchase with code <strong>VIP25</strong>.</p>
                <p>Valid until next Sunday!</p>
            """,
            "ai_generated": True,
            "ai_prompt": "Thank VIP customers and offer 25% discount",
            "scheduled_at": None,
            "sent_at": datetime.now() - timedelta(days=7),
            "recipient_count": 20,
            "open_rate": 0.65,
            "click_rate": 0.28,
        },
        {
            "name": "Flash Sale Alert (Sent)",
            "campaign_type": CampaignType.SMS,
            "status": CampaignStatus.COMPLETED,
            "segment_type": SegmentType.ACTIVE,
            "subject": None,
            "content": "⚡ Flash Sale! 30% off everything for 3 hours only. Shop now: https://shop.example.com/flash",
            "ai_generated": False,
            "ai_prompt": None,
            "scheduled_at": None,
            "sent_at": datetime.now() - timedelta(days=3),
            "recipient_count": 35,
            "open_rate": 1.0,  # SMS always "opened"
            "click_rate": 0.15,
        },
        {
            "name": "Win-Back Campaign (Sent)",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.COMPLETED,
            "segment_type": SegmentType.AT_RISK,
            "subject": "We Miss You! Here's 15% Off to Welcome You Back 💙",
            "content": """
                <h1>We Miss You!</h1>
                <p>It's been a while since we've seen you. We'd love to have you back!</p>
                <p>As a special welcome back gift, enjoy 15% off with code <strong>COMEBACK15</strong>.</p>
                <p>We've added tons of new products you might love!</p>
            """,
            "ai_generated": True,
            "ai_prompt": "We miss you! Come back with 15% off",
            "scheduled_at": None,
            "sent_at": datetime.now() - timedelta(days=14),
            "recipient_count": 42,
            "open_rate": 0.23,
            "click_rate": 0.05,
        },
        {
            "name": "New Arrivals Announcement (Draft)",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.DRAFT,
            "segment_type": SegmentType.ACTIVE,
            "subject": "🆕 New Arrivals Just Dropped!",
            "content": """
                <h1>Fresh Styles Just Arrived</h1>
                <p>Check out our latest collection - perfect for the season!</p>
                <p>Be the first to shop these exclusive new items.</p>
            """,
            "ai_generated": True,
            "ai_prompt": "Promote new product arrivals",
            "scheduled_at": None,
            "sent_at": None,
            "recipient_count": 0,
            "open_rate": 0.0,
            "click_rate": 0.0,
        },
        {
            "name": "Weekend Sale (Scheduled)",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.SCHEDULED,
            "segment_type": SegmentType.ALL,
            "subject": "🎉 Weekend Sale - 40% Off Everything!",
            "content": """
                <h1>Weekend Extravaganza!</h1>
                <p>This weekend only - enjoy 40% off EVERYTHING in store!</p>
                <p>No code needed, discount applied automatically at checkout.</p>
                <p>Sale starts Saturday 9 AM and ends Sunday midnight.</p>
            """,
            "ai_generated": True,
            "ai_prompt": "Promote 40% off weekend sale",
            "scheduled_at": datetime.now() + timedelta(days=2),
            "sent_at": None,
            "recipient_count": 0,
            "open_rate": 0.0,
            "click_rate": 0.0,
        },
    ]
    
    created_campaigns = []
    
    for campaign_data in campaigns_data:
        # Determine recipient count based on segment
        if campaign_data["recipient_count"] == 0:
            # Draft/scheduled campaigns
            if campaign_data["segment_type"] == SegmentType.ALL:
                recipient_count = len(customers)
            elif campaign_data["segment_type"] == SegmentType.ACTIVE:
                recipient_count = int(len(customers) * 0.7)  # 70% active
            elif campaign_data["segment_type"] == SegmentType.HIGH_VALUE:
                recipient_count = int(len(customers) * 0.2)  # Top 20%
            else:
                recipient_count = int(len(customers) * 0.3)
        else:
            recipient_count = min(campaign_data["recipient_count"], len(customers))
        
        # Calculate delivery metrics from rates
        total_recipients = recipient_count
        sent_count = recipient_count if campaign_data["status"] == CampaignStatus.COMPLETED else 0
        delivered_count = int(sent_count * 0.98)  # 98% delivery rate
        opened_count = int(delivered_count * campaign_data["open_rate"])
        clicked_count = int(delivered_count * campaign_data["click_rate"])
        failed_count = sent_count - delivered_count
        
        campaign = Campaign(
            tenant_id=tenant_id,
            name=campaign_data["name"],
            campaign_type=campaign_data["campaign_type"],
            status=campaign_data["status"],
            segment_type=campaign_data["segment_type"],
            segment_config={},
            subject=campaign_data["subject"],
            content=campaign_data["content"],
            ai_generated=campaign_data["ai_generated"],
            ai_prompt=campaign_data["ai_prompt"],
            scheduled_at=campaign_data["scheduled_at"],
            sent_at=campaign_data["sent_at"],
            total_recipients=total_recipients,
            sent_count=sent_count,
            delivered_count=delivered_count,
            opened_count=opened_count,
            clicked_count=clicked_count,
            failed_count=failed_count,
            created_by=admin_user.id,
            created_at=campaign_data["sent_at"] - timedelta(hours=2) if campaign_data["sent_at"] else datetime.now(),
        )
        
        db.add(campaign)
        db.flush()
        
        # Create recipient records for sent campaigns
        if campaign.status == CampaignStatus.COMPLETED:
            selected_customers = random.sample(customers, min(recipient_count, len(customers)))
            
            for customer in selected_customers:
                # Determine delivery status
                delivered = random.random() < 0.98  # 98% delivery rate
                opened = delivered and random.random() < campaign_data["open_rate"]
                clicked = opened and random.random() < (campaign_data["click_rate"] / campaign_data["open_rate"] if campaign_data["open_rate"] > 0 else 0)
                
                if not delivered:
                    status = DeliveryStatus.FAILED
                    error_message = random.choice([
                        "Invalid email address",
                        "Mailbox full",
                        "Email address does not exist",
                    ]) if campaign.campaign_type == CampaignType.EMAIL else "Invalid phone number"
                elif not opened:
                    status = DeliveryStatus.DELIVERED
                    error_message = None
                elif not clicked:
                    status = DeliveryStatus.OPENED
                    error_message = None
                else:
                    status = DeliveryStatus.CLICKED
                    error_message = None
                
                recipient = CampaignRecipient(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    customer_name=customer.name,
                    contact_value=customer.email if campaign.campaign_type == CampaignType.EMAIL else customer.phone,
                    delivery_status=status,
                    sent_at=campaign.sent_at,
                    delivered_at=campaign.sent_at + timedelta(seconds=random.randint(5, 300)) if delivered else None,
                    opened_at=campaign.sent_at + timedelta(hours=random.randint(1, 48)) if opened else None,
                    clicked_at=campaign.sent_at + timedelta(hours=random.randint(1, 72)) if clicked else None,
                    error_message=error_message,
                )
                db.add(recipient)
        
        created_campaigns.append(campaign)
        logger.info(f"  ✓ Created campaign: {campaign.name} ({campaign.status.value})")
    
    db.commit()
    logger.info(f"✓ Created {len(created_campaigns)} campaigns with recipients")


def seed_invoices(db: Session, tenant_id: str, admin_user: User, customers: list):
    """Create sample invoices with line items and payments."""
    logger.info("Seeding invoices...")
    
    # Check if invoices already exist
    existing_count = db.query(Invoice).filter(Invoice.tenant_id == tenant_id).count()
    if existing_count > 0:
        logger.info(f"✓ Found {existing_count} existing invoices, skipping...")
        return
    
    # Get some products for line items (if they exist)
    products = db.query(Product).filter(Product.tenant_id == tenant_id).limit(10).all()
    
    invoices_data = [
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PAID,
            "issued_date": datetime.now() - timedelta(days=60),
            "due_date_offset": 30,
            "paid_date_offset": 25,
            "line_items": [
                {"desc": "Premium Consulting Services", "qty": 40, "price": 125000},
                {"desc": "Software License (Annual)", "qty": 1, "price": 599900},
            ],
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PAID,
            "issued_date": datetime.now() - timedelta(days=45),
            "due_date_offset": 30,
            "paid_date_offset": 28,
            "line_items": [
                {"desc": "Product Bundle A", "qty": 5, "price": 129900},
                {"desc": "Product Bundle B", "qty": 3, "price": 89900},
            ],
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PARTIALLY_PAID,
            "issued_date": datetime.now() - timedelta(days=20),
            "due_date_offset": 30,
            "paid_date_offset": None,
            "partial_payment": 150000,  # Partial payment amount in cents
            "line_items": [
                {"desc": "Custom Development Work", "qty": 60, "price": 150000},
            ],
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.SENT,
            "issued_date": datetime.now() - timedelta(days=15),
            "due_date_offset": 30,
            "paid_date_offset": None,
            "line_items": [
                {"desc": "Monthly Retainer - February", "qty": 1, "price": 750000},
                {"desc": "Additional Support Hours", "qty": 5, "price": 125000},
            ],
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.OVERDUE,
            "issued_date": datetime.now() - timedelta(days=50),
            "due_date_offset": 15,  # Short payment terms
            "paid_date_offset": None,
            "line_items": [
                {"desc": "Product Sale", "qty": 10, "price": 49900},
            ],
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.DRAFT,
            "issued_date": datetime.now(),
            "due_date_offset": 30,
            "paid_date_offset": None,
            "line_items": [
                {"desc": "New Project Quote", "qty": 80, "price": 125000},
                {"desc": "Setup Fee", "qty": 1, "price": 250000},
            ],
        },
    ]
    
    created_invoices = []
    
    for idx, inv_data in enumerate(invoices_data):
        # Generate invoice number
        invoice_number = f"INV-{datetime.now().year}-{(idx + 1):04d}"
        
        # Calculate totals
        subtotal_cents = sum(item["qty"] * item["price"] for item in inv_data["line_items"])
        tax_cents = int(subtotal_cents * 0.15)  # 15% VAT
        discount_cents = 0
        total_cents = subtotal_cents + tax_cents - discount_cents
        
        # Determine paid amount
        if inv_data["status"] == InvoiceStatus.PAID:
            paid_cents = total_cents
        elif inv_data["status"] == InvoiceStatus.PARTIALLY_PAID:
            paid_cents = inv_data.get("partial_payment", int(total_cents * 0.5))
        else:
            paid_cents = 0
        
        customer = inv_data["customer"]
        issued_date = inv_data["issued_date"]
        due_date = issued_date + timedelta(days=inv_data["due_date_offset"])
        
        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=invoice_number,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_email=customer.email,
            customer_phone=customer.phone,
            customer_address=None,
            status=inv_data["status"],
            subtotal_cents=subtotal_cents,
            tax_cents=tax_cents,
            discount_cents=discount_cents,
            total_cents=total_cents,
            paid_cents=paid_cents,
            issued_date=issued_date.date(),
            due_date=due_date.date(),
            paid_date=(issued_date + timedelta(days=inv_data["paid_date_offset"])).date() if inv_data["paid_date_offset"] else None,
            notes="Thank you for your business!",
            terms="Payment due within specified days. Late payments subject to interest.",
            created_by=admin_user.id,
            created_at=issued_date,
        )
        
        db.add(invoice)
        db.flush()
        
        # Add line items
        for item_data in inv_data["line_items"]:
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item_data["desc"],
                quantity=item_data["qty"],
                unit_price_cents=item_data["price"],
                total_cents=item_data["qty"] * item_data["price"],
                product_id=products[0].id if products else None,
            )
            db.add(line_item)
        
        created_invoices.append(invoice)
        logger.info(f"  ✓ Created invoice: {invoice.invoice_number} - {invoice.status.value}")
    
    db.commit()
    logger.info(f"✓ Created {len(created_invoices)} invoices with line items")


def seed_expenses(db: Session, tenant_id: str, admin_user: User):
    """Create sample business expenses."""
    logger.info("Seeding expenses...")
    
    # Check if expenses already exist
    existing_count = db.query(Expense).filter(Expense.tenant_id == tenant_id).count()
    if existing_count > 0:
        logger.info(f"✓ Found {existing_count} existing expenses, skipping...")
        return
    
    expenses_data = [
        {"category": ExpenseCategory.RENT, "amount": 1250000, "desc": "Office Rent - February 2026", "vendor": "Property Management Co", "days_ago": 5},
        {"category": ExpenseCategory.UTILITIES, "amount": 285000, "desc": "Electricity and Water", "vendor": "City Power", "days_ago": 10},
        {"category": ExpenseCategory.MARKETING, "amount": 845000, "desc": "Facebook Ads Campaign", "vendor": "Meta Ads", "days_ago": 7},
        {"category": ExpenseCategory.OFFICE_SUPPLIES, "amount": 124000, "desc": "Printer paper and ink", "vendor": "Office Mart", "days_ago": 3},
        {"category": ExpenseCategory.PROFESSIONAL_SERVICES, "amount": 450000, "desc": "Accounting Services - January", "vendor": "ABC Accounting", "days_ago": 15},
        {"category": ExpenseCategory.SALARIES, "amount": 4200000, "desc": "Staff Salaries - February", "vendor": "Payroll", "days_ago": 2},
        {"category": ExpenseCategory.TRAVEL, "amount": 198000, "desc": "Client meeting - Cape Town", "vendor": "Various", "days_ago": 12},
        {"category": ExpenseCategory.EQUIPMENT, "amount": 1250000, "desc": "New laptop computers (2x)", "vendor": "Tech Store", "days_ago": 20},
        {"category": ExpenseCategory.MARKETING, "amount": 325000, "desc": "Google Ads Campaign", "vendor": "Google Ads", "days_ago": 8},
        {"category": ExpenseCategory.UTILITIES, "amount": 175000, "desc": "Internet and Phone Services", "vendor": "Telkom", "days_ago": 6},
        {"category": ExpenseCategory.OFFICE_SUPPLIES, "amount": 45000, "desc": "Coffee and refreshments", "vendor": "Supermarket", "days_ago": 4},
        {"category": ExpenseCategory.MISCELLANEOUS, "amount": 84500, "desc": "Business insurance premium", "vendor": "Insurance Co", "days_ago": 25},
    ]
    
    created_expenses = []
    
    for exp_data in expenses_data:
        expense_date = datetime.now() - timedelta(days=exp_data["days_ago"])
        
        # Most expenses approved, some pending
        if exp_data["days_ago"] <= 5:
            status = ExpenseStatus.PENDING
            approved_at = None
            approved_by = None
        else:
            status = ExpenseStatus.APPROVED
            approved_at = expense_date + timedelta(days=1)
            approved_by = admin_user.id
        
        expense = Expense(
            tenant_id=tenant_id,
            amount_cents=exp_data["amount"],
            category=exp_data["category"],
            description=exp_data["desc"],
            expense_date=expense_date.date(),
            vendor=exp_data["vendor"],
            payment_method=random.choice([PaymentMethod.BANK_TRANSFER, PaymentMethod.CREDIT_CARD, PaymentMethod.CASH]),
            status=status,
            receipt_url=None,
            notes=None,
            submitted_by=admin_user.id,
            approved_by=approved_by,
            approved_at=approved_at,
            created_at=expense_date,
        )
        
        db.add(expense)
        created_expenses.append(expense)
        logger.info(f"  ✓ Created expense: {exp_data['category'].value} - R{exp_data['amount'] / 100:.2f}")
    
    db.commit()
    logger.info(f"✓ Created {len(created_expenses)} expenses")


def main():
    """Main seeding function."""
    logger.info("=" * 60)
    logger.info("Starting Phase 5 Demo Data Seeding")
    logger.info("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get default tenant
        tenant = db.query(Tenant).first()
        if not tenant:
            logger.error("❌ No tenant found! Run seed_all.py or seed_default_tenant.py first.")
            return 1
        
        tenant_id = tenant.id
        logger.info(f"Using tenant: {tenant_id}")
        
        # Get or create admin user
        admin_user = get_or_create_admin_user(db, tenant_id)
        db.commit()
        
        # Create sample customers
        customers = create_sample_customers(db, tenant_id, count=50)
        db.commit()
        
        # Seed campaigns
        seed_campaigns(db, tenant_id, admin_user, customers)
        
        # Seed invoices
        seed_invoices(db, tenant_id, admin_user, customers)
        
        # Seed expenses
        seed_expenses(db, tenant_id, admin_user)
        
        logger.info("=" * 60)
        logger.info("✅ Phase 5 Demo Data Seeding Complete!")
        logger.info("=" * 60)
        logger.info("")
        logger.info("Summary:")
        logger.info(f"  - Tenant: {tenant_id}")
        logger.info(f"  - Customers: {len(customers)}")
        logger.info(f"  - Campaigns: {db.query(Campaign).filter(Campaign.tenant_id == tenant_id).count()}")
        logger.info(f"  - Invoices: {db.query(Invoice).filter(Invoice.tenant_id == tenant_id).count()}")
        logger.info(f"  - Expenses: {db.query(Expense).filter(Expense.tenant_id == tenant_id).count()}")
        logger.info("")
        logger.info("Next steps:")
        logger.info("  1. Start the server: uvicorn main:app --reload")
        logger.info("  2. View campaigns: http://localhost:8000/api/campaigns")
        logger.info("  3. View invoices: http://localhost:8000/api/financial/invoices")
        logger.info("  4. View P&L report: http://localhost:8000/api/financial/reports/profit-loss")
        
        return 0
        
    except Exception as e:
        logger.error(f"❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 1
        
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
