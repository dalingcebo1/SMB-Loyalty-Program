#!/usr/bin/env python3
"""
Seed Demo Data for Phase 5 Features

Creates realistic test data for:
- Marketing campaigns (email/SMS with various statuses)
- Campaign recipients with delivery tracking
- Financial invoices (draft, sent, paid, overdue)
- Expenses by category
- Historical orders for P&L reporting

Usage:
    python scripts/seed_phase5_demo.py

Requirements:
    - Database must be initialized (alembic upgrade head)
    - At least one tenant must exist
    - Run from Backend/ directory
"""

import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from models import Tenant, User
from app.vertical_models.campaigns import (
    Campaign,
    CampaignRecipient,
    CampaignType,
    CampaignStatus,
    SegmentType,
)
from app.vertical_models.financial import (
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
    Expense,
    ExpenseCategory,
    PaymentMethod,
)


def get_or_create_demo_tenant(db: Session) -> tuple[Tenant, list[User]]:
    """Get existing tenant or create demo tenant with users."""
    # Try to get first available tenant
    tenant = db.query(Tenant).first()
    
    if not tenant:
        print("No tenant found. Creating demo tenant...")
        tenant = Tenant(
            id="demo-retail",
            name="Demo Retail Store",
            slug="demo-retail",
            vertical="retail",
            is_active=True,
            created_at=datetime.now(),
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        print(f"✓ Created tenant: {tenant.name} ({tenant.id})")
    else:
        print(f"✓ Using existing tenant: {tenant.name} ({tenant.id})")
    
    # Get or create customers for this tenant
    customers = db.query(User).filter(
        User.tenant_id == tenant.id,
        User.role == "customer"
    ).limit(50).all()
    
    if len(customers) < 10:
        print(f"Found only {len(customers)} customers. Creating more...")
        customers = create_demo_customers(db, str(tenant.id), count=50)
    else:
        print(f"✓ Found {len(customers)} existing customers")
    
    return tenant, customers


def create_demo_customers(db: Session, tenant_id: str, count: int = 50) -> list[User]:
    """Create demo customer accounts."""
    first_names = [
        "Sarah", "John", "Emma", "Michael", "Olivia", "James", "Ava", "William",
        "Sophia", "David", "Isabella", "Robert", "Mia", "Daniel", "Charlotte",
        "Matthew", "Amelia", "Joseph", "Harper", "Christopher", "Evelyn", "Andrew",
        "Abigail", "Joshua", "Emily", "Alexander", "Elizabeth", "Ryan", "Sofia", "Nathan"
    ]
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas",
        "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris"
    ]
    
    customers = []
    for i in range(count):
        first = random.choice(first_names)
        last = random.choice(last_names)
        email = f"{first.lower()}.{last.lower()}{i}@example.com"
        phone = f"+2782{random.randint(1000000, 9999999)}"
        
        # Check if customer already exists
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            customers.append(exists)
            continue
        
        customer = User(
            tenant_id=tenant_id,
            email=email,
            name=f"{first} {last}",
            phone=phone,
            role="customer",
            is_active=True,
            created_at=datetime.now() - timedelta(days=random.randint(1, 365)),
        )
        db.add(customer)
        customers.append(customer)
    
    db.commit()
    print(f"✓ Created/found {len(customers)} customers")
    return customers


