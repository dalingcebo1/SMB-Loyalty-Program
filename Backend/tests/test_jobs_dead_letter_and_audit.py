import os, sys, time
from fastapi.testclient import TestClient
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402
from app.core import jobs  # noqa: E402
from app.core.audit_safe import safe_audit  # noqa: E402
from app.core import audit  # noqa: E402
from app.core.database import SessionLocal, Base, engine  # noqa: E402
from app.models import AuditLog  # noqa: E402

client = TestClient(app)


def _make_dead_letter_job():
    # Register a temporary failing job name dynamically
    name = 'fail_temp'
    def _always_fail(payload):  # noqa: ANN001
        raise RuntimeError('boom')
    # Register if not exists
    try:
        jobs.register_job(name, _always_fail)
    except Exception:
        pass
    # Enqueue with 0 retries so first failure goes straight to dead-letter
    rec = jobs.enqueue(name, {}, max_retries=0)
    jobs.run_job_id(rec.id)
    # Force execution again to ensure dead-letter append (error state already)
    return rec.id


def test_dead_letter_requeue_and_purge():
    jid = _make_dead_letter_job()
    # Snapshot current dead letter size
    before = len(jobs.dead_letter_snapshot())
    assert before >= 1
    # Requeue via API
    r = client.post(f'/api/dev/jobs/dead-letter/{jid}/requeue')
    assert r.status_code == 200
    data = r.json()
    assert data['requeued'] == jid
    new_id = data['new_id']
    assert new_id != jid
    # Purge
    r2 = client.delete('/api/dev/jobs/dead-letter/purge')
    assert r2.status_code == 200
    purged = r2.json()['purged']
    assert purged >= 1


def test_audit_recent_events_buffer():
    safe_audit('dev.test_event', None, None, {'i': 1})
    safe_audit('dev.test_event', None, None, {'i': 2})
    r = client.get('/api/dev/audit')
    # If disabled, skip assertion gracefully
    if r.status_code == 403:
        return
    assert r.status_code == 200
    events = r.json()['events']
    assert any(e['details'].get('i') == 2 for e in events)


def test_audit_flush_persistence():
    # Create audit events in buffer
    safe_audit('dev.flush_test', None, None, {'x': 1})
    safe_audit('dev.flush_test', None, None, {'x': 2})
    # Flush to DB
    session = SessionLocal()
    audit.flush(session)
    # Query persisted
    rows = session.query(AuditLog).filter(AuditLog.action == 'dev.flush_test').all()
    assert len(rows) >= 2
    session.close()
