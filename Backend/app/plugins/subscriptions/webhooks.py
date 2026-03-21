"""
Stripe Webhook Handlers

Handles webhook events from Stripe for subscription lifecycle management.
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/stripe", tags=["webhooks"])

# Initialize Stripe with API key
stripe.api_key = settings.stripe_api_key if hasattr(settings, 'stripe_api_key') else None


def verify_stripe_signature(payload: bytes, signature: str) -> stripe.Event:
    """
    Verify Stripe webhook signature and construct event.
    
    Raises HTTPException if signature is invalid.
    """
    webhook_secret = getattr(settings, 'stripe_webhook_secret', None)
    if not webhook_secret:
        logger.warning("Stripe webhook secret not configured - skipping signature verification")
        # In development, allow unsigned webhooks
        if settings.environment != 'production':
            return stripe.Event.construct_from(payload, stripe.api_key)
        raise HTTPException(
            status_code=500,
            detail="Webhook secret not configured"
        )
    
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, webhook_secret
        )
        return event
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")


def get_tenant_by_stripe_customer(db: Session, stripe_customer_id: str) -> Tenant | None:
    """Look up tenant by Stripe customer ID."""
    return db.query(Tenant).filter(
        Tenant.stripe_customer_id == stripe_customer_id
    ).first()


def handle_invoice_payment_succeeded(event: stripe.Event, db: Session) -> None:
    """
    Handle successful invoice payment.
    
    Updates tenant subscription status to 'active' and clears any past due flags.
    """
    invoice = event.data.object
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    
    tenant = get_tenant_by_stripe_customer(db, customer_id)
    if not tenant:
        logger.warning(f"Tenant not found for Stripe customer {customer_id}")
        return
    
    # Update tenant subscription status
    tenant.subscription_status = 'active'
    tenant.stripe_subscription_id = subscription_id
    
    db.commit()
    logger.info(f"Updated tenant {tenant.id} subscription status to active")


def handle_invoice_payment_failed(event: stripe.Event, db: Session) -> None:
    """
    Handle failed invoice payment.
    
    Sets tenant to 'past_due' status. A Celery task will check daily
    and suspend tenants that remain past due for >7 days.
    """
    invoice = event.data.object
    customer_id = invoice.get('customer')
    
    tenant = get_tenant_by_stripe_customer(db, customer_id)
    if not tenant:
        logger.warning(f"Tenant not found for Stripe customer {customer_id}")
        return
    
    # Set to past_due - grace period starts
    tenant.subscription_status = 'past_due'
    
    db.commit()
    logger.warning(f"Tenant {tenant.id} payment failed - status set to past_due")
    
    # TODO: Send email notification to tenant admin
    # TODO: Trigger grace period warning workflow


def handle_customer_subscription_deleted(event: stripe.Event, db: Session) -> None:
    """
    Handle subscription cancellation.
    
    Suspends the tenant immediately when subscription is cancelled.
    """
    subscription = event.data.object
    customer_id = subscription.get('customer')
    
    tenant = get_tenant_by_stripe_customer(db, customer_id)
    if not tenant:
        logger.warning(f"Tenant not found for Stripe customer {customer_id}")
        return
    
    # Suspend tenant
    tenant.subscription_status = 'suspended'
    tenant.stripe_subscription_id = None
    
    db.commit()
    logger.warning(f"Tenant {tenant.id} subscription cancelled - suspended")
    
    # TODO: Send cancellation confirmation email
    # TODO: Notify users that service is suspended


def handle_customer_subscription_updated(event: stripe.Event, db: Session) -> None:
    """
    Handle subscription updates (plan changes, etc).
    
    Updates tenant plan_id if the subscription item price has changed.
    """
    subscription = event.data.object
    customer_id = subscription.get('customer')
    
    tenant = get_tenant_by_stripe_customer(db, customer_id)
    if not tenant:
        logger.warning(f"Tenant not found for Stripe customer {customer_id}")
        return
    
    # Extract plan from subscription items
    items = subscription.get('items', {}).get('data', [])
    if items:
        price_id = items[0].get('price', {}).get('id')
        # Map Stripe price ID to internal plan ID
        # TODO: Create price_id -> plan_id mapping in config
        logger.info(f"Subscription updated for tenant {tenant.id}, price: {price_id}")
    
    # Update subscription status
    status_map = {
        'active': 'active',
        'past_due': 'past_due',
        'canceled': 'suspended',
        'unpaid': 'suspended',
        'incomplete': 'past_due',
    }
    new_status = status_map.get(subscription.get('status'), 'active')
    tenant.subscription_status = new_status
    
    db.commit()
    logger.info(f"Updated tenant {tenant.id} subscription status to {new_status}")


def handle_checkout_session_completed(event: stripe.Event, db: Session) -> None:
    """
    Handle completed checkout session.

    Updates tenant plan and subscription status when a Stripe Checkout
    session finishes successfully.
    """
    session = event.data.object
    customer_id = session.get('customer')
    tenant_id = session.get('metadata', {}).get('tenant_id')
    plan_id = session.get('metadata', {}).get('plan_id')

    tenant = None
    if tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant and customer_id:
        tenant = get_tenant_by_stripe_customer(db, customer_id)

    if not tenant:
        logger.warning(f"Tenant not found for checkout session {session.get('id')}")
        return

    if plan_id:
        tenant.subscription_plan_id = plan_id
    subscription_id = session.get('subscription')
    if subscription_id:
        tenant.stripe_subscription_id = subscription_id
    if customer_id and not tenant.stripe_customer_id:
        tenant.stripe_customer_id = customer_id
    tenant.subscription_status = 'active'
    db.commit()
    logger.info(f"Checkout completed for tenant {tenant.id}, plan={plan_id}")


def handle_invoice_paid(event: stripe.Event, db: Session) -> None:
    """
    Handle invoice.paid event.

    Ensures tenant subscription stays active after a successful payment.
    """
    invoice = event.data.object
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')

    tenant = get_tenant_by_stripe_customer(db, customer_id)
    if not tenant:
        logger.warning(f"Tenant not found for Stripe customer {customer_id}")
        return

    tenant.subscription_status = 'active'
    if subscription_id:
        tenant.stripe_subscription_id = subscription_id
    db.commit()
    logger.info(f"Invoice paid for tenant {tenant.id}")


# Event handler mapping
EVENT_HANDLERS = {
    'checkout.session.completed': handle_checkout_session_completed,
    'invoice.paid': handle_invoice_paid,
    'invoice.payment_succeeded': handle_invoice_payment_succeeded,
    'invoice.payment_failed': handle_invoice_payment_failed,
    'customer.subscription.deleted': handle_customer_subscription_deleted,
    'customer.subscription.updated': handle_customer_subscription_updated,
}


@router.post("", status_code=200)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook events.
    
    Verifies webhook signature and processes subscription lifecycle events.
    """
    payload = await request.body()
    signature = request.headers.get('stripe-signature', '')
    
    # Verify signature and construct event
    try:
        event = verify_stripe_signature(payload, signature)
    except HTTPException as e:
        raise e
    
    event_type = event.type
    logger.info(f"Processing Stripe webhook: {event_type}")
    
    # Route to appropriate handler
    handler = EVENT_HANDLERS.get(event_type)
    if handler:
        try:
            handler(event, db)
        except Exception as e:
            logger.error(f"Error handling {event_type}: {e}", exc_info=True)
            # Return 500 so Stripe will retry
            raise HTTPException(
                status_code=500,
                detail=f"Error processing webhook: {str(e)}"
            )
    else:
        # Event type not handled - log and return success
        logger.debug(f"Unhandled webhook event type: {event_type}")
    
    return {"status": "success"}
