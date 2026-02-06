"""
Stripe Subscription Sync Functions

Handles creating, updating, and canceling Stripe subscriptions for tenants.
"""

import logging
from typing import Dict

import stripe
from sqlalchemy.orm import Session

from app.models import Tenant
from config import settings

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = getattr(settings, 'stripe_api_key', None)

# Plan ID to Stripe Price ID mapping
# TODO: Move to database or config file
PLAN_PRICE_MAPPING = {
    'free': None,  # Free plan has no Stripe subscription
    'pro': getattr(settings, 'stripe_price_id_pro', 'price_pro_monthly'),
    'enterprise': getattr(settings, 'stripe_price_id_enterprise', 'price_enterprise_monthly'),
}


def ensure_stripe_customer(tenant: Tenant, db: Session) -> str:
    """
    Ensure tenant has a Stripe customer ID, creating one if necessary.
    
    Returns the Stripe customer ID.
    """
    if tenant.stripe_customer_id:
        return tenant.stripe_customer_id
    
    # Create Stripe customer
    try:
        # Get tenant admin email for customer record
        admin_email = None
        if tenant.users:
            admin_users = [u for u in tenant.users if u.role == 'admin']
            if admin_users:
                admin_email = admin_users[0].email
        
        customer = stripe.Customer.create(
            email=admin_email,
            metadata={
                'tenant_id': tenant.id,
                'tenant_name': tenant.name,
            },
            description=f"Tenant: {tenant.name}"
        )
        
        # Save customer ID to tenant
        tenant.stripe_customer_id = customer.id
        db.commit()
        
        logger.info(f"Created Stripe customer {customer.id} for tenant {tenant.id}")
        return customer.id
        
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create Stripe customer for tenant {tenant.id}: {e}")
        raise


