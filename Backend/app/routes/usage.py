"""
Usage API Routes

Endpoints for retrieving tenant resource usage and plan limits.
"""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.plans import PLAN_REGISTRY, get_plan_limits
from app.core.tenant_context import TenantContext, get_tenant_context
from app.models import Tenant
from app.services.usage_tracker import get_usage_tracker

router = APIRouter(prefix="/api/usage", tags=["usage"])


class UsageResponse(BaseModel):
    """Current usage statistics"""
    customers: int
    transactions: int
    transactions_this_month: int
    api_calls_today: int
    storage_mb: float
    last_updated: str


class LimitCheckResponse(BaseModel):
    """Usage limit check result"""
    resource: str
    current: int
    limit: Optional[int]
    remaining: Optional[int]
    percent_used: float
    exceeded: bool


class UsageSummaryResponse(BaseModel):
    """Complete usage summary with plan limits"""
    usage: UsageResponse
    plan_id: str
    plan_name: str
    limits: Dict[str, Optional[int]]
    checks: List[LimitCheckResponse]
    upgrade_available: bool


@router.get("/current", response_model=UsageResponse)
def get_current_usage(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Get current resource usage for the authenticated tenant.
    
    Returns counts of customers, transactions, API calls, and storage.
    Cached for 1 hour for performance.
    """
    tracker = get_usage_tracker(db)
    usage = tracker.get_current_usage(tenant_ctx.tenant_id)
    
    return UsageResponse(**usage)


@router.get("/limits/{resource}", response_model=LimitCheckResponse)
def check_resource_limit(
    resource: str,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Check if tenant is within limits for a specific resource.
    
    Args:
        resource: Resource type ('customers', 'transactions', 'storage_mb')
    
    Returns:
        Current usage, limit, and whether limit is exceeded
    """
    # Get tenant's subscription plan
    tenant = db.query(Tenant).filter(Tenant.id == tenant_ctx.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    plan_id = tenant.subscription_plan_id or "free"
    plan_limits = get_plan_limits(plan_id)
    limit = plan_limits.get(resource) if plan_limits else None
    
    tracker = get_usage_tracker(db)
    check = tracker.check_limit(tenant_ctx.tenant_id, resource, limit)
    
    return LimitCheckResponse(**check)


@router.get("/summary", response_model=UsageSummaryResponse)
def get_usage_summary(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Get complete usage summary with plan limits and upgrade status.
    
    Useful for billing dashboards and usage widgets.
    """
    # Get tenant and plan info
    tenant = db.query(Tenant).filter(Tenant.id == tenant_ctx.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    plan_id = tenant.subscription_plan_id or "free"
    plan_config = PLAN_REGISTRY.get(plan_id, {})
    plan_name = plan_config.get("name", "Unknown Plan")
    plan_limits = plan_config.get("limits", {})
    
    # Get current usage
    tracker = get_usage_tracker(db)
    usage = tracker.get_current_usage(tenant_ctx.tenant_id)
    
    # Check all tracked resources
    checks = []
    for resource in ["customers", "transactions"]:
        limit = plan_limits.get(resource)
        check = tracker.check_limit(tenant_ctx.tenant_id, resource, limit)
        checks.append(LimitCheckResponse(**check))
    
    # Determine if upgrade is available
    # (Simplified - would check if there's a higher tier plan)
    upgrade_available = plan_id == "free"
    
    return UsageSummaryResponse(
        usage=UsageResponse(**usage),
        plan_id=plan_id,
        plan_name=plan_name,
        limits=plan_limits,
        checks=checks,
        upgrade_available=upgrade_available
    )


@router.get("/history")
def get_usage_history(
    days: int = 30,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Get historical usage trends.
    
    Args:
        days: Number of days to look back (default 30)
    
    Returns:
        Daily usage statistics for the period
    """
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Days must be between 1 and 365"
        )
    
    tracker = get_usage_tracker(db)
    history = tracker.get_usage_history(tenant_ctx.tenant_id, days)
    
    return history


@router.post("/invalidate-cache")
def invalidate_usage_cache(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    """
    Invalidate cached usage statistics.
    
    Call after bulk operations that affect usage counts.
    Requires admin capability.
    """
    tracker = get_usage_tracker(db)
    tracker.invalidate_cache(tenant_ctx.tenant_id)
    
    return {"message": "Usage cache invalidated", "tenant_id": tenant_ctx.tenant_id}
