from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import timedelta
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.core.plans import PLAN_REGISTRY, get_plan, FEATURE_LOYALTY, FEATURE_ANALYTICS, FEATURE_MULTI_USER
from app.models import Tenant, Order, Redemption, Payment, User, tenant_admins
from app.utils.time import utc_now
from app.plugins.auth.routes import get_current_user
from config import settings
import stripe
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter(tags=["subscriptions"])

# Check for mock mode
IS_MOCK_STRIPE = settings.stripe_secret_key == "mock" or settings.stripe_secret_key is None

# Request models
class ModuleOverrideRequest(BaseModel):
    module_key: str
    enabled: bool

# ─── Admin Management Endpoints (Stub Implementation) ─────────────────────
# TODO: Replace stubs with full implementation when subscription management is complete

@router.get("/modules")
def list_modules():
    """List all available modules/verticals.
    
    Stub endpoint returning sample module data for UI development.
    TODO: Replace with database-driven module registry when subscription
    management feature is fully implemented.
    """
    # Return sample modules matching vertical architecture
    return [
        # Core Platform Modules
        {
            "key": "core",
            "name": "Core Platform",
            "category": "Platform",
            "description": "Essential business operations and user management",
            "is_addon": False
        },
        {
            "key": "loyalty",
            "name": "Loyalty Program",
            "category": "Platform",
            "description": "Points, rewards, and customer retention features",
            "is_addon": False
        },
        {
            "key": "analytics",
            "name": "Analytics & Insights",
            "category": "Platform",
            "description": "Business intelligence and reporting dashboards",
            "is_addon": False
        },
        # Vertical Modules
        {
            "key": "carwash",
            "name": "Car Wash Services",
            "category": "Verticals",
            "description": "Specialized features for car wash businesses including service packages and vehicle management",
            "is_addon": False
        },
        {
            "key": "retail",
            "name": "Retail Operations",
            "category": "Verticals",
            "description": "Inventory management, product catalog, and retail-specific features",
            "is_addon": False
        },
        # Add-on Modules
        {
            "key": "advanced_reporting",
            "name": "Advanced Reporting",
            "category": "Add-ons",
            "description": "Custom reports, data exports, and advanced analytics",
            "is_addon": True
        },
        {
            "key": "marketing_automation",
            "name": "Marketing Automation",
            "category": "Add-ons",
            "description": "Email campaigns, SMS notifications, and customer engagement tools",
            "is_addon": True
        },
        {
            "key": "multi_location",
            "name": "Multi-Location Management",
            "category": "Add-ons",
            "description": "Manage multiple business locations from a single dashboard",
            "is_addon": True
        }
    ]