def seed_campaigns(db: Session, tenant_id: str, customers: list[User]):
    """Create demo marketing campaigns."""
    print("\n📧 Seeding Marketing Campaigns...")
    
    campaigns_data = [
        {
            "name": "Welcome New Customers",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.SENT,
            "segment_type": SegmentType.NEW,
            "subject": "Welcome to Our Store! 🎉",
            "content": "<h1>Welcome!</h1><p>Thank you for joining us. Enjoy 10% off your first purchase with code WELCOME10.</p>",
            "ai_generated": True,
            "sent_at": datetime.now() - timedelta(days=7),
            "recipients": 20,
            "delivered": 19,
            "opened": 12,
            "clicked": 5,
        },
        {
            "name": "VIP Customer Appreciation",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.SENT,
            "segment_type": SegmentType.HIGH_VALUE,
            "subject": "Thank You for Being a VIP! 25% Off Just for You 🎁",
            "content": "<h1>You're Amazing!</h1><p>As a thank you for your loyalty, enjoy 25% off with code VIP25.</p>",
            "ai_generated": True,
            "sent_at": datetime.now() - timedelta(days=5),
            "recipients": 15,
            "delivered": 15,
            "opened": 10,
            "clicked": 6,
        },
        {
            "name": "Win-Back Dormant Customers",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.SENT,
            "segment_type": SegmentType.DORMANT,
            "subject": "We Miss You! Come Back for 15% Off 💙",
            "content": "<h1>We haven't seen you in a while!</h1><p>Here's 15% off to welcome you back. Code: COMEBACK15</p>",
            "ai_generated": True,
            "sent_at": datetime.now() - timedelta(days=3),
            "recipients": 30,
            "delivered": 28,
            "opened": 8,
            "clicked": 2,
        },
        {
            "name": "Flash Sale SMS Alert",
            "campaign_type": CampaignType.SMS,
            "status": CampaignStatus.SENT,
            "segment_type": SegmentType.HIGH_VALUE,
            "subject": None,
            "content": "⚡ Flash Sale! 30% off for 3 hours only. Shop now: https://shop.example.com/flash",
            "ai_generated": False,
            "sent_at": datetime.now() - timedelta(hours=4),
            "recipients": 50,
            "delivered": 48,
            "opened": 0,  # SMS doesn't track opens
            "clicked": 0,
        },
        {
            "name": "Spring Sale Preview - DRAFT",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.DRAFT,
            "segment_type": SegmentType.ALL,
            "subject": "🌸 Spring Sale Preview - Exclusive Early Access",
            "content": "<h1>Get Ready for Spring!</h1><p>Our biggest sale of the season starts next week...</p>",
            "ai_generated": True,
            "sent_at": None,
            "recipients": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
        },
        {
            "name": "Holiday Greetings - SCHEDULED",
            "campaign_type": CampaignType.EMAIL,
            "status": CampaignStatus.SCHEDULED,
            "segment_type": SegmentType.ALL,
            "subject": "Happy Holidays from Our Team! 🎄",
            "content": "<h1>Season's Greetings!</h1><p>Thank you for your support this year. Enjoy 20% off all week.</p>",
            "ai_generated": False,
            "sent_at": None,
            "scheduled_at": datetime.now() + timedelta(days=3),
            "recipients": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
        },
    ]
    
    created_campaigns = []
    for data in campaigns_data:
        # Calculate rates
        delivered = data["delivered"]
        opened = data["opened"]
        clicked = data["clicked"]
        
        open_rate = (opened / delivered * 100) if delivered > 0 else 0.0
        click_rate = (clicked / delivered * 100) if delivered > 0 else 0.0
        delivery_rate = (delivered / data["recipients"] * 100) if data["recipients"] > 0 else 0.0
        
        campaign = Campaign(
            tenant_id=tenant_id,
            name=data["name"],
            campaign_type=data["campaign_type"],
            status=data["status"],
            segment_type=data["segment_type"],
            segment_config={},
            subject=data["subject"],
            content=data["content"],
            ai_generated=data["ai_generated"],
            ai_prompt=f"Generate {data['campaign_type'].value} for {data['segment_type'].value}" if data["ai_generated"] else None,
            scheduled_at=data.get("scheduled_at"),
            sent_at=data["sent_at"],
            total_recipients=data["recipients"],
            sent_count=data["recipients"] if data["sent_at"] else 0,
            delivered_count=delivered,
            opened_count=opened,
            clicked_count=clicked,
            failed_count=data["recipients"] - delivered if data["sent_at"] else 0,
            open_rate=open_rate,
            click_rate=click_rate,
            delivery_rate=delivery_rate,
            created_at=datetime.now() - timedelta(days=random.randint(1, 14)),
        )
        db.add(campaign)
        db.flush()  # Get campaign.id
        
        # Create recipients for sent campaigns
        if data["sent_at"] and data["recipients"] > 0:
            recipient_customers = random.sample(customers, min(data["recipients"], len(customers)))
            
            for idx, customer in enumerate(recipient_customers):
                # Initialize all timestamps as None
                sent_at = data["sent_at"]
                delivered_at = None
                opened_at = None
                clicked_at = None
                failed_at = None
                error_message = None
                
                # Determine delivery status by setting appropriate timestamps
                if idx < delivered:
                    # Successfully delivered
                    delivered_at = data["sent_at"] + timedelta(seconds=random.randint(5, 300))
                    
                    # Check if opened (email only)
                    if idx < opened and data["campaign_type"] == CampaignType.EMAIL:
                        opened_at = delivered_at + timedelta(minutes=random.randint(10, 1440))
                        
                        # Check if clicked
                        if idx < clicked:
                            clicked_at = opened_at + timedelta(minutes=random.randint(1, 60))
                else:
                    # Failed delivery
                    failed_at = data["sent_at"] + timedelta(seconds=random.randint(1, 30))
                    error_message = random.choice([
                        "Invalid email address",
                        "Mailbox full",
                        "Recipient blocked sender",
                        "Invalid phone number",
                        "Phone number inactive"
                    ])
                
                recipient = CampaignRecipient(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    tenant_id=tenant_id,
                    recipient_email=customer.email if data["campaign_type"] == CampaignType.EMAIL else None,
                    recipient_phone=customer.phone if data["campaign_type"] == CampaignType.SMS else None,
                    sent_at=sent_at,
                    delivered_at=delivered_at,
                    opened_at=opened_at,
                    clicked_at=clicked_at,
                    failed_at=failed_at,
                    error_message=error_message,
                )
                db.add(recipient)
        
        created_campaigns.append(campaign)
    
    db.commit()
    print(f"✓ Created {len(created_campaigns)} campaigns")
    
    # Print summary
    for c in created_campaigns:
        status_emoji = {
            CampaignStatus.DRAFT: "📝",
            CampaignStatus.SCHEDULED: "⏰",
            CampaignStatus.SENDING: "📤",
            CampaignStatus.SENT: "✅",
            CampaignStatus.FAILED: "❌",
        }.get(c.status, "")
        
        type_emoji = "📧" if c.campaign_type == CampaignType.EMAIL else "📱"
        
        print(f"  {status_emoji} {type_emoji} {c.name} - {c.total_recipients} recipients")
        if c.status == CampaignStatus.SENT:
            print(f"     Delivered: {c.delivered_count} ({c.delivery_rate:.1f}%), "
                  f"Opened: {c.opened_count} ({c.open_rate:.1f}%), "
                  f"Clicked: {c.clicked_count} ({c.click_rate:.1f}%)")


