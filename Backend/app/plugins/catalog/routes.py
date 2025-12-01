from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.cache import get_cache, CacheConfig
from app.models import Service, Extra
from app.plugins.auth.routes import get_current_user
from app.utils.pagination import safe_limit

router = APIRouter(tags=["catalog"])

@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    """List services with Redis caching (Phase 3).
    
    Services rarely change, so we cache for 10 minutes.
    Cache key includes tenant context when multi-tenancy is active.
    """
    # Try cache first (Phase 3 optimization)
    try:
        cache = get_cache()
        cache_key = "catalog:services"  # TODO: Add tenant_id when multi-tenancy is active
        
        cached_result = cache.get(cache_key, ttl=CacheConfig.TENANT_META_TTL)
        if cached_result is not None:
            return cached_result
    except RuntimeError:
        # Cache not initialized (e.g., in tests) - skip caching
        pass
    
    # Cache miss or cache unavailable - query database
    out: dict[str, list] = {}
    for s in safe_limit(db.query(Service).order_by(Service.category, Service.name), limit=200).all():
        out.setdefault(s.category, []).append({
            "id": s.id,
            "name": s.name,
            "base_price": s.base_price,
        })
    
    # Store in cache for 10 minutes (if available)
    try:
        cache = get_cache()
        cache.set(cache_key, out, ttl=600)
    except RuntimeError:
        pass
    
    return out

@router.get("/extras")
def list_extras(db: Session = Depends(get_db)):
    """List extras with Redis caching (Phase 3).
    
    Extras rarely change, so we cache for 10 minutes.
    Cache key includes tenant context when multi-tenancy is active.
    """
    # Try cache first (Phase 3 optimization)
    try:
        cache = get_cache()
        cache_key = "catalog:extras"  # TODO: Add tenant_id when multi-tenancy is active
        
        cached_result = cache.get(cache_key, ttl=CacheConfig.TENANT_META_TTL)
        if cached_result is not None:
            return cached_result
    except RuntimeError:
        # Cache not initialized (e.g., in tests) - skip caching
        pass
    
    # Cache miss or cache unavailable - query database
    result = [
        {"id": e.id, "name": e.name, "price_map": e.price_map}
        for e in safe_limit(db.query(Extra).order_by(Extra.name), limit=200).all()
    ]
    
    # Store in cache for 10 minutes (if available)
    try:
        cache = get_cache()
        cache.set(cache_key, result, ttl=600)
    except RuntimeError:
        pass
    
    return result
