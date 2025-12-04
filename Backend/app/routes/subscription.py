from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.core.plans import PLAN_REGISTRY, get_plan
from app.models import Tenant
from config import settings
import stripe
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Subscription"])

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

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
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    plan = get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if plan.price_cents == 0:
         # Handle free plan "upgrade" directly without Stripe if needed, 
         # or just return success if they are already on it.
         # For now, we assume free plan doesn't need checkout.
         # But if they are downgrading to free, we might need to cancel subscription in Stripe.
         # This logic can get complex. For MVP, let's focus on upgrading to paid.
         pass

    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        # Create or get customer
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=f"admin@{tenant.primary_domain or tenant.id}.com", # Placeholder, ideally get from admin user
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
            success_url=f"{settings.frontend_url}/admin/subscription?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_url}/admin/subscription?canceled=true",
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
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_context.id).first()
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

def _handle_subscription_updated(subscription, db: Session):
    # Logic to sync status (active, past_due, etc.)
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
        tenant.subscription_plan_id = 'free' # Revert to free
        db.commit()