def seed_invoices(db: Session, tenant_id: str, customers: list[User]):
    """Create demo invoices."""
    print("\n💰 Seeding Invoices...")
    
    invoices_data = [
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PAID,
            "line_items": [
                {"description": "Premium Widget (Model XL)", "quantity": 5, "unit_price": 129900},
                {"description": "Standard Widget", "quantity": 10, "unit_price": 79900},
            ],
            "tax_rate": 15,
            "discount_cents": 0,
            "issued_days_ago": 45,
            "paid_days_ago": 38,
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PAID,
            "line_items": [
                {"description": "Consulting Services - January 2026", "quantity": 40, "unit_price": 125000},
            ],
            "tax_rate": 15,
            "discount_cents": 0,
            "issued_days_ago": 35,
            "paid_days_ago": 20,
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.SENT,
            "line_items": [
                {"description": "Software License (Annual)", "quantity": 1, "unit_price": 599900},
                {"description": "Support Package", "quantity": 1, "unit_price": 199900},
            ],
            "tax_rate": 15,
            "discount_cents": 50000,
            "issued_days_ago": 15,
            "paid_days_ago": None,
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.OVERDUE,
            "line_items": [
                {"description": "Website Design Services", "quantity": 1, "unit_price": 1500000},
            ],
            "tax_rate": 15,
            "discount_cents": 0,
            "issued_days_ago": 50,
            "paid_days_ago": None,
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.PAID,
            "line_items": [
                {"description": "Product Bundle A", "quantity": 3, "unit_price": 299900},
                {"description": "Product Bundle B", "quantity": 2, "unit_price": 399900},
            ],
            "tax_rate": 15,
            "discount_cents": 100000,
            "issued_days_ago": 20,
            "paid_days_ago": 15,
            "partial_payment": 500000,  # R5,000 of larger amount
        },
        {
            "customer": random.choice(customers),
            "status": InvoiceStatus.DRAFT,
            "line_items": [
                {"description": "Monthly Retainer - February", "quantity": 1, "unit_price": 800000},
            ],
            "tax_rate": 15,
            "discount_cents": 0,
            "issued_days_ago": 0,
            "paid_days_ago": None,
        },
    ]
    
    created_invoices = []
    for idx, data in enumerate(invoices_data):
        customer = data["customer"]
        
        # Calculate amounts
        subtotal_cents = sum(item["quantity"] * item["unit_price"] for item in data["line_items"])
        tax_cents = int(subtotal_cents * data["tax_rate"] / 100)
        total_cents = subtotal_cents + tax_cents - data["discount_cents"]
        
        # Create invoice
        issue_date = datetime.now().date() - timedelta(days=data["issued_days_ago"])
        due_date = issue_date + timedelta(days=30)
        
        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=f"INV-{2026}{1:02d}{idx+1:03d}",
            customer_id=customer.id,
            customer_name=customer.name,
            customer_email=customer.email,
            customer_phone=customer.phone,
            customer_address=f"{random.randint(1, 999)} Main St, Cape Town, {random.randint(7700, 8001)}",
            status=data["status"],
            issue_date=issue_date,
            due_date=due_date,
            subtotal_cents=subtotal_cents,
            tax_rate=data["tax_rate"],
            tax_cents=tax_cents,
            discount_cents=data["discount_cents"],
            total_cents=total_cents,
            amount_paid_cents=data.get("partial_payment", total_cents if data["paid_days_ago"] is not None else 0),
            notes="Thank you for your business!",
            terms="Payment due within 30 days. Late payments subject to 2% monthly interest.",
            created_at=datetime.now() - timedelta(days=data["issued_days_ago"]),
        )
        
        if data["status"] in [InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE]:
            invoice.sent_at = datetime.now() - timedelta(days=data["issued_days_ago"])
        
        if data["paid_days_ago"] is not None:
            invoice.paid_at = datetime.now() - timedelta(days=data["paid_days_ago"])
            invoice.payment_method = random.choice([PaymentMethod.EFT, PaymentMethod.CARD])
        
        db.add(invoice)
        db.flush()  # Get invoice.id
        
        # Create line items
        for item in data["line_items"]:
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item["description"],
                quantity=item["quantity"],
                unit_price_cents=item["unit_price"],
                total_cents=item["quantity"] * item["unit_price"],
            )
            db.add(line_item)
        
        created_invoices.append(invoice)
    
    db.commit()
    print(f"✓ Created {len(created_invoices)} invoices")
    
    # Print summary
    for inv in created_invoices:
        status_emoji = {
            InvoiceStatus.DRAFT: "📝",
            InvoiceStatus.SENT: "📤",
            InvoiceStatus.PAID: "✅",
            # Note: PARTIALLY_PAID removed, using PAID for partial payments
            InvoiceStatus.OVERDUE: "⚠️",
            InvoiceStatus.CANCELLED: "❌",
        }.get(inv.status, "")
        
        amount = inv.total_cents / 100
        print(f"  {status_emoji} {inv.invoice_number} - {inv.customer_name} - R{amount:,.2f} ({inv.status.value})")


