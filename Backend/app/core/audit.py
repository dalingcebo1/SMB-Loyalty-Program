"""Lightweight audit logging helper.

Writes are buffered in-memory and flushed synchronously on demand to keep
initial implementation simple without introducing external queue.
Future: replace with background task or Kafka sink.
"""
from collections import deque
from typing import Deque, Dict, Any
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
