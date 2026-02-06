"""
Usage Tracking Service

Tracks resource usage per tenant to enforce subscription plan limits.
Monitors: customers, transactions, API calls, storage usage.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.orm import Session
import logging

from app.models import User, Order
from app.core.cache import get_cache

logger = logging.getLogger(__name__)

# Cache TTL for usage stats (1 hour)
USAGE_CACHE_TTL = 3600


class UsageTracker:
    """
    Tracks and retrieves tenant resource usage.
    
    Provides methods to:
    - Get current usage counts
    - Check if usage exceeds plan limits
    - Get historical usage trends
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.cache = get_cache()
    
    def get_current_usage(self, tenant_id: str, use_cache: bool = True) -> Dict[str, Any]:
        """
        Get current usage metrics for a tenant.
        
        Args:
            tenant_id: The tenant ID
            use_cache: Whether to use cached values (default True)
            
        Returns:
            Dict with usage counts:
            {
                "customers": 150,
                "transactions": 5234,
                "api_calls_today": 1200,
                "storage_mb": 45.2,
                "last_updated": "2026-02-05T10:00:00Z"
            }
        """
        cache_key = f"usage:tenant:{tenant_id}:current"
        
        # Try cache first
        if use_cache and self.cache:
            try:
                cached = self.cache.get(cache_key)
                if cached:
                    logger.debug(f"Usage cache hit for tenant {tenant_id}")
                    return cached
            except Exception as e:
                logger.warning(f"Cache read failed: {e}")
        
        # Calculate fresh usage stats
        usage = self._calculate_usage(tenant_id)
        
        # Cache the result
        if self.cache:
            try:
                self.cache.set(cache_key, usage, ttl=USAGE_CACHE_TTL)
            except Exception as e:
                logger.warning(f"Cache write failed: {e}")
        
        return usage
    
    def _calculate_usage(self, tenant_id: str) -> Dict[str, Any]:
        """Calculate usage metrics from database."""
        
        # Count customers (active users with role='user')
        customer_count = self.db.execute(
            select(func.count(User.id))
            .where(User.tenant_id == tenant_id)
            .where(User.role == 'user')
        ).scalar() or 0
        
        # Count transactions (all orders)
        transaction_count = self.db.execute(
            select(func.count(Order.id))
            .where(Order.tenant_id == tenant_id)
        ).scalar() or 0
        
        # Count transactions in current month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_transactions = self.db.execute(
            select(func.count(Order.id))
            .where(Order.tenant_id == tenant_id)
            .where(Order.created_at >= month_start)
        ).scalar() or 0
        
        # API calls tracked separately in Redis (would be retrieved here in production)
        # For now, return 0 as placeholder
        api_calls_today = 0
        
        # Storage calculation (placeholder - would sum up file sizes in blob storage)
        storage_mb = 0.0
        
        return {
            "customers": customer_count,
            "transactions": transaction_count,
            "transactions_this_month": monthly_transactions,
            "api_calls_today": api_calls_today,
            "storage_mb": storage_mb,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    def check_limit(
        self, 
        tenant_id: str, 
        resource: str, 
        plan_limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Check if tenant is within limits for a resource.
        
        Args:
            tenant_id: The tenant ID
            resource: Resource type ('customers', 'transactions', etc.)
            plan_limit: The limit from subscription plan (if None, no limit)
            
        Returns:
            Dict with limit check results:
            {
                "resource": "customers",
                "current": 150,
                "limit": 1000,
                "remaining": 850,
                "percent_used": 15.0,
                "exceeded": False
            }
        """
        usage = self.get_current_usage(tenant_id)
        current = usage.get(resource, 0)
        
        if plan_limit is None:
            # No limit (unlimited plan or resource not tracked)
            return {
                "resource": resource,
                "current": current,
                "limit": None,
                "remaining": None,
                "percent_used": 0.0,
                "exceeded": False
            }
        
        remaining = max(0, plan_limit - current)
        percent_used = (current / plan_limit * 100) if plan_limit > 0 else 0
        exceeded = current >= plan_limit
        
        return {
            "resource": resource,
            "current": current,
            "limit": plan_limit,
            "remaining": remaining,
            "percent_used": round(percent_used, 1),
            "exceeded": exceeded
        }
    
    def get_usage_history(
        self, 
        tenant_id: str, 
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get historical usage trends.
        
        Args:
            tenant_id: The tenant ID
            days: Number of days to look back
            
        Returns:
            Dict with daily usage counts
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Query orders grouped by day
        # This is a simplified version - production would use more sophisticated time-series queries
        daily_transactions = self.db.execute(
            select(
                func.date(Order.created_at).label('date'),
                func.count(Order.id).label('count')
            )
            .where(Order.tenant_id == tenant_id)
            .where(Order.created_at >= cutoff)
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at))
        ).all()
        
        return {
            "period_days": days,
            "daily_transactions": [
                {"date": str(row.date), "count": row.count}
                for row in daily_transactions
            ]
        }
    
    def invalidate_cache(self, tenant_id: str) -> None:
        """
        Invalidate usage cache for a tenant.
        
        Call this after creating/deleting customers or transactions.
        """
        if not self.cache:
            return
        
        cache_key = f"usage:tenant:{tenant_id}:current"
        try:
            self.cache.delete(cache_key)
            logger.debug(f"Invalidated usage cache for tenant {tenant_id}")
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")


def get_usage_tracker(db: Session) -> UsageTracker:
    """Factory function to create UsageTracker instance."""
    return UsageTracker(db)