@router.get("/tenants/{tenant_id}")
def get_tenant_subscription(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context)
):
    """Get tenant's subscription plan and active modules.
    
    Returns modules based on tenant's actual vertical_type from database.
    Core modules are always active and cannot be disabled.
    """
    from app.models import Tenant as TenantModel
    
    # Fetch actual tenant to get vertical_type
    tenant = db.query(TenantModel).filter(TenantModel.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Core modules are always active
    active_modules = ["core", "loyalty", "analytics"]
    
    # Add the tenant's vertical module
    active_modules.append(tenant.vertical_type)
    
    # Check tenant config for optional add-ons
    config = tenant.config or {}
    if config.get("advanced_reporting_enabled"):
        active_modules.append("advanced_reporting")
    if config.get("marketing_automation_enabled"):
        active_modules.append("marketing_automation")
    if config.get("multi_location_enabled"):
        active_modules.append("multi_location")
    
    return {
        "plan": {
            "id": 0,
            "name": "Default Plan"
        },
        "active_modules": active_modules,
        "subscription_status": "active"
    }

@router.get("/tenants/{tenant_id}/overrides")
def get_tenant_overrides(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """Get tenant's module overrides.
    
    Stub endpoint to prevent 404 errors. Returns empty list until
    subscription management feature is fully implemented.
    """
    return []

@router.post("/tenants/{tenant_id}/assign-plan")
def assign_plan(
    tenant_id: str,
    plan_id: str,
    db: Session = Depends(get_db)
):
    """Assign a subscription plan to a tenant.
    
    Stub endpoint to prevent 404 errors. Returns success message until
    subscription management feature is fully implemented.
    """
    return {
        "success": True,
        "message": "Subscription management feature is not yet fully implemented"
    }

@router.post("/tenants/{tenant_id}/override")
def create_override(
    tenant_id: str,
    request: ModuleOverrideRequest,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Create or update a module override for a tenant.
    
    Only superadmin can modify core modules (core, loyalty, analytics).
    Business admins can only enable/disable add-ons and their vertical.
    """
    from app.models import Tenant as TenantModel
    
    module_key = request.module_key
    enabled = request.enabled
    
    # Core modules cannot be disabled by anyone
    CORE_MODULES = ["core", "loyalty", "analytics"]
    if module_key in CORE_MODULES:
        raise HTTPException(
            status_code=403, 
            detail="Core modules cannot be disabled. They are essential for platform operation."
        )
    
    # Only superadmin can change vertical modules
    VERTICAL_MODULES = ["carwash", "retail", "dispensary", "restaurant"]
    if module_key in VERTICAL_MODULES:
        if current_user.role != "superadmin":
            raise HTTPException(
                status_code=403,
                detail="Only superadmin can change vertical modules. Contact support to switch verticals."
            )
        # Changing vertical requires updating tenant.vertical_type
        tenant = db.query(TenantModel).filter(TenantModel.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        if enabled:
            tenant.vertical_type = module_key
            db.commit()
        else:
            raise HTTPException(
                status_code=400,
                detail="Cannot disable a vertical module. Switch to a different vertical instead."
            )
    else:
        # Add-on modules can be toggled by admin or superadmin
        if current_user.role not in ["admin", "superadmin"]:
            raise HTTPException(
                status_code=403,
                detail="Only admins can manage add-on modules"
            )
        
        tenant = db.query(TenantModel).filter(TenantModel.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Update tenant config with add-on status
        config = tenant.config or {}
        config[f"{module_key}_enabled"] = enabled
        tenant.config = config
        db.commit()
    
    return {
        "success": True,
        "message": f"Module {module_key} {'enabled' if enabled else 'disabled'} successfully"
    }

if settings.stripe_secret_key and not IS_MOCK_STRIPE:
    stripe.api_key = settings.stripe_secret_key

# ─── Plan & Subscription Endpoints ────────────────────────────────────────

@router.get("/plans")
def list_plans():
    """List all available subscription plans."""
    return [plan.dict() for plan in PLAN_REGISTRY.values()]

@router.post("/checkout-session")
def create_checkout_session(
    plan_id: str,
    request: Request,
    db: Session = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    """Create a Stripe Checkout Session for upgrading/downgrading."""
    if not settings.stripe_secret_key and not IS_MOCK_STRIPE:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Legacy mapping for backward compatibility
    legacy_map = {"growth": "pro", "scale": "enterprise", "starter": "free"}
    if plan_id in legacy_map:
        plan_id = legacy_map[plan_id]

    plan = get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Handle free plan (no payment needed)
    if plan.price_cents == 0:
        tenant.subscription_plan_id = plan.id
        tenant.subscription_status = 'active'
        # Clear stripe subscription if exists? Maybe. For now just update local state.
        db.commit()
        return {"url": f"{settings.frontend_url}/admin/billing?status=success&session_id=free_upgrade"}

    # Mock Mode Handling
    if IS_MOCK_STRIPE:
        logger.info(f"MOCK STRIPE: Creating checkout session for plan {plan_id}")
        # Simulate a successful checkout URL that redirects back to the app
        # In a real mock, we might want to auto-upgrade the tenant here for testing convenience,
        # but strictly speaking, the webhook should do it. 
        # For dev convenience, let's auto-upgrade if it's a mock session.
        tenant.subscription_plan_id = plan_id
        tenant.subscription_status = 'active'
        tenant.stripe_customer_id = f"cus_mock_{tenant.id}"
        tenant.stripe_subscription_id = f"sub_mock_{plan_id}"
        db.commit()
        
        return {"url": f"{settings.frontend_url}/admin/billing?status=success&session_id=mock_session_123"}

    try:
        # Create or get customer
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=f"admin@{tenant.primary_domain or tenant.id}.com", # Placeholder
                name=tenant.name,
                metadata={"tenant_id": tenant.id}
            )
            customer_id = customer.id
            tenant.stripe_customer_id = customer_id
            db.commit()

        # Create Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': plan.currency,
                    'product_data': {
                        'name': plan.name,
                        'description': plan.description,
                    },
                    'unit_amount': plan.price_cents,
                    'recurring': {
                        'interval': 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{settings.frontend_url}/admin/billing?status=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_url}/admin/billing?status=cancelled",
            metadata={
                "tenant_id": tenant.id,
                "plan_id": plan_id
            }
        )
        return {"url": checkout_session.url}
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/portal-session")
def create_portal_session(
    request: Request,
    db: Session = Depends(get_db),
    tenant_context: TenantContext = Depends(get_tenant_context)
):
    """Create a Stripe Customer Portal Session."""
    if not settings.stripe_secret_key and not IS_MOCK_STRIPE:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    
    # Mock Mode Handling
    if IS_MOCK_STRIPE:
        return {"url": f"{settings.frontend_url}/admin/subscription?portal=mock"}

    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=f"{settings.frontend_url}/admin/subscription",
        )
        return {"url": portal_session.url}
    except Exception as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/subscription-status")
def get_subscription_status(
    tenant_context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get current subscription status."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    plan = get_plan(tenant.subscription_plan_id)
    
    return {
        "status": tenant.subscription_status,
        "plan": plan.dict(),
        "stripe_customer_id": tenant.stripe_customer_id,
        "stripe_subscription_id": tenant.stripe_subscription_id
    }

@router.get("/invoices")
def list_invoices(
    tenant_context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List Stripe invoices for the current tenant.

    Returns the most recent invoices including amount, status, date and
    a hosted URL for the customer to view/download the invoice PDF.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if IS_MOCK_STRIPE or not tenant.stripe_customer_id:
        # Return empty list when in mock mode or no Stripe customer
        return []

    try:
        invoices = stripe.Invoice.list(
            customer=tenant.stripe_customer_id,
            limit=24,
        )
        return [
            {
                "id": inv.id,
                "amount_due": inv.amount_due,
                "amount_paid": inv.amount_paid,
                "currency": inv.currency,
                "status": inv.status,
                "created": inv.created,
                "hosted_invoice_url": inv.hosted_invoice_url,
                "invoice_pdf": inv.invoice_pdf,
            }
            for inv in invoices.auto_paging_iter()
        ]
    except stripe.error.StripeError as e:
        logger.error(f"Failed to fetch invoices for tenant {tenant.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch invoices from Stripe")


@router.get("/payment-method")
def get_payment_method(
    tenant_context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Return the default payment method on file (last 4 digits, brand, expiry).

    Returns ``null`` when no payment method is attached or in mock mode.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if IS_MOCK_STRIPE or not tenant.stripe_customer_id:
        return None

    try:
        customer = stripe.Customer.retrieve(
            tenant.stripe_customer_id,
            expand=["invoice_settings.default_payment_method"],
        )
        pm = getattr(
            getattr(customer, "invoice_settings", None),
            "default_payment_method",
            None,
        )
        if pm and hasattr(pm, "card") and pm.card:
            return {
                "brand": pm.card.brand,
                "last4": pm.card.last4,
                "exp_month": pm.card.exp_month,
                "exp_year": pm.card.exp_year,
            }
        return None
    except stripe.error.StripeError as e:
        logger.error(f"Failed to fetch payment method for tenant {tenant.id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch payment method from Stripe")


@router.get("/usage")
def get_usage(
    tenant_context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """Get current usage metrics against plan limits."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    plan = get_plan(tenant.subscription_plan_id)
    usage = []

    # 1. Loyalty Customers
    loyalty_config = plan.features.get(FEATURE_LOYALTY)
    if loyalty_config:
        customer_count = db.query(User).filter(
            User.tenant_id == tenant.id,
            User.role == "user"
        ).count()
        
        limit_customers = loyalty_config.get("limit_customers")
        usage.append({
            "module": "loyalty", # Mapped to "Loyalty Program" in UI
            "count": customer_count,
            "limit": limit_customers
        })

        # 2. Monthly Orders
        limit_orders = loyalty_config.get("limit_orders_per_month")
        if limit_orders is not None:
            # Count orders in current month
            now = utc_now()
            start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            order_count = db.query(Order).filter(
                Order.tenant_id == tenant.id,
                Order.created_at >= start_of_month
            ).count()
            
            usage.append({
                "module": "orders",
                "count": order_count,
                "limit": limit_orders
            })

    # 3. Team Members (Multi-user)
    multi_user_config = plan.features.get(FEATURE_MULTI_USER)
    if multi_user_config:
        # Count admins/staff
        # Users in tenant_admins association
        # We need to join with tenant_admins
        # Or just count users with role != 'user' if that's how it works?
        # The Tenant model has `admins` relationship.
        admin_count = len(tenant.admins)
        limit_users = multi_user_config.get("limit_users")
        
        usage.append({
            "module": "multi_user",
            "count": admin_count,
            "limit": limit_users
        })

    return usage

# ─── Webhook ──────────────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        _handle_checkout_completed(session, db)
    elif event['type'] == 'invoice.paid':
        invoice = event['data']['object']
        _handle_invoice_paid(invoice, db)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        _handle_subscription_updated(subscription, db)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        _handle_subscription_deleted(subscription, db)

    return {"status": "success"}

def _handle_checkout_completed(session, db: Session):
    tenant_id = session.get('metadata', {}).get('tenant_id')
    plan_id = session.get('metadata', {}).get('plan_id')
    
    if tenant_id and plan_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            tenant.subscription_plan_id = plan_id
            tenant.stripe_subscription_id = session.get('subscription')
            tenant.subscription_status = 'active'
            db.commit()

def _handle_invoice_paid(invoice, db: Session):
    """Mark tenant subscription as active when an invoice is successfully paid."""
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    if not customer_id:
        return
    tenant = db.query(Tenant).filter(Tenant.stripe_customer_id == customer_id).first()
    if tenant:
        tenant.subscription_status = 'active'
        if subscription_id:
            tenant.stripe_subscription_id = subscription_id
        db.commit()

def _handle_subscription_updated(subscription, db: Session):
    customer_id = subscription.get('customer')
    status = subscription.get('status')
    
    tenant = db.query(Tenant).filter(Tenant.stripe_customer_id == customer_id).first()
    if tenant:
        tenant.subscription_status = status
        db.commit()

def _handle_subscription_deleted(subscription, db: Session):
    customer_id = subscription.get('customer')
    tenant = db.query(Tenant).filter(Tenant.stripe_customer_id == customer_id).first()
    if tenant:
        tenant.subscription_status = 'canceled'
        tenant.subscription_plan_id = 'free'
        db.commit()

# ─── Usage & Limits ───────────────────────────────────────────────────────

@router.get("/usage-metrics")
def get_usage_metrics(
    window: str = "30d",
    tenant_context: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Compute module usage metrics from real data."""
    days = 30 if window.endswith("30d") else 7
    start = utc_now() - timedelta(days=days)
    tid = tenant_context.id

    # Fetch limits from current plan
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    plan = get_plan(tenant.subscription_plan_id)
    
    # Extract limits from plan features
    loyalty_features = plan.features.get(FEATURE_LOYALTY, {})
    if isinstance(loyalty_features, bool):
        loyalty_features = {} # Should be dict if enabled, but handle bool case
    
    limit_orders = loyalty_features.get("limit_orders_per_month")
    
    # Orders (Core/Loyalty usage)
    orders_q = db.query(func.count(Order.id)).filter(Order.created_at >= start)
    orders_q = orders_q.filter((Order.tenant_id == tid))
    core_count = orders_q.scalar() or 0

    # Redemptions
    red_q = db.query(func.count(Redemption.id)).filter(Redemption.created_at >= start)
    red_q = red_q.filter(Redemption.tenant_id == tid)
    loyalty_count = red_q.scalar() or 0

    # Payments
    pay_q = db.query(func.count(Payment.id)).filter(Payment.created_at >= start, Payment.status == "success")
    tenant_order_ids = db.query(Order.id).filter((Order.tenant_id == tid)).subquery()
    pay_q = pay_q.filter(Payment.order_id.in_(tenant_order_ids))
    billing_count = pay_q.scalar() or 0

    return [
        {"module": "core", "count": core_count, "limit": limit_orders},
        {"module": "loyalty", "count": loyalty_count, "limit": None}, # Add specific limit if needed
        {"module": "billing", "count": billing_count, "limit": None},
    ]
