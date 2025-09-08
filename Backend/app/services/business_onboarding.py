"""
Business onboarding service for streamlined tenant setup.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.core.database import get_db
from app.models import Tenant, User, Service, SubscriptionPlan, TenantBranding, VerticalType
from app.services.subscription_billing import billing_service
from config import settings


class BusinessOnboardingService:
    """Service for onboarding new businesses to the platform."""
    
    @staticmethod
    def create_business(
        business_name: str,
        vertical_type: str,
        owner_email: str,
        owner_first_name: str,
        owner_last_name: str,
        owner_phone: str,
        primary_domain: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Create a new business tenant with initial setup."""
        
        # Validate vertical type
        if vertical_type not in [v.value for v in VerticalType]:
            raise ValueError(f"Invalid vertical type: {vertical_type}")
        
        # Generate tenant ID from business name
        tenant_id = business_name.lower().replace(" ", "_").replace("-", "_")
        tenant_id = "".join(c for c in tenant_id if c.isalnum() or c == "_")[:50]
        
        # Check if tenant ID already exists
        existing = db.query(Tenant).filter_by(id=tenant_id).first()
        if existing:
            # Add suffix if needed
            counter = 1
            while existing:
                new_id = f"{tenant_id}_{counter}"
                existing = db.query(Tenant).filter_by(id=new_id).first()
                counter += 1
            tenant_id = new_id
        
        # Create tenant
        tenant = Tenant(
            id=tenant_id,
            name=business_name,
            loyalty_type="standard",
            vertical_type=vertical_type,
            primary_domain=primary_domain,
            config={
                "onboarding": {
                    "completed": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "step": "account_created"
                },
                "subscription": {
                    "status": "trial",
                    "trial_ends_at": (datetime.utcnow() + timedelta(days=14)).isoformat(),
                    "started_at": datetime.utcnow().isoformat()
                }
            },
            created_at=datetime.utcnow()
        )
        db.add(tenant)
        
        # Create owner user account
        owner = User(
            email=owner_email,
            phone=owner_phone,
            first_name=owner_first_name,
            last_name=owner_last_name,
            tenant_id=tenant_id,
            role="admin",
            onboarded=True,
            created_at=datetime.utcnow()
        )
        db.add(owner)
        
        # Set up default branding
        branding = TenantBranding(
            tenant_id=tenant_id,
            public_name=business_name,
            short_name=business_name[:20],
            primary_color="#3366ff",
            secondary_color="#f8fafc",
            accent_color="#06b6d4",
            updated_at=datetime.utcnow(),
            extra={}
        )
        db.add(branding)
        
        # Set up vertical-specific services
        default_services = BusinessOnboardingService._get_default_services(vertical_type)
        for service_data in default_services:
            service = Service(
                category=service_data["category"],
                name=service_data["name"],
                base_price=service_data["base_price"],
                loyalty_eligible=service_data.get("loyalty_eligible", True)
            )
            db.add(service)
        
        db.commit()
        db.refresh(tenant)
        db.refresh(owner)
        
        return {
            "tenant_id": tenant_id,
            "tenant_name": business_name,
            "owner_id": owner.id,
            "vertical_type": vertical_type,
            "trial_ends_at": tenant.config["subscription"]["trial_ends_at"],
            "onboarding_step": "account_created"
        }
    
    @staticmethod
    def complete_onboarding_step(
        tenant_id: str,
        step: str,
        data: Dict[str, Any],
        db: Session
    ) -> Dict[str, Any]:
        """Complete a specific onboarding step and advance to the next."""
        tenant = db.query(Tenant).filter_by(id=tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")
        
        config = tenant.config
        onboarding = config.get("onboarding", {})
        
        # Update step data
        if step == "business_info":
            # Update business information
            tenant.name = data.get("business_name", tenant.name)
            tenant.vertical_type = data.get("vertical_type", tenant.vertical_type)
            tenant.primary_domain = data.get("primary_domain", tenant.primary_domain)
            onboarding["step"] = "services_setup"
            
        elif step == "services_setup":
            # Services were configured
            onboarding["services_configured"] = True
            onboarding["step"] = "subscription_setup"
            
        elif step == "subscription_setup":
            # Subscription was set up
            onboarding["subscription_configured"] = True
            onboarding["step"] = "customization"
            
        elif step == "customization":
            # Branding and customization complete
            onboarding["customization_complete"] = True
            onboarding["step"] = "completed"
            onboarding["completed"] = True
            onboarding["completed_at"] = datetime.utcnow().isoformat()
        
        config["onboarding"] = onboarding
        tenant.config = config
        db.add(tenant)
        db.commit()
        
        return {
            "tenant_id": tenant_id,
            "current_step": onboarding["step"],
            "completed": onboarding.get("completed", False),
            "next_step": BusinessOnboardingService._get_next_step(onboarding["step"])
        }
    
    @staticmethod
    def get_onboarding_status(tenant_id: str, db: Session) -> Dict[str, Any]:
        """Get current onboarding status and next steps."""
        tenant = db.query(Tenant).filter_by(id=tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")
        
        onboarding = tenant.config.get("onboarding", {})
        subscription = tenant.config.get("subscription", {})
        
        # Check if services are configured
        services_count = db.query(Service).count()
        
        return {
            "tenant_id": tenant_id,
            "tenant_name": tenant.name,
            "vertical_type": tenant.vertical_type,
            "current_step": onboarding.get("step", "account_created"),
            "completed": onboarding.get("completed", False),
            "steps": {
                "account_created": {
                    "completed": True,
                    "title": "Account Created",
                    "description": "Your business account has been set up"
                },
                "business_info": {
                    "completed": onboarding.get("step") not in ["account_created"],
                    "title": "Business Information",
                    "description": "Configure your business details and vertical"
                },
                "services_setup": {
                    "completed": services_count > 0,
                    "title": "Services Setup", 
                    "description": "Add your products or services to the catalog"
                },
                "subscription_setup": {
                    "completed": subscription.get("status") == "active",
                    "title": "Subscription Setup",
                    "description": "Choose your plan and set up billing"
                },
                "customization": {
                    "completed": onboarding.get("customization_complete", False),
                    "title": "Customization",
                    "description": "Customize your branding and settings"
                }
            },
            "trial_status": {
                "active": subscription.get("status") == "trial",
                "ends_at": subscription.get("trial_ends_at"),
                "days_remaining": BusinessOnboardingService._calculate_trial_days_remaining(
                    subscription.get("trial_ends_at")
                )
            }
        }
    
    @staticmethod
    def _get_default_services(vertical_type: str) -> List[Dict[str, Any]]:
        """Get default services for a vertical."""
        services_map = {
            "carwash": [
                {"category": "wash", "name": "Basic Wash", "base_price": 5000},
                {"category": "wash", "name": "Premium Wash", "base_price": 8000},
                {"category": "wash", "name": "Full Detail", "base_price": 15000}
            ],
            "padel": [
                {"category": "court", "name": "Court Rental (1 Hour)", "base_price": 20000},
                {"category": "coaching", "name": "Private Lesson", "base_price": 50000},
                {"category": "equipment", "name": "Racket Rental", "base_price": 5000}
            ],
            "beauty": [
                {"category": "treatment", "name": "Facial Treatment", "base_price": 80000},
                {"category": "treatment", "name": "Manicure", "base_price": 30000},
                {"category": "treatment", "name": "Pedicure", "base_price": 35000}
            ],
            "flowershop": [
                {"category": "bouquet", "name": "Mixed Bouquet", "base_price": 25000},
                {"category": "arrangement", "name": "Table Arrangement", "base_price": 40000},
                {"category": "plant", "name": "Potted Plant", "base_price": 15000}
            ],
            "dispensary": [
                {"category": "flower", "name": "Premium Flower (1g)", "base_price": 20000},
                {"category": "edible", "name": "Gummy (10mg)", "base_price": 15000},
                {"category": "accessory", "name": "Rolling Papers", "base_price": 500}
            ]
        }
        
        return services_map.get(vertical_type, [])
    
    @staticmethod
    def _get_next_step(current_step: str) -> Optional[str]:
        """Get the next onboarding step."""
        steps = ["account_created", "business_info", "services_setup", "subscription_setup", "customization", "completed"]
        try:
            current_index = steps.index(current_step)
            if current_index < len(steps) - 1:
                return steps[current_index + 1]
        except ValueError:
            pass
        return None
    
    @staticmethod
    def _calculate_trial_days_remaining(trial_ends_at: Optional[str]) -> int:
        """Calculate days remaining in trial."""
        if not trial_ends_at:
            return 0
        
        try:
            from datetime import datetime
            end_date = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
            now = datetime.utcnow()
            delta = end_date - now
            return max(0, delta.days)
        except:
            return 0


# Global service instance
onboarding_service = BusinessOnboardingService()
