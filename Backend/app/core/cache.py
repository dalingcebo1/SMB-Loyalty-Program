"""
Multi-layer caching system for tenant data and application state.

Provides a three-tier caching strategy:
1. L1: In-process memory cache (fastest, per-worker)
2. L2: Redis cache (fast, shared across workers/instances)
3. L3: Database (slowest, source of truth)

Features:
- Automatic cache warming
- TTL-based expiration
- Pub/sub for cache invalidation across instances
- Configurable per-key TTLs
"""

import json
import logging
from typing import Optional, Dict, Any, Callable
from functools import wraps
from datetime import datetime, timedelta

try:
    from redis import Redis, RedisError
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = None

logger = logging.getLogger(__name__)


class CacheConfig:
    """Cache configuration and TTL settings."""
    
    # Default TTLs (in seconds)
    TENANT_META_TTL = 300  # 5 minutes
    TENANT_BRANDING_TTL = 600  # 10 minutes
    VERTICAL_REGISTRY_TTL = 3600  # 1 hour
    USER_SESSION_TTL = 1800  # 30 minutes
    ANALYTICS_TTL = 300  # 5 minutes
    
    # Cache key prefixes
    TENANT_META_PREFIX = "tenant_meta"
    TENANT_BRANDING_PREFIX = "tenant_branding"
    VERTICAL_REGISTRY_PREFIX = "vertical_registry"
    USER_SESSION_PREFIX = "user_session"
    ANALYTICS_PREFIX = "analytics"
    
    # Cache invalidation channel
    INVALIDATION_CHANNEL = "cache_invalidate"
    
    # Memory cache limits
    MEMORY_CACHE_MAX_SIZE = 1000


class InMemoryCache:
    """
    L1: In-process memory cache.
    
    Fast but limited to single worker process.
    Uses simple dict with LRU-style eviction.
    """
    
    def __init__(self, max_size: int = CacheConfig.MEMORY_CACHE_MAX_SIZE):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        self._max_size = max_size
        self._access_order: list[str] = []  # Track access order for LRU
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from memory cache."""
        if key in self._cache:
            value, expires_at = self._cache[key]
            
            # Check expiration
            if expires_at and datetime.utcnow() > expires_at:
                self.delete(key)
                return None
            
            # Update access order (LRU)
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)
            
            return value
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in memory cache."""
        expires_at = datetime.utcnow() + timedelta(seconds=ttl) if ttl else None
        
        # Evict oldest if at capacity
        if len(self._cache) >= self._max_size and key not in self._cache:
            if self._access_order:
                oldest_key = self._access_order.pop(0)
                self._cache.pop(oldest_key, None)
        
        self._cache[key] = (value, expires_at)
        
        if key not in self._access_order:
            self._access_order.append(key)
    
    def delete(self, key: str):
        """Delete value from memory cache."""
        self._cache.pop(key, None)
        if key in self._access_order:
            self._access_order.remove(key)
    
    def clear(self):
        """Clear entire memory cache."""
        self._cache.clear()
        self._access_order.clear()
    
    def size(self) -> int:
        """Get current cache size."""
        return len(self._cache)


