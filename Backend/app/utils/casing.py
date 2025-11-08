from __future__ import annotations

"""Utilities for adding camelCase aliases to snake_case API payloads.

This allows us to introduce camelCase keys to clients incrementally while
preserving existing snake_case keys for backward compatibility.

Usage:
    response = {...}
    return add_camelcase_aliases(response)

The function will recursively walk dicts and lists, adding camelCase keys
alongside snake_case originals when:
  - The key contains an underscore, and
  - A camelCase variant does not already exist in the same mapping.

It does NOT mutate input in-place; it returns a new structure.
"""

from typing import Any, Dict, List


def _to_camel(s: str) -> str:
    parts = s.split("_")
    if len(parts) == 1:
        return s
    return parts[0] + "".join(p.capitalize() or "" for p in parts[1:])


def add_camelcase_aliases(data: Any) -> Any:
    """Return a deep-copied structure with camelCase alias keys added.

    Lists are traversed; primitive values are returned as-is. Dicts get new
    keys inserted (non-destructively) for camelCase forms of snake_case keys.
    """
    if isinstance(data, list):
        return [add_camelcase_aliases(item) for item in data]
    if isinstance(data, dict):
        new: Dict[str, Any] = {}
        # First copy & transform values
        for k, v in data.items():
            new[k] = add_camelcase_aliases(v)
        # Then add camelCase aliases
        additions: List[tuple[str, Any]] = []
        for k, v in list(new.items()):
            if "_" in k:
                camel = _to_camel(k)
                if camel not in new:
                    additions.append((camel, v))
        for k, v in additions:
            new[k] = v
        return new
    return data


__all__ = ["add_camelcase_aliases"]
