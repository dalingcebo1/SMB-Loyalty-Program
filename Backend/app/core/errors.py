"""Error response helpers to keep a consistent schema.

Schema convention: {"error": <code>, "detail": <human readable>, ...extra fields}
"""
from typing import Any, Dict

def err(code: str, detail: str, **extra: Any) -> Dict[str, Any]:
    out = {"error": code, "detail": detail}
    out.update(extra)
    return out
