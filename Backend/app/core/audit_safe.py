"""Fail-safe audit logging wrapper.

Used by dev / dangerous routes so that absence or failure of a real audit
system never breaks the primary operation.
"""
from __future__ import annotations
from typing import Optional, Dict, Any

try:  # attempt to import a real audit recorder if it exists
    from app.core import audit  # type: ignore
except Exception:  # pragma: no cover
    audit = None  # type: ignore


def safe_audit(action: str, actor_user_id: Optional[str], tenant_id: Optional[str], details: Dict[str, Any]) -> None:
    """Record an audit event using current in-memory audit buffer (non-fatal)."""
    if not audit:
        return
    try:  # pragma: no cover - defensive only
        if hasattr(audit, "record"):
            audit.record(action=action, tenant_id=tenant_id, user_id=actor_user_id, details=details)  # type: ignore[arg-type]
    except Exception:
        return

def safe_recent_audit(limit: int = 100):
    if not audit:
        return []
    try:
        if hasattr(audit, "recent"):
            return audit.recent(limit=limit)  # type: ignore[attr-defined]
    except Exception:
        return []
    return []
