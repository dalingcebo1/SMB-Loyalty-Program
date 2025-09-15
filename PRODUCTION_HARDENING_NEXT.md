# Production Hardening: Next Steps

This list captures pragmatic improvements to move from MVP-ready to resilient, scalable production posture.

## 1. Infrastructure as Code (IaC)
- Populate existing placeholder Bicep/Terraform files with definitions for: ACR, Container App, Postgres Flexible Server, Log Analytics, Storage (static web), Front Door / CDN.
- Add environment parameterization (dev/staging/prod) with naming conventions.
- Integrate IaC validation (terraform validate / bicep build) into CI.

## 2. Secrets & Config Management
- Migrate secrets to Azure Key Vault; grant Container App managed identity access (remove plain env var secrets from workflow inputs).
- Implement secret rotation schedule & automation workflow (quarterly rotate JWT/RESET/APP secrets, payment keys on policy cycle).
- Add checksum / reference for static configuration (e.g., CSP policy) to detect drift.

## 3. Observability & Alerting
- Structured JSON logs already present: ship to centralized sink (Azure Monitor, Elastic, or Loki + Grafana).
- Define SLOs: availability (99.9%), latency (p95 < 500ms), error budget policy.
- Alerts:
  - Health endpoint failure > 2 consecutive checks.
  - 5xx rate > 2% over 5m.
  - Spike in 429 (could indicate abuse / misconfigured clients).
  - DB connection errors sustained > 1m.
- Add custom metrics endpoint (Prometheus format) exporting rate limit bucket stats, job queue counts.

## 4. Database Reliability
- Automated daily logical backups (pg_dump) stored in geo-redundant storage.
- Weekly PITR verification (restore test) procedure documented.
- Connection pooling (e.g., PgBouncer) if concurrency grows.
- Migration guardrail: pre-deploy dry-run against staging copy.

## 5. Security Enhancements
- Content Security Policy: move from optional to enforced baseline (default-src 'self'; frame-ancestors 'none'; object-src 'none').
- Add dependency & container scanning gates (Trivy already for backend; add frontend + SBOM scan (Syft)).
- Enable automated Dependabot / Renovate for dependency updates.
- Implement rate limit penalty escalation to temporary bans and lockout metrics.
- WAF (Front Door) rules: block common exploit patterns, enforce geo restrictions if business scope limited.

## 6. Performance & Scaling
- Implement Redis-backed rate limiting (replace in-process for multi-replica accuracy).
- Cache layer for frequently accessed tenant metadata (Redis with short TTL rather than DB hits).
- Load test baseline scenarios (RPS ramp, spike, sustained) and document scaling thresholds.
- Introduce horizontal pod autoscaling style rules (HTTP concurrency + CPU) with canary release support.

## 7. Background Processing & Scheduling
- External job runner / queue (Azure Queue + worker, or Celery/RQ with Redis) for webhooks, billing retries, email dispatch.
- Scheduled tasks: trial expiration sweeper, subscription renewal health audit.
- Dead letter queue for failed jobs with alerting.

## 8. Data & Multi-Tenancy Safeguards
- Row-level access tests: add automated integration test ensuring tenant isolation for each critical model.
- Add tenancy context correlation ID in all audit log entries.
- Optional encryption-at-rest for sensitive fields (PII) using application-level envelope encryption.

## 9. Deployment Safety
- Blue/green or canary deployment strategy (separate Container App revision) before 100% traffic shift.
- Pre-traffic smoke hook automatically invoking `post-deploy-smoke` workflow.
- Rollback automation script referencing last 3 successful SHAs.

## 10. Frontend Alignment
- Implement feature flag hydration endpoint & early gating for experimental features.
- Add real-time build integrity hash (subresource integrity) for script tags if served via own origin.
- Perf budgets in CI (bundle size threshold, Lighthouse score gate).

## 11. Compliance & Logging
- Audit log export to immutable storage (append-only) monthly.
- PII minimization review – ensure no sensitive data in logs or metrics.
- Data retention policy (e.g., purge inactive tenant data after X months with legal/compliance sign-off).

## 12. Documentation Upgrades
- Add runbook for on-call: incident severity levels, escalation tree, first 5 actions for common failures.
- DR plan: RPO/RTO targets, recovery sequence (ACR -> DB restore -> app config restore -> smoke validation).

## 13. Cost Optimization (Later Stage)
- Monitor Container App CPU throttling & memory headroom for right-sizing.
- Spot instance evaluation for non-critical batch jobs.
- Lifecycle rules for log retention & backup pruning.

## 14. Risk Register (Top Pending)
| Risk | Impact | Mitigation |
|------|--------|-----------|
| In-process rate limiting with multiple replicas | Inaccurate throttling | Redis token bucket backend |
| Single AZ Postgres | Outage risk | Enable zone redundant or HA standby |
| Manual migration execution | Human error | Automated migration job with idempotent checks |
| No auto rollback | Prolonged incident | Canary + health gate + scripted revert |
| Secret sprawl in GH Secrets | Leakage surface | Key Vault + MI integration |

---
Prioritize top 5: Redis rate limiting, Key Vault integration, automated migrations, observability alerts, SLO definition.