class CacheLayer:
    """
    Multi-layer caching system.
    
    Coordinates between in-memory, Redis, and database layers.
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize cache layer.
        
        Args:
            redis_url: Redis connection URL (e.g., "redis://localhost:6379/0")
        """
        self._memory_cache = InMemoryCache()
        self._redis_client = None
        
        if REDIS_AVAILABLE and redis_url:
            try:
                self._redis_client = Redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self._redis_client.ping()
                logger.info(f"Redis cache initialized: {redis_url}")
            except RedisError as e:
                logger.warning(f"Redis connection failed: {e}. Falling back to memory cache only.")
                self._redis_client = None
        elif not REDIS_AVAILABLE:
            logger.warning("Redis library not available. Using memory cache only.")
    
    @property
    def redis_available(self) -> bool:
        """Check if Redis is available."""
        return self._redis_client is not None
    
    def get(self, key: str, ttl: Optional[int] = None) -> Optional[Any]:
        """
        Get value from cache (L1 → L2 → miss).
        
        Args:
            key: Cache key
            ttl: TTL for re-caching in L1 if found in L2
        
        Returns:
            Cached value or None if not found
        """
        # L1: Check memory cache
        value = self._memory_cache.get(key)
        if value is not None:
            logger.debug(f"Cache HIT (L1): {key}")
            return value
        
        # L2: Check Redis cache
        if self._redis_client:
            try:
                cached_json = self._redis_client.get(key)
                if cached_json:
                    value = json.loads(cached_json)
                    # Warm L1 cache
                    self._memory_cache.set(key, value, ttl=ttl)
                    logger.debug(f"Cache HIT (L2): {key}")
                    return value
            except RedisError as e:
                logger.warning(f"Redis GET error for key '{key}': {e}")
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error for key '{key}': {e}")
                # Invalid data, delete it
                self._redis_client.delete(key)
        
        logger.debug(f"Cache MISS: {key}")
        return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        skip_l1: bool = False,
        skip_l2: bool = False,
    ):
        """
        Set value in cache (L1 + L2).
        
        Args:
            key: Cache key
            value: Value to cache (must be JSON-serializable)
            ttl: TTL in seconds (None = no expiration)
            skip_l1: Skip L1 (memory) cache
            skip_l2: Skip L2 (Redis) cache
        """
        # L1: Set in memory cache
        if not skip_l1:
            self._memory_cache.set(key, value, ttl=ttl)
        
        # L2: Set in Redis cache
        if not skip_l2 and self._redis_client:
            try:
                cached_json = json.dumps(value)
                if ttl:
                    self._redis_client.setex(key, ttl, cached_json)
                else:
                    self._redis_client.set(key, cached_json)
                logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            except (RedisError, TypeError) as e:
                logger.warning(f"Redis SET error for key '{key}': {e}")
    
    def delete(self, key: str):
        """
        Delete value from all cache layers.
        
        Args:
            key: Cache key to delete
        """
        # L1: Delete from memory
        self._memory_cache.delete(key)
        
        # L2: Delete from Redis
        if self._redis_client:
            try:
                self._redis_client.delete(key)
                logger.debug(f"Cache DELETE: {key}")
            except RedisError as e:
                logger.warning(f"Redis DELETE error for key '{key}': {e}")
    
    def invalidate_pattern(self, pattern: str):
        """
        Invalidate all keys matching pattern (Redis only).
        
        Args:
            pattern: Redis key pattern (e.g., "tenant_meta:*")
        """
        if self._redis_client:
            try:
                keys = self._redis_client.keys(pattern)
                if keys:
                    self._redis_client.delete(*keys)
                    logger.info(f"Cache INVALIDATE: {len(keys)} keys matching '{pattern}'")
            except RedisError as e:
                logger.warning(f"Redis pattern invalidation error: {e}")
        
        # Clear entire L1 cache (can't pattern match in-memory)
        self._memory_cache.clear()
    
    def publish_invalidation(self, event: Dict[str, Any]):
        """
        Publish cache invalidation event to other instances.
        
        Args:
            event: Invalidation event (e.g., {"tenant_id": "abc", "keys": ["tenant_meta:abc"]})
        """
        if self._redis_client:
            try:
                self._redis_client.publish(
                    CacheConfig.INVALIDATION_CHANNEL,
                    json.dumps(event)
                )
                logger.debug(f"Published cache invalidation: {event}")
            except RedisError as e:
                logger.warning(f"Redis PUBLISH error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = {
            "l1_size": self._memory_cache.size(),
            "l1_max_size": self._memory_cache._max_size,
            "redis_available": self.redis_available,
        }
        
        if self._redis_client:
            try:
                info = self._redis_client.info("stats")
                stats.update({
                    "l2_total_commands": info.get("total_commands_processed", 0),
                    "l2_keyspace_hits": info.get("keyspace_hits", 0),
                    "l2_keyspace_misses": info.get("keyspace_misses", 0),
                })
            except RedisError:
                pass
        
        return stats


# Global cache instance (initialized in app startup)
_cache_instance: Optional[CacheLayer] = None


def get_cache() -> CacheLayer:
    """Get global cache instance."""
    if _cache_instance is None:
        raise RuntimeError("Cache layer not initialized. Call initialize_cache() first.")
    return _cache_instance


def initialize_cache(redis_url: Optional[str] = None) -> CacheLayer:
    """
    Initialize global cache instance.
    
    Args:
        redis_url: Redis connection URL
    
    Returns:
        Initialized CacheLayer instance
    """
    global _cache_instance
    _cache_instance = CacheLayer(redis_url=redis_url)
    return _cache_instance


def cached(
    key_func: Callable[..., str],
    ttl: int = 300,
    skip_l1: bool = False,
    skip_l2: bool = False,
):
    """
    Decorator for caching function results.
    
    Args:
        key_func: Function to generate cache key from function args
        ttl: Cache TTL in seconds
        skip_l1: Skip L1 (memory) cache
        skip_l2: Skip L2 (Redis) cache
    
    Example:
        @cached(key_func=lambda tenant_id: f"tenant_meta:{tenant_id}", ttl=300)
        def get_tenant_metadata(tenant_id: str) -> dict:
            return expensive_db_query(tenant_id)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_cache()
            
            # Generate cache key
            cache_key = key_func(*args, **kwargs)
            
            # Try cache
            cached_value = cache.get(cache_key, ttl=ttl)
            if cached_value is not None:
                return cached_value
            
            # Cache miss - call function
            result = func(*args, **kwargs)
            
            # Store in cache
            if result is not None:
                cache.set(cache_key, result, ttl=ttl, skip_l1=skip_l1, skip_l2=skip_l2)
            
            return result
        
        return wrapper
    return decorator
