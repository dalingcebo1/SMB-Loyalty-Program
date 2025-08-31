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
from typing import Dict, Tuple, Optional, Callable

# buckets[(scope, key)] = (tokens, last_refill_ts, capacity, refill_rate)
_BUCKETS: Dict[Tuple[str, str], Tuple[float, float, int, float]] = {}
_MAX_BUCKETS = 10_000  # safety cap

# Dynamic config overrides: scope -> (capacity, per_seconds)
_CONFIG: Dict[str, Tuple[int, float]] = {}

# Penalty tracking: ip -> strikes, and last event timestamp
_PENALTIES: Dict[str, Tuple[int, float]] = {}
_PENALTY_DECAY_SECONDS = 120  # after which strike decays
_PENALTY_MAX_STRIKES = 5
_PENALTY_TRIGGER_SCOPE = "ip_public_meta"

def set_limit(scope: str, capacity: int, per_seconds: float):
    _CONFIG[scope] = (capacity, per_seconds)

def get_limit(scope: str, default_capacity: int, default_per: float) -> Tuple[int, float]:
    cap, per = _CONFIG.get(scope, (default_capacity, default_per))
    return cap, per

def penalty_state():
    out = []
    now = time.time()
    for k, (strikes, ts) in list(_PENALTIES.items()):
        if now - ts > _PENALTY_DECAY_SECONDS:
            del _PENALTIES[k]
            continue
        out.append({"ip": k, "strikes": strikes, "age": round(now - ts, 1)})
    return out

def _refill(tokens: float, last: float, capacity: int, rate: float) -> float:
    now = time.time()
    if rate <= 0:
        return tokens
    tokens = min(capacity, tokens + (now - last) * rate)
    return tokens

def _apply_penalty_if_applicable(scope: str, key: str, capacity: int) -> int:
    if scope != _PENALTY_TRIGGER_SCOPE:
        return capacity
    # Adjust capacity based on strikes
    now = time.time()
    strikes, ts = _PENALTIES.get(key, (0, now))
    if now - ts > _PENALTY_DECAY_SECONDS:
        strikes = 0
    if strikes <= 0:
        return capacity
    # Reduce capacity multiplicatively but keep at least 1
    adjusted = max(1, int(capacity / (1 + strikes)))
    return adjusted

def record_penalty_hit(scope: str, key: str):
    if scope != _PENALTY_TRIGGER_SCOPE:
        return
    now = time.time()
    strikes, ts = _PENALTIES.get(key, (0, now))
    if now - ts > _PENALTY_DECAY_SECONDS:
        strikes = 0
    strikes = min(_PENALTY_MAX_STRIKES, strikes + 1)
    _PENALTIES[key] = (strikes, now)

def clear_penalty(scope: str, key: str):
    if scope != _PENALTY_TRIGGER_SCOPE:
        return
    if key in _PENALTIES:
        del _PENALTIES[key]

def check_rate(scope: str, key: str, capacity: int, per_seconds: float, *, dynamic: bool = True) -> bool:
    """Consume 1 token from bucket; return True if allowed else False.

    per_seconds: window defining refill speed; capacity tokens per given seconds.
    """
    if dynamic:
        capacity, per_seconds = get_limit(scope, capacity, per_seconds)
    # Apply penalty adjustments (read-only)
    capacity = _apply_penalty_if_applicable(scope, key, capacity)
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
        # Success clears penalty strikes for IP on public meta to allow recovery
        clear_penalty(scope, key)
        _BUCKETS[bucket_key] = (tokens, now, cap, r)
        return True
    else:
        _BUCKETS[bucket_key] = (tokens, now, cap, r)  # update last even if denied
        # Register penalty strike (only for configured scope)
        record_penalty_hit(scope, key)
        return False

def bucket_snapshot(limit: int = 1000, include_penalties: bool = True):
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
    snap = {"buckets": out}
    if include_penalties:
        snap["penalties"] = penalty_state()
    snap["overrides"] = {k: {"capacity": v[0], "per": v[1]} for k, v in _CONFIG.items()}
    return snap

def rate_limit_exempt():  # placeholder for future dynamic exemptions
    return False

def rate_limited(scope: str, capacity: int, per_seconds: float, key_func: Callable):
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
