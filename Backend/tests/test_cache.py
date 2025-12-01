"""
Tests for multi-layer caching system.

Tests cache functionality including:
- In-memory cache (L1)
- Redis cache (L2)
- Cache invalidation
- TTL expiration
- Cache decorators
"""

import pytest
import time
from app.core.cache import (
    InMemoryCache,
    CacheLayer,
    CacheConfig,
    initialize_cache,
    get_cache,
    cached,
)


class TestInMemoryCache:
    """Test L1 (in-memory) cache functionality."""
    
    def test_set_and_get(self):
        """Test basic set/get operations."""
        cache = InMemoryCache()
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
    
    def test_get_nonexistent(self):
        """Test getting non-existent key returns None."""
        cache = InMemoryCache()
        assert cache.get("nonexistent") is None
    
    def test_ttl_expiration(self):
        """Test that keys expire after TTL."""
        cache = InMemoryCache()
        
        # Set with 1-second TTL
        cache.set("expiring_key", "value", ttl=1)
        assert cache.get("expiring_key") == "value"
        
        # Wait for expiration
        time.sleep(1.1)
        assert cache.get("expiring_key") is None
    
    def test_delete(self):
        """Test deleting keys."""
        cache = InMemoryCache()
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        cache.delete("key1")
        assert cache.get("key1") is None
    
    def test_clear(self):
        """Test clearing entire cache."""
        cache = InMemoryCache()
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        assert cache.size() == 2
        
        cache.clear()
        assert cache.size() == 0
        assert cache.get("key1") is None
    
    def test_lru_eviction(self):
        """Test LRU eviction when cache is full."""
        cache = InMemoryCache(max_size=3)
        
        # Fill cache
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        assert cache.size() == 3
        
        # Add one more - should evict oldest (key1)
        cache.set("key4", "value4")
        assert cache.size() == 3
        assert cache.get("key1") is None  # Evicted
        assert cache.get("key2") == "value2"
        assert cache.get("key3") == "value3"
        assert cache.get("key4") == "value4"
    
    def test_lru_access_order(self):
        """Test that accessing keys updates LRU order."""
        cache = InMemoryCache(max_size=3)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        
        # Access key1 to make it most recently used
        cache.get("key1")
        
        # Add new key - should evict key2 (oldest accessed)
        cache.set("key4", "value4")
        assert cache.get("key1") == "value1"  # Still present
        assert cache.get("key2") is None  # Evicted
        assert cache.get("key3") == "value3"
        assert cache.get("key4") == "value4"


class TestCacheLayer:
    """Test multi-layer cache functionality."""
    
    def test_initialization_without_redis(self):
        """Test cache initializes without Redis."""
        cache = CacheLayer(redis_url=None)
        assert not cache.redis_available
    
    def test_set_and_get_memory_only(self):
        """Test cache works with memory only (no Redis)."""
        cache = CacheLayer(redis_url=None)
        
        cache.set("test_key", {"data": "value"}, ttl=60)
        result = cache.get("test_key")
        
        assert result == {"data": "value"}
    
    def test_delete(self):
        """Test deleting from cache."""
        cache = CacheLayer(redis_url=None)
        
        cache.set("test_key", "value")
        assert cache.get("test_key") == "value"
        
        cache.delete("test_key")
        assert cache.get("test_key") is None
    
    def test_skip_l1(self):
        """Test skipping L1 cache."""
        cache = CacheLayer(redis_url=None)
        
        cache.set("test_key", "value", skip_l1=True)
        
        # L1 should not have the value
        assert cache._memory_cache.get("test_key") is None
    
    def test_get_stats(self):
        """Test getting cache statistics."""
        cache = CacheLayer(redis_url=None)
        
        stats = cache.get_stats()
        assert "l1_size" in stats
        assert "l1_max_size" in stats
        assert "redis_available" in stats
        assert stats["redis_available"] is False


class TestCacheIntegration:
    """Integration tests for caching system."""
    
    def test_initialize_and_get_cache(self):
        """Test initializing and retrieving global cache."""
        cache = initialize_cache(redis_url=None)
        assert cache is not None
        
        retrieved_cache = get_cache()
        assert retrieved_cache is cache
    
    def test_cached_decorator(self):
        """Test @cached decorator."""
        initialize_cache(redis_url=None)
        
        call_count = {"count": 0}
        
        @cached(key_func=lambda x: f"test:{x}", ttl=60)
        def expensive_function(value: str) -> str:
            call_count["count"] += 1
            return f"result_{value}"
        
        # First call - cache miss
        result1 = expensive_function("abc")
        assert result1 == "result_abc"
        assert call_count["count"] == 1
        
        # Second call - cache hit
        result2 = expensive_function("abc")
        assert result2 == "result_abc"
        assert call_count["count"] == 1  # Not called again
        
        # Different argument - cache miss
        result3 = expensive_function("xyz")
        assert result3 == "result_xyz"
        assert call_count["count"] == 2
    
    def test_cached_decorator_with_none_result(self):
        """Test @cached decorator doesn't cache None results."""
        initialize_cache(redis_url=None)
        
        call_count = {"count": 0}
        
        @cached(key_func=lambda: "test:none", ttl=60)
        def returns_none():
            call_count["count"] += 1
            return None
        
        # First call
        result1 = returns_none()
        assert result1 is None
        assert call_count["count"] == 1
        
        # Second call - should call again (None not cached)
        result2 = returns_none()
        assert result2 is None
        assert call_count["count"] == 2


class TestCacheConfig:
    """Test cache configuration."""
    
    def test_ttl_constants(self):
        """Test TTL constants are reasonable."""
        assert CacheConfig.TENANT_META_TTL == 300  # 5 minutes
        assert CacheConfig.TENANT_BRANDING_TTL == 600  # 10 minutes
        assert CacheConfig.VERTICAL_REGISTRY_TTL == 3600  # 1 hour
    
    def test_key_prefixes(self):
        """Test cache key prefixes are defined."""
        assert CacheConfig.TENANT_META_PREFIX == "tenant_meta"
        assert CacheConfig.TENANT_BRANDING_PREFIX == "tenant_branding"
        assert CacheConfig.VERTICAL_REGISTRY_PREFIX == "vertical_registry"


class TestCacheEdgeCases:
    """Test edge cases and error handling."""
    
    def test_json_serialization_error(self):
        """Test handling of non-JSON-serializable data."""
        cache = CacheLayer(redis_url=None)
        
        # Set with complex object (should work in L1, might fail in L2 with Redis)
        class NonSerializable:
            pass
        
        obj = NonSerializable()
        cache.set("test_key", obj, skip_l2=True)
        
        # Should retrieve from L1
        result = cache.get("test_key")
        assert result is obj
    
    def test_cache_miss_returns_none(self):
        """Test cache miss returns None consistently."""
        cache = CacheLayer(redis_url=None)
        
        result = cache.get("nonexistent_key")
        assert result is None
    
    def test_empty_string_key(self):
        """Test handling of empty string as key."""
        cache = CacheLayer(redis_url=None)
        
        cache.set("", "value")
        result = cache.get("")
        assert result == "value"
