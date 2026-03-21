"""
Cache Warming Service

Proactively warms caches on startup and periodically to improve performance.
"""
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from database import SessionLocal
from app.models import Tenant
from app.core.tenant_cache import warm_tenant_cache
from app.core.cache import get_cache

logger = logging.getLogger(__name__)


def warm_startup_caches() -> int:
    """
    Warm critical caches on application startup.
    
    Warms:
    - Active tenant metadata
    - Active tenant branding
    - Vertical registry
    
    Returns:
        Number of items warmed
    """
    db = SessionLocal()
    warmed_count = 0
    
    try:
        # Get all active tenants
        active_tenants = db.query(Tenant).filter_by(subscription_status="active").all()
        logger.info(f"Warming caches for {len(active_tenants)} active tenants")
        
        # Warm tenant caches
        for tenant in active_tenants:
            try:
                warm_tenant_cache(tenant.id, db)
                warmed_count += 2  # metadata + branding
            except Exception as exc:
                logger.warning(
                    f"Failed to warm cache for tenant {tenant.id}: {exc}"
                )
        
        # Warm vertical registry cache
        try:
            _warm_vertical_registry()
            warmed_count += 1
        except Exception as exc:
            logger.warning(f"Failed to warm vertical registry cache: {exc}")
        
        # Phase 3: Warm catalog cache
        try:
            _warm_catalog_cache(db)
            warmed_count += 2  # services + extras
        except Exception as exc:
            logger.warning(f"Failed to warm catalog cache: {exc}")
        
        logger.info(f"Cache warming complete: {warmed_count} items warmed")
        return warmed_count
        
    except Exception as exc:
        logger.error(f"Cache warming failed: {exc}", exc_info=True)
        return warmed_count
    finally:
        db.close()


def _warm_vertical_registry():
    """Warm vertical registry cache"""
    from app.verticals import registry
    from app.core.cache import CacheConfig
    
    cache = get_cache()
    if not cache:
        return
    
    # Cache vertical list
    verticals = registry.list_all()
    vertical_data = [
        {
            "key": v.vertical_key,
            "name": v.display_name,
            "description": v.description,
            "features": v.get_features()
        }
        for v in verticals
    ]
    
    cache.set(
        f"{CacheConfig.VERTICAL_REGISTRY_PREFIX}:list",
        vertical_data,
        ttl=CacheConfig.VERTICAL_REGISTRY_TTL
    )
    
    logger.debug(f"Warmed vertical registry cache: {len(verticals)} verticals")


def _warm_catalog_cache(db: Session):
    """Warm catalog cache with services and extras (Phase 3).
    
    Catalog data is frequently accessed but rarely changes,
    making it an excellent candidate for pre-warming on startup.
    """
    from app.models import Service, Extra
    from app.utils.pagination import safe_limit
    
    cache = get_cache()
    if not cache:
        return
    
    try:
        # Warm services cache
        services_out: dict[str, list] = {}
        for s in safe_limit(db.query(Service).order_by(Service.category, Service.name), limit=200).all():
            services_out.setdefault(s.category, []).append({
                "id": s.id,
                "name": s.name,
                "base_price": s.base_price,
            })
        cache.set("catalog:services", services_out, ttl=600)
        logger.debug(f"Warmed services cache: {len(services_out)} categories")
        
        # Warm extras cache
        extras_list = [
            {"id": e.id, "name": e.name, "price_map": e.price_map}
            for e in safe_limit(db.query(Extra).order_by(Extra.name), limit=200).all()
        ]
        cache.set("catalog:extras", extras_list, ttl=600)
        logger.debug(f"Warmed extras cache: {len(extras_list)} extras")
        
    except Exception as exc:
        logger.warning(f"Failed to warm catalog cache: {exc}")


def warm_tenant_cache_by_id(tenant_id: str) -> bool:
    """
    Warm cache for a specific tenant.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        True if successful, False otherwise
    """
    db = SessionLocal()
    try:
        warm_tenant_cache(tenant_id, db)
        return True
    except Exception as exc:
        logger.error(
            f"Failed to warm cache for tenant {tenant_id}: {exc}",
            exc_info=True
        )
        return False
    finally:
        db.close()


def warm_all_tenant_caches() -> Dict[str, Any]:
    """
    Warm caches for all active tenants.
    
    Returns:
        Summary of warming results
    """
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).filter_by(subscription_status="active").all()
        
        success_count = 0
        failure_count = 0
        
        for tenant in tenants:
            try:
                warm_tenant_cache(tenant.id, db)
                success_count += 1
            except Exception as exc:
                logger.warning(
                    f"Failed to warm cache for tenant {tenant.id}: {exc}"
                )
                failure_count += 1
        
        return {
            "status": "completed",
            "total_tenants": len(tenants),
            "success": success_count,
            "failed": failure_count
        }
        
    finally:
        db.close()


def warm_high_traffic_tenants(limit: int = 10) -> Dict[str, Any]:
    """
    Warm caches for high-traffic tenants.
    
    Prioritizes tenants with recent activity for cache warming.
    
    Args:
        limit: Number of tenants to warm
    
    Returns:
        Summary of warming results
    """
    db = SessionLocal()
    try:
        # Get tenants with recent orders (proxy for high traffic)
        from app.models import Order
        from sqlalchemy import func, desc
        
        high_traffic_tenants = (
            db.query(Tenant)
            .join(Order, Tenant.id == Order.tenant_id)
            .filter(Tenant.subscription_status == "active")
            .group_by(Tenant.id)
            .order_by(desc(func.count(Order.id)))
            .limit(limit)
            .all()
        )
        
        logger.info(
            f"Warming caches for top {len(high_traffic_tenants)} "
            f"high-traffic tenants"
        )
        
        success_count = 0
        for tenant in high_traffic_tenants:
            try:
                warm_tenant_cache(tenant.id, db)
                success_count += 1
            except Exception as exc:
                logger.warning(
                    f"Failed to warm cache for tenant {tenant.id}: {exc}"
                )
        
        return {
            "status": "completed",
            "warmed": success_count,
            "total": len(high_traffic_tenants)
        }
        
    finally:
        db.close()


def invalidate_and_warm_tenant(tenant_id: str) -> bool:
    """
    Invalidate and immediately re-warm tenant cache.
    
    Useful after tenant updates to ensure fresh data in cache.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        True if successful, False otherwise
    """
    from app.core.tenant_cache import invalidate_tenant_cache
    
    try:
        # Invalidate old cache
        invalidate_tenant_cache(tenant_id)
        
        # Warm with fresh data
        return warm_tenant_cache_by_id(tenant_id)
        
    except Exception as exc:
        logger.error(
            f"Failed to invalidate and warm cache for tenant {tenant_id}: {exc}",
            exc_info=True
        )
        return False


def get_cache_warming_stats() -> Dict[str, Any]:
    """
    Get statistics about cache warming.
    
    Returns:
        Cache warming statistics
    """
    cache = get_cache()
    if not cache:
        return {"status": "cache_disabled"}
    
    db = SessionLocal()
    try:
        # Count active tenants
        active_tenant_count = db.query(Tenant).filter_by(subscription_status="active").count()
        
        # Get cache stats
        cache_stats = cache.get_stats()
        
        return {
            "status": "ok",
            "active_tenants": active_tenant_count,
            "cache_stats": cache_stats,
            "estimated_warm_items": active_tenant_count * 2,  # metadata + branding
        }
        
    finally:
        db.close()
