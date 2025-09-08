"""
Subscription billing service for handling recurring payments.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import requests
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.models import Tenant, SubscriptionPlan, Payment, AuditLog
from config import settings


class SubscriptionBillingService:
    """Service for handling subscription billing operations."""
    
    def __init__(self):
        self.yoco_secret = settings.yoco_secret_key
        self.yoco_base_url = "https://online.yoco.com/v1"
        
    def create_customer(self, tenant: Tenant, email: str, phone: str = None) -> Dict[str, Any]:
        """Create a customer in Yoco for subscription billing."""
        payload = {
            "firstName": tenant.name.split()[0] if tenant.name else "Business",
            "lastName": tenant.name.split()[-1] if len(tenant.name.split()) > 1 else "Owner", 
            "email": email,
            "phone": phone,
            "metadata": {
                "tenant_id": tenant.id,
                "vertical": tenant.vertical_type
            }
        }
        
        headers = {
            "X-Auth-Secret-Key": self.yoco_secret,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.yoco_base_url}/customers/",
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to create Yoco customer: {str(e)}")
    
    def create_subscription(
        self, 
        customer_id: str, 
        plan: SubscriptionPlan,
        payment_method_id: str = None
    ) -> Dict[str, Any]:
        """Create a subscription in Yoco."""
        payload = {
            "customerId": customer_id,
            "amount": plan.price_cents,
            "currency": "ZAR",
            "interval": "month" if plan.billing_period == "monthly" else "year",
            "intervalCount": 1,
            "metadata": {
                "plan_id": plan.id,
                "plan_name": plan.name
            }
        }
        
        if payment_method_id:
            payload["paymentMethodId"] = payment_method_id
            
        headers = {
            "X-Auth-Secret-Key": self.yoco_secret,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.yoco_base_url}/subscriptions/",
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to create Yoco subscription: {str(e)}")
    
    def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancel a subscription in Yoco."""
        headers = {
            "X-Auth-Secret-Key": self.yoco_secret,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.delete(
                f"{self.yoco_base_url}/subscriptions/{subscription_id}",
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to cancel Yoco subscription: {str(e)}")
    
    def update_subscription(
        self, 
        subscription_id: str, 
        plan: SubscriptionPlan
    ) -> Dict[str, Any]:
        """Update a subscription to a new plan."""
        payload = {
            "amount": plan.price_cents,
            "metadata": {
                "plan_id": plan.id,
                "plan_name": plan.name
            }
        }
        
        headers = {
            "X-Auth-Secret-Key": self.yoco_secret,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.put(
                f"{self.yoco_base_url}/subscriptions/{subscription_id}",
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to update Yoco subscription: {str(e)}")
    
    def process_subscription_webhook(
        self, 
        payload: Dict[str, Any], 
        db: Session
    ) -> Dict[str, str]:
        """Process a subscription-related webhook from Yoco."""
        event_type = payload.get("eventType")
        data = payload.get("data", {})
        
        if event_type == "subscription.charged":
            return self._handle_subscription_charged(data, db)
        elif event_type == "subscription.failed":
            return self._handle_subscription_failed(data, db)
        elif event_type == "subscription.cancelled":
            return self._handle_subscription_cancelled(data, db)
        else:
            return {"status": "ignored", "reason": f"Unknown event type: {event_type}"}
    
    def _handle_subscription_charged(self, data: Dict[str, Any], db: Session) -> Dict[str, str]:
        """Handle successful subscription charge."""
        subscription_id = data.get("subscriptionId")
        charge_id = data.get("chargeId")
        amount = data.get("amount", 0)
        
        # Find tenant by subscription metadata
        tenant = self._find_tenant_by_subscription(subscription_id, db)
        if not tenant:
            return {"status": "ignored", "reason": "Tenant not found"}
        
        # Record payment
        payment = Payment(
            order_id=None,  # Subscription payments don't have orders
            amount=amount,
            method="yoco_subscription",
            transaction_id=charge_id,
            reference=subscription_id,
            status="success",
            raw_response=data,
            created_at=datetime.utcnow(),
            source="subscription"
        )
        db.add(payment)
        
        # Update subscription status
        subscription_config = tenant.config.get("subscription", {})
        subscription_config["status"] = "active"
        subscription_config["last_payment_at"] = datetime.utcnow().isoformat()
        subscription_config["next_billing_date"] = self._calculate_next_billing_date(
            subscription_config.get("billing_period", "monthly")
        ).isoformat()
        
        tenant.config = {**tenant.config, "subscription": subscription_config}
        db.add(tenant)
        
        # Log audit event
        audit = AuditLog(
            tenant_id=tenant.id,
            action="subscription.payment.success",
            details={
                "amount": amount,
                "charge_id": charge_id,
                "subscription_id": subscription_id
            },
            created_at=datetime.utcnow()
        )
        db.add(audit)
        
        db.commit()
        
        return {"status": "processed", "tenant_id": tenant.id}
    
    def _handle_subscription_failed(self, data: Dict[str, Any], db: Session) -> Dict[str, str]:
        """Handle failed subscription charge."""
        subscription_id = data.get("subscriptionId")
        error = data.get("error", {})
        
        tenant = self._find_tenant_by_subscription(subscription_id, db)
        if not tenant:
            return {"status": "ignored", "reason": "Tenant not found"}
        
        # Update subscription status
        subscription_config = tenant.config.get("subscription", {})
        subscription_config["status"] = "past_due"
        subscription_config["failed_payment_count"] = subscription_config.get("failed_payment_count", 0) + 1
        
        tenant.config = {**tenant.config, "subscription": subscription_config}
        db.add(tenant)
        
        # Log audit event
        audit = AuditLog(
            tenant_id=tenant.id,
            action="subscription.payment.failed",
            details={
                "subscription_id": subscription_id,
                "error": error,
                "failed_count": subscription_config["failed_payment_count"]
            },
            created_at=datetime.utcnow()
        )
        db.add(audit)
        
        db.commit()
        
        # TODO: Send notification email to business owner
        
        return {"status": "processed", "tenant_id": tenant.id}
    
    def _handle_subscription_cancelled(self, data: Dict[str, Any], db: Session) -> Dict[str, str]:
        """Handle subscription cancellation."""
        subscription_id = data.get("subscriptionId")
        
        tenant = self._find_tenant_by_subscription(subscription_id, db)
        if not tenant:
            return {"status": "ignored", "reason": "Tenant not found"}
        
        # Update subscription status
        subscription_config = tenant.config.get("subscription", {})
        subscription_config["status"] = "cancelled"
        subscription_config["cancelled_at"] = datetime.utcnow().isoformat()
        
        tenant.config = {**tenant.config, "subscription": subscription_config}
        db.add(tenant)
        
        # Log audit event
        audit = AuditLog(
            tenant_id=tenant.id,
            action="subscription.cancelled",
            details={"subscription_id": subscription_id},
            created_at=datetime.utcnow()
        )
        db.add(audit)
        
        db.commit()
        
        return {"status": "processed", "tenant_id": tenant.id}
    
    def _find_tenant_by_subscription(self, subscription_id: str, db: Session) -> Optional[Tenant]:
        """Find tenant by subscription ID stored in config."""
        tenants = db.query(Tenant).all()
        for tenant in tenants:
            subscription_config = tenant.config.get("subscription", {})
            if subscription_config.get("yoco_subscription_id") == subscription_id:
                return tenant
        return None
    
    def _calculate_next_billing_date(self, billing_period: str) -> datetime:
        """Calculate next billing date based on period."""
        now = datetime.utcnow()
        if billing_period == "annual":
            return now + timedelta(days=365)
        else:  # monthly
            return now + timedelta(days=30)


# Global service instance
billing_service = SubscriptionBillingService()
