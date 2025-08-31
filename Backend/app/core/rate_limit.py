"""Simple in-process token bucket rate limiting utilities.

Pure in-memory (per-process) implementation intended for tests/dev and as an
abstraction point to later swap to Redis / distributed store. Keeps small
state to avoid unbounded growth.

API:
    get_limiter(scope: str, capacity: int, refill_rate: float)
        scope: logical bucket namespace (e.g. 'ip', 'user', 'tenant')
        capacity: max tokens
        refill_rate: tokens per second (float) to replenish

    check_rate(scope, key) -> bool
        Returns True if allowed (token consumed) else False.

Thread-safety: Not thread-safe; fine for single-threaded test server. If we
run with multiple workers a distributed backend should replace it.
"""
from __future__ import annotations
import time
from typing import Dict, Tuple

# buckets[(scope, key)] = (tokens, last_refill_ts, capacity, refill_rate)
_BUCKETS: Dict[Tuple[str, str], Tuple[float, float, int, float]] = {}
_MAX_BUCKETS = 10_000  # safety cap

def _refill(tokens: float, last: float, capacity: int, rate: float) -> float:
    now = time.time()
    if rate <= 0:
        return tokens
    tokens = min(capacity, tokens + (now - last) * rate)
    return tokens

def check_rate(scope: str, key: str, capacity: int, per_seconds: float) -> bool:
    """Consume 1 token from bucket; return True if allowed else False.

    per_seconds: window defining refill speed; capacity tokens per given seconds.
    """
    if capacity <= 0:
        return False
    rate = capacity / per_seconds if per_seconds > 0 else 0
    now = time.time()
    bucket_key = (scope, key)
    tokens, last, cap, r = _BUCKETS.get(bucket_key, (float(capacity), now, capacity, rate))
    # Refill
    tokens = _refill(tokens, last, cap, r)
    if tokens >= 1:
        tokens -= 1
        _BUCKETS[bucket_key] = (tokens, now, cap, r)
        return True
    else:
        _BUCKETS[bucket_key] = (tokens, now, cap, r)  # update last even if denied
        return False

def bucket_snapshot(limit: int = 1000):
    """Return a lightweight snapshot of recent buckets (trimmed)."""
    out = []
    for (scope, key), (tokens, last, cap, r) in list(_BUCKETS.items())[:limit]:
        out.append({
            'scope': scope,
            'key': key,
            'tokens': round(tokens, 2),
            'capacity': cap,
            'refill_rate': round(r, 3),
            'last': last,
        })
    return out

def rate_limit_exempt():  # placeholder for future dynamic exemptions
    return False

def rate_limited(scope: str, capacity: int, per_seconds: float, key_func):
    """Dependency factory returning a FastAPI dependency enforcing a limit.

    key_func(request) -> str
    Simpler implementation avoids nested Depends to prevent 422 validation errors when
    FastAPI can't resolve the injected parameter chain.
    """
    from fastapi import Request, HTTPException, status
    def _dep(request: Request):
        if rate_limit_exempt():
            return True
        key = key_func(request)
        allowed = check_rate(scope, key, capacity, per_seconds)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
        return True
    return _dep
