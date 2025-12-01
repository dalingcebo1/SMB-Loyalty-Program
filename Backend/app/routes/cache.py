"""
Cache observability endpoint.

Provides cache statistics and health information for monitoring.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.plugins.auth.routes import require_capability
from app.models import User
from app.core.cache import get_cache

router = APIRouter(prefix="/ops/cache", tags=["ops", "cache"])


@router.get("/stats")
async def get_cache_stats(
    _user: User = Depends(require_capability("ops.view")),
):
    """
    Get cache statistics.
    
    Requires ops.view capability (admin only).
    
    Returns:
        Cache stats including hit rates, sizes, Redis connectivity
    """
    try:
        cache = get_cache()
        stats = cache.get_stats()
        
        return {
            "status": "ok",
            "cache_enabled": True,
            "stats": stats,
        }
    except RuntimeError:
        # Cache not initialized
        return {
            "status": "disabled",
            "cache_enabled": False,
            "stats": {},
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving cache stats: {str(e)}",
        )


@router.post("/invalidate/{cache_type}")
async def invalidate_cache(
    cache_type: str,
    _user: User = Depends(require_capability("ops.admin")),
):
    """
    Manually invalidate cache by type.
    
    Requires ops.admin capability (admin only).
    
    Args:
        cache_type: Type of cache to invalidate (tenant_meta, tenant_branding, all)
    
    Returns:
        Success message
    """
    try:
        cache = get_cache()
        
        if cache_type == "tenant_meta":
            from app.core.cache import CacheConfig
            cache.invalidate_pattern(f"{CacheConfig.TENANT_META_PREFIX}:*")
            return {"status": "ok", "message": "Tenant metadata cache invalidated"}
        
        elif cache_type == "tenant_branding":
            from app.core.cache import CacheConfig
            cache.invalidate_pattern(f"{CacheConfig.TENANT_BRANDING_PREFIX}:*")
            return {"status": "ok", "message": "Tenant branding cache invalidated"}
        
        elif cache_type == "all":
            from app.core.tenant_cache import invalidate_all_tenant_caches
            invalidate_all_tenant_caches()
            return {"status": "ok", "message": "All caches invalidated"}
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown cache type: {cache_type}. Valid types: tenant_meta, tenant_branding, all",
            )
    
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cache not initialized",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error invalidating cache: {str(e)}",
        )


@router.post("/warm")
async def warm_caches(
    tenant_id: str = None,
    _user: User = Depends(require_capability("ops.admin")),
):
    """
    Manually warm caches.
    
    Requires ops.admin capability (admin only).
    
    Args:
        tenant_id: Optional tenant ID to warm specific tenant (omit for all)
    
    Returns:
        Warming result
    """
    try:
        from app.core.cache_warmer import warm_tenant_cache_by_id, warm_all_tenant_caches
        
        if tenant_id:
            # Warm specific tenant
            success = warm_tenant_cache_by_id(tenant_id)
            if success:
                return {
                    "status": "ok",
                    "message": f"Cache warmed for tenant {tenant_id}",
                    "tenant_id": tenant_id
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to warm cache for tenant {tenant_id}",
                )
        else:
            # Warm all tenants
            result = warm_all_tenant_caches()
            return {
                "status": "ok",
                "message": "All tenant caches warmed",
                "result": result
            }
    
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cache not initialized",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error warming cache: {str(e)}",
        )


@router.get("/warming/stats")
async def get_warming_stats(
    _user: User = Depends(require_capability("ops.view")),
):
    """
    Get cache warming statistics.
    
    Requires ops.view capability (admin only).
    
    Returns:
        Cache warming stats
    """
    try:
        from app.core.cache_warmer import get_cache_warming_stats
        
        stats = get_cache_warming_stats()
        return stats
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving warming stats: {str(e)}",
        )
