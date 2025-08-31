"""Lightweight in-process background job queue (synchronous executor).

Designed for dev/test environments to exercise background processing patterns
without introducing external infra. Jobs are executed synchronously when
triggered via explicit run endpoints (no autonomous worker thread yet).

Future extensions (not implemented yet):
- Periodic scheduling
- Persistence (DB) of job history
- Async / thread worker pool
- Distributed queue backend
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Callable, Any, Dict, Deque, Optional, List
from collections import deque
import time, uuid, threading, traceback

@dataclass
class JobRecord:
    id: str
    name: str
    status: str  # queued|running|success|error
    enqueued_at: float
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    result: Any = None
    error: Optional[str] = None
    attempts: int = 0
    payload: Optional[dict] = None

_registry: Dict[str, Callable[[Optional[dict]], Any]] = {}
_jobs: Dict[str, JobRecord] = {}
_queue: Deque[str] = deque()
_lock = threading.Lock()
_MAX_HISTORY = 200  # simple cap; stale jobs pruned FIFO
_history: Deque[str] = deque(maxlen=_MAX_HISTORY)

class JobAlreadyRegistered(Exception):
    pass

class UnknownJob(Exception):
    pass

def register_job(name: str, func: Callable[[Optional[dict]], Any]):
    with _lock:
        if name in _registry:
            raise JobAlreadyRegistered(name)
        _registry[name] = func

# Built-in sample jobs -------------------------------------------------------

def _job_ping(payload: Optional[dict]):
    """Return a simple heartbeat payload (echo)."""
    time.sleep(0.01)
    return {"ok": True, "echo": payload or {}}

def _job_fail(payload: Optional[dict]):  # pragma: no cover (covered via test run)
    raise RuntimeError(payload.get("message", "forced failure"))

# Register built-ins
register_job("ping", _job_ping)
register_job("fail", _job_fail)

# Core queue operations ------------------------------------------------------

def enqueue(name: str, payload: Optional[dict] = None) -> JobRecord:
    with _lock:
        if name not in _registry:
            raise UnknownJob(name)
        jid = uuid.uuid4().hex[:12]
        rec = JobRecord(id=jid, name=name, status="queued", enqueued_at=time.time(), payload=payload)
        _jobs[jid] = rec
        _queue.append(jid)
        return rec

def _execute(rec: JobRecord):
    func = _registry[rec.name]
    rec.status = "running"
    rec.started_at = time.time()
    rec.attempts += 1
    try:
        rec.result = func(rec.payload)
        rec.status = "success"
    except Exception as e:  # capture stack
        tb = traceback.format_exc(limit=5)
        rec.error = f"{e.__class__.__name__}: {e}; {tb.splitlines()[-1]}"
        rec.status = "error"
    finally:
        rec.finished_at = time.time()
        _history.append(rec.id)


def run_next() -> Optional[JobRecord]:
    with _lock:
        if not _queue:
            return None
        jid = _queue.popleft()
        rec = _jobs.get(jid)
    if rec:  # execute outside lock
        _execute(rec)
    return rec

def run_job_id(job_id: str) -> Optional[JobRecord]:
    with _lock:
        rec = _jobs.get(job_id)
        # If queued remove from queue to avoid double execution
        if not rec:
            return None
        if rec.status == "queued":
            try:
                _queue.remove(job_id)
            except ValueError:
                pass
    if rec and rec.status == "queued":
        _execute(rec)
    return rec

# Introspection --------------------------------------------------------------

def job_snapshot(limit: int = 50) -> List[dict]:
    with _lock:
        # history has executed jobs (success/error). Include queued tail as well.
        ids: List[str] = list(_history)[-limit:]
        # Add queued jobs not yet run (order preserved by queue)
        for qid in list(_queue):
            if qid not in ids:
                ids.append(qid)
        out = []
        for jid in ids[-limit:]:
            rec = _jobs.get(jid)
            if not rec:
                continue
            d = asdict(rec)
            # Convert timestamps to ms for readability
            for k in ("enqueued_at", "started_at", "finished_at"):
                if d.get(k):
                    d[k] = round(d[k] * 1000)
            out.append(d)
        return out

def registered_jobs() -> List[str]:
    with _lock:
        return sorted(_registry.keys())
