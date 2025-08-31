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
from typing import Callable, Any, Dict, Deque, Optional, List, Tuple
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
    max_retries: int = 0
    interval_seconds: Optional[float] = None  # if set, auto re-enqueue after success
    next_run: Optional[float] = None

_registry: Dict[str, Callable[[Optional[dict]], Any]] = {}
_jobs: Dict[str, JobRecord] = {}
_queue: Deque[str] = deque()
_DEAD_LETTER: Deque[str] = deque(maxlen=100)
_overflow_rejections = 0
_MAX_QUEUE = 500
_lock = threading.Lock()
_MAX_HISTORY = 200  # simple cap; stale jobs pruned FIFO
_history: Deque[str] = deque(maxlen=_MAX_HISTORY)
_scheduled: Dict[str, JobRecord] = {}

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

def enqueue(name: str, payload: Optional[dict] = None, *, max_retries: int = 0, interval: Optional[float] = None) -> JobRecord:
    with _lock:
        if name not in _registry:
            raise UnknownJob(name)
        global _overflow_rejections
        if len(_queue) >= _MAX_QUEUE:
            _overflow_rejections += 1
            raise RuntimeError("queue_overflow")
        jid = uuid.uuid4().hex[:12]
    rec = JobRecord(id=jid, name=name, status="queued", enqueued_at=time.time(), payload=payload, max_retries=max_retries, interval_seconds=interval)
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
    # Retry logic
    if rec.status == "error" and rec.attempts <= rec.max_retries:
        # exponential backoff: base 0.1s * 2^(attempts-1)
        delay = 0.1 * (2 ** (rec.attempts - 1))
        rec.next_run = time.time() + delay
        with _lock:
            _scheduled[rec.id] = rec
    # Interval re-scheduling
    elif rec.status == "success" and rec.interval_seconds:
        rec.next_run = time.time() + rec.interval_seconds
        with _lock:
            _scheduled[rec.id] = rec
    # Exhausted retries -> dead letter
    if rec.status == "error" and rec.attempts > rec.max_retries:
        with _lock:
            _DEAD_LETTER.append(rec.id)


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
        # History has executed job ids (may contain duplicates for retries / intervals)
        ids: List[str] = list(_history)
        # Add queued jobs not yet executed (avoid duplicates at append time)
        for qid in list(_queue):
            ids.append(qid)
        # Deduplicate keeping ONLY the latest occurrence of each job id.
        # Iterate reversed so first time we see an id is the most recent execution state.
        seen = set()
        dedup_reversed: List[str] = []
        for jid in reversed(ids):
            if jid in seen:
                continue
            seen.add(jid)
            dedup_reversed.append(jid)
        # Restore chronological order (oldest -> newest) while retaining latest state only.
        unique_ids = list(reversed(dedup_reversed))[-limit:]
        out: List[dict] = []
        for jid in unique_ids:
            rec = _jobs.get(jid)
            if not rec:
                continue
            d = asdict(rec)
            for k in ("enqueued_at", "started_at", "finished_at"):
                if d.get(k):
                    d[k] = round(d[k] * 1000)
            out.append(d)
        return out

def dead_letter_snapshot() -> List[dict]:
    with _lock:
        ids = list(_DEAD_LETTER)
    out: List[dict] = []
    for jid in ids:
        rec = _jobs.get(jid)
        if not rec:
            continue
        d = asdict(rec)
        for k in ("enqueued_at", "started_at", "finished_at"):
            if d.get(k):
                d[k] = round(d[k] * 1000)
        out.append(d)
    return out

def queue_metrics():
    with _lock:
        return {
            "queued": len(_queue),
            "scheduled": len(_scheduled),
            "dead_letter": len(_DEAD_LETTER),
            "overflow_rejections": _overflow_rejections,
            "history": len(_history),
            "max_queue": _MAX_QUEUE,
        }

def registered_jobs() -> List[str]:
    with _lock:
        return sorted(_registry.keys())

def tick():
    """Trigger execution of any due scheduled jobs (retry or interval)."""
    due: List[JobRecord] = []
    now = time.time()
    with _lock:
        for jid, rec in list(_scheduled.items()):
            if rec.next_run and rec.next_run <= now:
                due.append(rec)
                rec.status = "queued"
                rec.enqueued_at = time.time()
                _queue.append(rec.id)
                del _scheduled[jid]
    # Execute as normal via run_next loop semantics
    while True:
        executed = run_next()
        if not executed:
            break