def seed_expenses(db: Session, tenant_id: str):
    """Create demo expenses."""
    print("\n💸 Seeding Expenses...")
    
    expenses_data = [
        # Office Supplies
        {"description": "Office supplies - printer paper, pens", "amount": 59900, "category": ExpenseCategory.OTHER, "days_ago": 5},
        {"description": "Printer ink cartridges", "amount": 129900, "category": ExpenseCategory.OTHER, "days_ago": 20},
        
        # Marketing
        {"description": "Facebook Ads - January campaign", "amount": 250000, "category": ExpenseCategory.MARKETING, "days_ago": 10},
        {"description": "Google Ads - February campaign", "amount": 350000, "category": ExpenseCategory.MARKETING, "days_ago": 3},
        {"description": "Promotional flyers printing", "amount": 89900, "category": ExpenseCategory.MARKETING, "days_ago": 15},
        
        # Utilities
        {"description": "Electricity - January", "amount": 185000, "category": ExpenseCategory.UTILITIES, "days_ago": 25},
        {"description": "Internet & Phone - January", "amount": 129900, "category": ExpenseCategory.UTILITIES, "days_ago": 25},
        {"description": "Water - January", "amount": 45000, "category": ExpenseCategory.UTILITIES, "days_ago": 25},
        
        # Rent
        {"description": "Shop rent - February", "amount": 1500000, "category": ExpenseCategory.RENT, "days_ago": 1},
        {"description": "Shop rent - January", "amount": 1500000, "category": ExpenseCategory.RENT, "days_ago": 32},
        
        # Salaries
        {"description": "Staff salaries - January", "amount": 4200000, "category": ExpenseCategory.SALARIES, "days_ago": 28},
        
        # Professional Services
        {"description": "Accountant - annual tax filing", "amount": 450000, "category": ExpenseCategory.PROFESSIONAL_SERVICES, "days_ago": 40},
        {"description": "Legal consultation", "amount": 250000, "category": ExpenseCategory.PROFESSIONAL_SERVICES, "days_ago": 50},
        
        # Travel
        {"description": "Fuel - business trips", "amount": 198000, "category": ExpenseCategory.TRAVEL, "days_ago": 7},
        {"description": "Conference accommodation", "amount": 350000, "category": ExpenseCategory.TRAVEL, "days_ago": 60},
        
        # Equipment
        {"description": "New laptop for staff", "amount": 1299900, "category": ExpenseCategory.EQUIPMENT, "days_ago": 45},
        {"description": "Office chairs (3x)", "amount": 899700, "category": ExpenseCategory.EQUIPMENT, "days_ago": 55},
        
        # Inventory
        {"description": "Product stock - Supplier A", "amount": 4520000, "category": ExpenseCategory.INVENTORY, "days_ago": 35},
        {"description": "Product stock - Supplier B", "amount": 3150000, "category": ExpenseCategory.INVENTORY, "days_ago": 20},
        
        # Miscellaneous
        {"description": "Bank fees - January", "amount": 45000, "category": ExpenseCategory.OTHER, "days_ago": 28},
        {"description": "Business insurance - quarterly", "amount": 750000, "category": ExpenseCategory.INSURANCE, "days_ago": 15},
    ]
    
    created_expenses = []
    for data in expenses_data:
        expense = Expense(
            tenant_id=tenant_id,
            amount_cents=data["amount"],
            category=data["category"],
            description=data["description"],
            vendor=f"Vendor {random.randint(1, 20)}",
            expense_date=datetime.now().date() - timedelta(days=data["days_ago"]),
            payment_method=random.choice([PaymentMethod.EFT, PaymentMethod.CARD, PaymentMethod.CASH]),
            status="approved",
            created_at=datetime.now() - timedelta(days=data["days_ago"]),
        )
        db.add(expense)
        created_expenses.append(expense)
    
    db.commit()
    print(f"✓ Created {len(created_expenses)} expenses")
    
    # Print category summary
    category_totals: dict[str, float] = {}
    for exp in created_expenses:
        cat = exp.category.value
        amount = exp.amount_cents / 100
        category_totals[cat] = category_totals.get(cat, 0) + amount
    
    print("\n  Expenses by Category:")
    for category, total in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        print(f"    {category}: R{total:,.2f}")
    
    print(f"\n  Total Expenses: R{sum(category_totals.values()):,.2f}")


