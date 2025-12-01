"""
Caching utilities for tenant data.

Provides cached access to frequently-accessed tenant data:
- Tenant metadata
- Tenant branding
- Tenant settings
- Tenant integrations
"""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session, selectinload

from app.core.cache import get_cache, CacheConfig, cached
from app.models import Tenant, TenantBranding, TenantIntegration
from app.core.tenant_context import TenantContext, tenant_meta_dict

logger = logging.getLogger(__name__)


def get_cached_tenant_meta(tenant_id: str, db: Session) -> Optional[Dict[str, Any]]:
    """
    Get tenant metadata with caching.
    
    Uses multi-layer cache (L1 + L2) with 5-minute TTL.
    Falls back to database on cache miss.
    
    Args:
        tenant_id: Tenant identifier
        db: Database session
    
    Returns:
        Tenant metadata dict or None if not found
    """
    try:
        cache = get_cache()
        cache_key = f"{CacheConfig.TENANT_META_PREFIX}:{tenant_id}"
        
        # Try cache
        cached_meta = cache.get(cache_key, ttl=CacheConfig.TENANT_META_TTL)
        if cached_meta is not None:
            logger.debug(f"Tenant meta cache HIT: {tenant_id}")
            return cached_meta
        
        # Cache miss - query database
        logger.debug(f"Tenant meta cache MISS: {tenant_id}")
        tenant = (
            db.query(Tenant)
            .options(selectinload(Tenant.integrations))
            .filter(Tenant.id == tenant_id)
            .first()
        )
        
        if not tenant:
            return None
        
        # Build metadata
        tenant_ctx = TenantContext(tenant)
        meta = tenant_meta_dict(tenant_ctx)
        
        # Store in cache
        cache.set(cache_key, meta, ttl=CacheConfig.TENANT_META_TTL)
        
        return meta
        
    except RuntimeError:
        # Cache not initialized - fall back to direct DB query
        logger.warning("Cache not initialized, falling back to direct DB query")
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            return tenant_meta_dict(TenantContext(tenant))
        return None
    except Exception as e:
        logger.error(f"Error getting cached tenant meta: {e}", exc_info=True)
        # Fall back to direct DB query
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            return tenant_meta_dict(TenantContext(tenant))
        return None


def get_cached_tenant_branding(tenant_id: str, db: Session) -> Optional[Dict[str, Any]]:
    """
    Get tenant branding with caching.
    
    Uses multi-layer cache with 10-minute TTL (branding changes less frequently).
    
    Args:
        tenant_id: Tenant identifier
        db: Database session
    
    Returns:
        Tenant branding dict or None if not found
    """
    try:
        cache = get_cache()
        cache_key = f"{CacheConfig.TENANT_BRANDING_PREFIX}:{tenant_id}"
        
        # Try cache
        cached_branding = cache.get(cache_key, ttl=CacheConfig.TENANT_BRANDING_TTL)
        if cached_branding is not None:
            logger.debug(f"Tenant branding cache HIT: {tenant_id}")
            return cached_branding
        
        # Cache miss - query database
        logger.debug(f"Tenant branding cache MISS: {tenant_id}")
        branding = (
            db.query(TenantBranding)
            .filter(TenantBranding.tenant_id == tenant_id)
            .first()
        )
        
        if not branding:
            return None
        
        # Build branding dict
        branding_dict = {
            "logo_url": branding.logo_url,
            "primary_color": branding.primary_color,
            "secondary_color": branding.secondary_color,
            "font_family": branding.font_family,
            "custom_css": branding.custom_css,
        }
        
        # Store in cache
        cache.set(cache_key, branding_dict, ttl=CacheConfig.TENANT_BRANDING_TTL)
        
        return branding_dict
        
    except RuntimeError:
        # Cache not initialized
        logger.warning("Cache not initialized for branding lookup")
        branding = db.query(TenantBranding).filter(TenantBranding.tenant_id == tenant_id).first()
        if branding:
            return {
                "logo_url": branding.logo_url,
                "primary_color": branding.primary_color,
                "secondary_color": branding.secondary_color,
                "font_family": branding.font_family,
                "custom_css": branding.custom_css,
            }
        return None
    except Exception as e:
        logger.error(f"Error getting cached tenant branding: {e}", exc_info=True)
        return None


def invalidate_tenant_cache(tenant_id: str):
    """
    Invalidate all cached data for a tenant.
    
    Call this when tenant data is updated (metadata, branding, settings).
    Publishes invalidation event to other instances via Redis pub/sub.
    
    Args:
        tenant_id: Tenant identifier
    """
    try:
        cache = get_cache()
        
        # Invalidate specific keys
        cache.delete(f"{CacheConfig.TENANT_META_PREFIX}:{tenant_id}")
        cache.delete(f"{CacheConfig.TENANT_BRANDING_PREFIX}:{tenant_id}")
        
        # Publish invalidation event for other instances
        cache.publish_invalidation({
            "type": "tenant",
            "tenant_id": tenant_id,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        })
        
        logger.info(f"Invalidated cache for tenant: {tenant_id}")
        
    except RuntimeError:
        # Cache not initialized - nothing to invalidate
        pass
    except Exception as e:
        logger.error(f"Error invalidating tenant cache: {e}", exc_info=True)


def invalidate_all_tenant_caches():
    """
    Invalidate all tenant caches (nuclear option).
    
    Use sparingly - typically only for schema migrations or global config changes.
    """
    try:
        cache = get_cache()
        cache.invalidate_pattern(f"{CacheConfig.TENANT_META_PREFIX}:*")
        cache.invalidate_pattern(f"{CacheConfig.TENANT_BRANDING_PREFIX}:*")
        
        logger.warning("Invalidated ALL tenant caches")
        
    except RuntimeError:
        pass
    except Exception as e:
        logger.error(f"Error invalidating all tenant caches: {e}", exc_info=True)


def warm_tenant_cache(tenant_id: str, db: Session):
    """
    Proactively warm the cache for a tenant.
    
    Useful after tenant creation or updates to ensure first request is fast.
    
    Args:
        tenant_id: Tenant identifier
        db: Database session
    """
    try:
        # Warm metadata cache
        get_cached_tenant_meta(tenant_id, db)
        
        # Warm branding cache
        get_cached_tenant_branding(tenant_id, db)
        
        logger.info(f"Warmed cache for tenant: {tenant_id}")
        
    except Exception as e:
        logger.error(f"Error warming tenant cache: {e}", exc_info=True)
