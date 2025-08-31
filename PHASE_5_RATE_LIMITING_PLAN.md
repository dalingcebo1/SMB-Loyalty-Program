## Phase 5 Step 1: Rate Limiting & Abuse Protection

Implemented foundational in-process token bucket rate limiting to replace ad-hoc logic.

### Components Added
- `app/core/rate_limit.py`: Generic token bucket with FastAPI dependency factory `rate_limited`.
- Integrated IP-based rate limit for `/api/public/tenant-meta` (60 req / 60s) replacing legacy manual list.
- Developer probe endpoint `/api/dev/rl-test` (3 req / 60s) to validate limiter behavior.
- Observability endpoint `/api/obs/rate-limits` exposing current bucket snapshot.

### Tests
- `test_rate_limit.py::test_dev_rate_limit_basic` asserts 3 successes then 429.
- Public meta smoke test ensures endpoint still works under limiter.

### Next Hardening Steps (Future)
- Distinguish per-user vs per-tenant vs global scopes in config.
- Add exponential backoff / penalty buckets for repeated 429s.
- Redis backend for multi-process scaling.
- Configuration exposure & dynamic adjustment via dev/obs endpoints.

Proceeding next to Background Jobs & Async Processing after confirmation.

## Phase 5 Step 2: Background Jobs & Async Processing (In-Process Queue)

Implemented a minimal in-process job queue for dev/test:

### Components Added
- `app/core/jobs.py`: Registry, enqueue, run_next, run_job_id, snapshot, built-in `ping` + `fail` jobs.
- Dev endpoints (`/jobs`, `/jobs/enqueue`, `/jobs/run-next`, `/jobs/{id}/run`) restricted to developer role.
- Observability endpoint `/api/obs/jobs` exposing registered + recent job executions.

### Tests
- `tests/test_jobs.py` validates enqueue/run success path and failure capture.

### Design Notes
- Synchronous execution triggered by HTTP (no background worker thread yet) keeps behavior deterministic in tests.
- Thread lock ensures basic safety; history capped at 200 entries.
- Future: periodic scheduling, retry with backoff, persistence, async workers, distributed backend.

Next: consider per-user / per-tenant adaptive rate limits or penalty buckets (Step 3) before Redis integration.

## Phase 5 Step 3: Advanced Adaptive Limits & Job Reliability Enhancements

Implemented dynamic, adaptive rate limiting layers plus job retry / interval scheduling.

### Rate Limiting Enhancements
- Dynamic override configuration via `/api/dev/rate-limits/config` (GET/POST) allowing per-scope capacity + window changes at runtime.
- Penalty strike system: repeated 429s accrue strikes with decay (reset on sustained success) and capacity reduction multiplier applied transparently.
- Per-user & per-tenant composite scoping added (e.g., `user_tenant:{user_id}:{tenant}`) enforced in `secure_ping` endpoint.
- Bucket snapshot (`/api/obs/rate-limits`) now returns buckets, active penalties, and current overrides for observability.

### Job System Enhancements
- Retry with exponential backoff (base 100ms doubling per attempt) until `max_retries` exhausted.
- Interval scheduling: jobs with `interval_seconds` automatically re-queued after success using manual `tick` trigger (`/api/dev/jobs/tick`).
- Enhanced enqueue API to accept `max_retries` and `interval_seconds` fields.
- Snapshot de-duplication logic so recurring/retried jobs surface once with aggregated attempt count.

### Tests Added / Updated
- `tests/test_rate_limit_adv.py` covering:
	* Per-user/tenant override enforcement (custom small limit -> 429).
	* Penalty accumulation + decay scenario (multiple bursts vs cooldown).
	* Job retry attempts with backoff and interval re-scheduling behavior.
- Existing job & rate limit foundational tests remain green.

### Follow-Up Opportunities
- Persist overrides & penalties (e.g., Redis) for multi-process resilience.
- Global + per-endpoint configs loaded from DB / config service.
- Automatic penalty-based temporary bans (e.g., escalate after N strikes).
- Background worker thread to autonomously service `tick` for intervals/retries.
- Structured metrics export (Prometheus format) for buckets & job latency.

Phase 5 core objectives (adaptive protection + reliability scaffolding) now implemented in-process; future steps can focus on durability & distribution.