def main():
    """Main seed function."""
    print("=" * 60)
    print("  SMB Loyalty Platform - Phase 5 Demo Data Seed")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get or create tenant and customers
        tenant, customers = get_or_create_demo_tenant(db)
        
        if len(customers) < 10:
            print("⚠️  Warning: Less than 10 customers found. Some features may not work properly.")
            print("    Consider creating more customers first.")
            return
        
        # Seed Phase 5 features
        seed_campaigns(db, tenant.id, customers)
        seed_invoices(db, tenant.id, customers)
        seed_expenses(db, tenant.id)
        
        print("\n" + "=" * 60)
        print("✅ Demo data seeded successfully!")
        print("=" * 60)
        
        print("\n📊 Summary:")
        campaign_count = db.query(Campaign).filter(Campaign.tenant_id == tenant.id).count()
        invoice_count = db.query(Invoice).filter(Invoice.tenant_id == tenant.id).count()
        expense_count = db.query(Expense).filter(Expense.tenant_id == tenant.id).count()
        
        print(f"  Tenant: {tenant.name}")
        print(f"  Customers: {len(customers)}")
        print(f"  Campaigns: {campaign_count}")
        print(f"  Invoices: {invoice_count}")
        print(f"  Expenses: {expense_count}")
        
        print("\n🎯 What to do next:")
        print("  1. Start the server: uvicorn main:app --reload")
        print("  2. Open API docs: http://localhost:8000/docs")
        print("  3. Test campaigns: GET /api/campaigns")
        print("  4. Test invoices: GET /api/financial/invoices")
        print("  5. View P&L report: GET /api/financial/reports/profit-loss")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
