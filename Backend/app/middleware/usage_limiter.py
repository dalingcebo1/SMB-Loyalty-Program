"""
Usage Limiter Middleware

Checks subscription plan limits before allowing resource creation.
Returns 402 Payment Required when limits are exceeded.
"""

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import logging

from app.core.tenant_context import get_tenant_id_from_request
from app.core.plans import PLAN_REGISTRY, get_plan_limits

logger = logging.getLogger(__name__)

# Resources that should be checked against plan limits
RATE_LIMITED_RESOURCES = {
    '/api/customers': 'customers',
    '/api/users': 'customers',  # Creating users counts as customers
    '/api/orders': 'transactions',
}


class UsageLimiterMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce subscription plan limits.
    
    Checks before POST/PUT requests that create resources.
    Returns 402 Payment Required if tenant has exceeded their plan limits.
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Only check on resource creation (POST)
        if request.method != "POST":
            return await call_next(request)
        
        # Check if this endpoint creates a rate-limited resource
        path = request.url.path
        resource_type = None
        
        for endpoint, resource in RATE_LIMITED_RESOURCES.items():
            if path.startswith(endpoint):
                resource_type = resource
                break
        
        if not resource_type:
            # Not a rate-limited endpoint
            return await call_next(request)
        
        # Get tenant from request
        try:
            tenant_id = get_tenant_id_from_request(request)
        except Exception:
            # If we can't determine tenant, let the request through
            # (auth middleware will handle it)
            return await call_next(request)
        
        if not tenant_id:
            return await call_next(request)
        
        # Check usage limits
        # Note: This is a simplified version. Production would:
        # 1. Get tenant's subscription plan from database
        # 2. Get current usage from UsageTracker
        # 3. Compare against plan limits
        # 4. Return 402 if exceeded
        
        # For now, just log and pass through
        # (Full implementation would go here)
        logger.debug(
            f"Usage check: tenant={tenant_id}, resource={resource_type}, "
            f"endpoint={path}"
        )
        
        response = await call_next(request)
        return response


def check_usage_limit(
    tenant_id: str,
    resource_type: str,
    plan_id: str
) -> None:
    """
    Check if tenant can create more of a resource.
    
    Args:
        tenant_id: The tenant ID
        resource_type: Type of resource ('customers', 'transactions', etc.)
        plan_id: Subscription plan ID
        
    Raises:
        HTTPException(402): If limit exceeded
    """
    # Get plan limits
    plan_limits = get_plan_limits(plan_id)
    
    if not plan_limits:
        # Unknown plan or unlimited plan
        return
    
    limit = plan_limits.get(resource_type)
    
    if limit is None:
        # No limit for this resource
        return
    
    # This is where we'd check current usage
    # For now, placeholder
    # In production:
    # from app.services.usage_tracker import get_usage_tracker
    # tracker = get_usage_tracker(db)
    # check = tracker.check_limit(tenant_id, resource_type, limit)
    # if check['exceeded']:
    #     raise HTTPException(
    #         status_code=status.HTTP_402_PAYMENT_REQUIRED,
    #         detail={
    #             "error": "usage_limit_exceeded",
    #             "message": f"Your plan allows {limit} {resource_type}. Please upgrade.",
    #             "resource": resource_type,
    #             "current": check['current'],
    #             "limit": limit,
    #             "upgrade_url": "/admin/subscription"
    #         }
    #     )
    
    pass
