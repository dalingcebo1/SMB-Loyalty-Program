"""Vertical behavior dispatch layer.

Provides hook registration & dispatch for vertical-specific logic without
littering conditional branches across core code. Hooks are simple
function names (strings) mapped to callables. Each vertical plugin stub
registers implementations for relevant hooks.

Dispatch order preserves plugin registration order; first non-None
return value wins to allow fallbacks.
"""
from typing import Callable, Any, Dict, List, Optional

_HOOKS: Dict[str, List[Callable[..., Any]]] = {}

def register_hook(name: str, func: Callable[..., Any]):
    _HOOKS.setdefault(name, []).append(func)


def dispatch(name: str, *args, **kwargs) -> Optional[Any]:
    for func in _HOOKS.get(name, []):
        result = func(*args, **kwargs)
        if result is not None:
            return result
    return None

# Example hook names (documented for implementers):
# - compute_loyalty_earn(order) -> int
# - decorate_tenant_meta(meta: dict, tenant) -> None (in-place)
