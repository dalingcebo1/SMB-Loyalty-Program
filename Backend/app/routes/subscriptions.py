"""
Subscription Management Routes

Stub endpoints for subscription and module management.
These endpoints return minimal data to prevent 404 errors in the frontend
until full subscription management is implemented.
"""

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.tenant_context import get_current_tenant
from typing import Dict, List, Any

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/modules")
async def list_modules(
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    List all available feature modules.
    
    Returns minimal stub data until subscription management is fully implemented.
    """
    # Return empty list for now - prevents 404 errors
    return []


@router.get("/tenants/{tenant_id}")
async def get_tenant_subscription(
    tenant_id: str = Path(..., description="Tenant ID"),
    db: Session = Depends(get_db),
    tenant = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Get subscription details for a tenant.
    
    Returns minimal stub data until subscription management is fully implemented.
    """
    # Return minimal structure to prevent frontend errors
    return {
        "plan": None,
        "active_modules": [],
        "subscription_status": "active",
    }


@router.get("/tenants/{tenant_id}/overrides")
async def get_tenant_overrides(
    tenant_id: str = Path(..., description="Tenant ID"),
    db: Session = Depends(get_db),
    tenant = Depends(get_current_tenant),
) -> List[Dict[str, Any]]:
    """
    Get module overrides for a tenant.
    
    Returns empty list until subscription management is fully implemented.
    """
    return []


@router.post("/tenants/{tenant_id}/assign-plan")
async def assign_plan(
    tenant_id: str = Path(..., description="Tenant ID"),
    plan_data: Dict[str, Any] = None,
    db: Session = Depends(get_db),
    tenant = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Assign a subscription plan to a tenant.
    
    Stub endpoint - returns success without making changes.
    """
    return {"success": True, "message": "Subscription management not yet implemented"}


@router.post("/tenants/{tenant_id}/override")
async def toggle_module_override(
    tenant_id: str = Path(..., description="Tenant ID"),
    override_data: Dict[str, Any] = None,
    db: Session = Depends(get_db),
    tenant = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Toggle a module override for a tenant.
    
    Stub endpoint - returns success without making changes.
    """
    return {"success": True, "message": "Module overrides not yet implemented"}