def create_stripe_subscription(
    tenant_id: str,
    plan_id: str,
    db: Session
) -> Dict:
    """
    Create a Stripe subscription for a tenant.
    
    Args:
        tenant_id: The tenant ID
        plan_id: The plan ID ('free', 'pro', 'enterprise')
        db: Database session
    
    Returns:
        Dictionary with subscription details
    
    Raises:
        ValueError: If plan is invalid or already subscribed
        stripe.error.StripeError: If Stripe API call fails
    """
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")
    
    # Validate plan
    if plan_id not in PLAN_PRICE_MAPPING:
        raise ValueError(f"Invalid plan: {plan_id}")
    
    # Free plan doesn't require Stripe subscription
    if plan_id == 'free':
        tenant.plan_id = 'free'
        tenant.subscription_status = 'active'
        db.commit()
        return {
            'plan_id': 'free',
            'status': 'active',
            'message': 'Downgraded to free plan'
        }
    
    # Ensure customer exists
    customer_id = ensure_stripe_customer(tenant, db)
    
    # Get Stripe price ID
    price_id = PLAN_PRICE_MAPPING[plan_id]
    
    try:
        # Create subscription
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{'price': price_id}],
            metadata={
                'tenant_id': tenant_id,
                'plan_id': plan_id,
            },
            # Start trial if applicable
            trial_period_days=getattr(settings, 'stripe_trial_days', 0) or None,
        )
        
        # Update tenant
        tenant.plan_id = plan_id
        tenant.stripe_subscription_id = subscription.id
        tenant.subscription_status = subscription.status
        db.commit()
        
        logger.info(f"Created Stripe subscription {subscription.id} for tenant {tenant_id}")
        
        return {
            'subscription_id': subscription.id,
            'plan_id': plan_id,
            'status': subscription.status,
            'current_period_end': subscription.current_period_end,
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create subscription for tenant {tenant_id}: {e}")
        raise


def update_subscription(
    tenant_id: str,
    new_plan_id: str,
    db: Session
) -> Dict:
    """
    Update a tenant's subscription to a new plan.
    
    Args:
        tenant_id: The tenant ID
        new_plan_id: The new plan ID
        db: Database session
    
    Returns:
        Dictionary with updated subscription details
    
    Raises:
        ValueError: If tenant or plan is invalid
        stripe.error.StripeError: If Stripe API call fails
    """
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")
    
    # Validate plan
    if new_plan_id not in PLAN_PRICE_MAPPING:
        raise ValueError(f"Invalid plan: {new_plan_id}")
    
    current_plan = tenant.plan_id or 'free'
    
    # No change needed
    if current_plan == new_plan_id:
        return {
            'plan_id': new_plan_id,
            'status': tenant.subscription_status or 'active',
            'message': 'No change - already on this plan'
        }
    
    # Downgrade to free - cancel subscription
    if new_plan_id == 'free':
        return cancel_subscription(tenant_id, db)
    
    # Upgrade/change paid plan
    if not tenant.stripe_subscription_id:
        # No existing subscription - create new one
        return create_stripe_subscription(tenant_id, new_plan_id, db)
    
    # Update existing subscription
    new_price_id = PLAN_PRICE_MAPPING[new_plan_id]
    
    try:
        # Get current subscription
        subscription = stripe.Subscription.retrieve(tenant.stripe_subscription_id)
        
        # Update to new price
        updated_subscription = stripe.Subscription.modify(
            tenant.stripe_subscription_id,
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': new_price_id,
            }],
            proration_behavior='always_invoice',  # Pro-rate immediately
            metadata={
                'tenant_id': tenant_id,
                'plan_id': new_plan_id,
            }
        )
        
        # Update tenant
        tenant.plan_id = new_plan_id
        tenant.subscription_status = updated_subscription.status
        db.commit()
        
        logger.info(f"Updated subscription {subscription.id} for tenant {tenant_id} to plan {new_plan_id}")
        
        return {
            'subscription_id': updated_subscription.id,
            'plan_id': new_plan_id,
            'status': updated_subscription.status,
            'current_period_end': updated_subscription.current_period_end,
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Failed to update subscription for tenant {tenant_id}: {e}")
        raise


def cancel_subscription(
    tenant_id: str,
    db: Session,
    immediate: bool = False
) -> Dict:
    """
    Cancel a tenant's subscription.
    
    Args:
        tenant_id: The tenant ID
        db: Database session
        immediate: If True, cancel immediately. If False, cancel at period end.
    
    Returns:
        Dictionary with cancellation details
    
    Raises:
        ValueError: If tenant not found or no active subscription
        stripe.error.StripeError: If Stripe API call fails
    """
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")
    
    if not tenant.stripe_subscription_id:
        # No Stripe subscription - just downgrade to free
        tenant.plan_id = 'free'
        tenant.subscription_status = 'active'
        db.commit()
        return {
            'plan_id': 'free',
            'status': 'active',
            'message': 'Downgraded to free plan (no active subscription)'
        }
    
    try:
        if immediate:
            # Cancel immediately
            stripe.Subscription.delete(tenant.stripe_subscription_id)
            tenant.plan_id = 'free'
            tenant.subscription_status = 'active'
            tenant.stripe_subscription_id = None
            message = 'Subscription cancelled immediately'
        else:
            # Cancel at period end
            subscription = stripe.Subscription.modify(
                tenant.stripe_subscription_id,
                cancel_at_period_end=True
            )
            tenant.subscription_status = 'active'  # Stay active until period end
            message = f"Subscription will cancel at period end: {subscription.current_period_end}"
        
        db.commit()
        
        logger.info(f"Cancelled subscription for tenant {tenant_id} (immediate={immediate})")
        
        return {
            'plan_id': tenant.plan_id,
            'status': tenant.subscription_status,
            'message': message
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Failed to cancel subscription for tenant {tenant_id}: {e}")
        raise


def create_checkout_session(
    tenant_id: str,
    plan_id: str,
    success_url: str,
    cancel_url: str,
    db: Session
) -> str:
    """
    Create a Stripe Checkout session for subscription signup.
    
    Args:
        tenant_id: The tenant ID
        plan_id: The plan to subscribe to
        success_url: URL to redirect on successful payment
        cancel_url: URL to redirect if user cancels
        db: Database session
    
    Returns:
        Checkout session URL
    
    Raises:
        ValueError: If plan is invalid
        stripe.error.StripeError: If Stripe API call fails
    """
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise ValueError(f"Tenant {tenant_id} not found")
    
    # Validate plan
    if plan_id not in PLAN_PRICE_MAPPING or plan_id == 'free':
        raise ValueError(f"Invalid plan for checkout: {plan_id}")
    
    # Ensure customer exists
    customer_id = ensure_stripe_customer(tenant, db)
    
    # Get price ID
    price_id = PLAN_PRICE_MAPPING[plan_id]
    
    try:
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode='subscription',
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'tenant_id': tenant_id,
                'plan_id': plan_id,
            },
        )
        
        logger.info(f"Created checkout session {session.id} for tenant {tenant_id}")
        
        return session.url
        
    except stripe.error.StripeError as e:
        logger.error(f"Failed to create checkout session for tenant {tenant_id}: {e}")
        raise
