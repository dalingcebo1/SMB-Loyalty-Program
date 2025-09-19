from fastapi import APIRouter, Depends

from app.plugins.auth.routes import require_capability
from app.core import jobs


# Observability endpoints (read-only) for job queue metrics/snapshots.
# Secured by capability so developers and admins can access (jobs.view).
router = APIRouter(prefix="/obs", tags=["observability"], dependencies=[Depends(require_capability('jobs.view'))])


@router.get("/jobs")
def get_jobs_snapshot():
    """Return current job system snapshot.

    Matches the shape returned by the dev jobs listing for consistency:
      - registered: mapping of job names -> metadata
      - recent: recent job execution records
      - dead_letter: failed jobs parked for manual handling
      - queue: simple queue metrics (lengths, etc.)
    """
    recent = jobs.job_snapshot()
    # Debug: log a small sample to understand state during tests
    try:
        import logging as _logging
        sample = [{"id": j.get("id"), "status": j.get("status")} for j in recent[-3:]]
        _logging.getLogger("access").info("OBS_ROUTES get_jobs recent=%s sample=%s", len(recent), sample)
    except Exception:
        pass
    return {
        "registered": jobs.registered_jobs(),
        "recent": recent,
        "dead_letter": jobs.dead_letter_snapshot(),
        "queue": jobs.queue_metrics(),
    }
