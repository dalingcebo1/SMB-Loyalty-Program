from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models import AuditLog, User
import json, logging, time

def log_audit(
    db: Session,
    action: str,
    user: Optional[User] = None,
    tenant_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Persist an audit log entry.

    Args:
        db: Active SQLAlchemy session.
        action: Short action key (e.g. 'rate_limit.upsert').
        user: Optional user performing the action.
        tenant_id: Explicit tenant context if different / required.
        details: Optional JSON-serializable dict of additional fields.
    Returns:
        The created AuditLog instance.
    """
    entry = AuditLog(
        tenant_id=tenant_id or getattr(user, 'tenant_id', None),
        user_id=getattr(user, 'id', None),
        action=action,
        created_at=datetime.utcnow(),
        details=details or {},
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return entry
"""Lightweight audit logging helper.

Writes are buffered in-memory and flushed synchronously on demand to keep
initial implementation simple without introducing external queue.
Future: replace with background task or Kafka sink.
"""
from collections import deque
from typing import Deque, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import AuditLog

_BUFFER: Deque[Dict[str, Any]] = deque(maxlen=1000)

def record(action: str, tenant_id: str | None = None, user_id: int | None = None, details: dict | None = None):
    _BUFFER.append({
        'action': action,
        'tenant_id': tenant_id,
        'user_id': user_id,
        'details': details or {},
        'created_at': datetime.utcnow(),
    })

def flush(db: Session):
    while _BUFFER:
        evt = _BUFFER.popleft()
        db.add(AuditLog(**evt))
    db.commit()

def recent(limit: int = 100) -> List[dict]:
    """Return a snapshot of buffered (not yet flushed) audit events (newest first)."""
    items = list(_BUFFER)
    items.sort(key=lambda e: e['created_at'], reverse=True)
    out = []
    for e in items[:limit]:
        d = dict(e)
        d['created_at'] = d['created_at'].isoformat() + 'Z'
        out.append(d)
    return out

# ---------------------------------------------------------------------------
# Structured JSON audit logger (non-persistent) for SIEM / streaming usage.
# Does not persist to DB; complementary to persistent log above.
# ---------------------------------------------------------------------------
_audit_logger = logging.getLogger("audit")
_RESERVED = {"ts", "event", "actor", "ip", "meta"}

def log_audit_event(event: str, *, user_id: int | str | None = None, tenant_id: str | None = None,
                    ip: str | None = None, meta: Dict[str, Any] | None = None, **extra: Any) -> None:
    rec: Dict[str, Any] = {"ts": round(time.time(), 6), "event": event}
    actor: Dict[str, Any] = {}
    if user_id is not None:
        actor["user_id"] = user_id
    if tenant_id is not None:
        actor["tenant_id"] = tenant_id
    if actor:
        rec["actor"] = actor
    if ip:
        rec["ip"] = ip
    if meta:
        rec["meta"] = meta
    for k, v in extra.items():
        if k in _RESERVED:
            continue
        rec.setdefault("meta", {})[k] = v
    try:
        _audit_logger.info(json.dumps(rec, sort_keys=True))
    except Exception:  # pragma: no cover
        _audit_logger.warning(f"audit_event_failed event={event}")
