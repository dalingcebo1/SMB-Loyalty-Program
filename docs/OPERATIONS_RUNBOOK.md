# Operations Runbook (Living Doc)

This document captures the authoritative operational process for the SMB Loyalty Program backend.

## 1. Deploy Flow (Golden Path)
1. Developer opens PR -> `backend-ci.yml` runs (lint, migrations, tests, coverage).
2. Merge to `main` -> auto CI re-run (fast); if green, trigger deploy workflow (manual or scheduled future automation).
3. Deploy workflow builds and pushes container, updates Azure Container App revision.
4. Post-deploy smoke:
   - GET /health/ready (expect 200 JSON)
   - GET /api/public/tenant-meta (expect 200 JSON with default tenant id)

## 2. Environment Variables (Canonical)
| Variable | Purpose | Notes |
|----------|---------|-------|
| DATABASE_URL | Primary SQLAlchemy URL | MUST point to existing DB (appdb). |
| DEFAULT_TENANT | Default tenant id (e.g. `default`) | Used by startup seeding. |
| ENVIRONMENT | `production` / `staging` / `local` | Drives safety behaviors. |
| CSP_POLICY | Optional security header config | Warning logged if missing in prod. |

Remove aliases like CA_DATABASE_URL once verified everywhere.

## 3. Database & Migrations
- Alembic is source of truth; production never calls `Base.metadata.create_all`.
- To check revision: `alembic -c Backend/alembic.ini current`.
- To upgrade: `alembic -c Backend/alembic.ini upgrade head`.
- Idempotent migrations: safe to re-run in ephemeral CI/container.

## 4. Default Tenant Seeding
Performed at every startup via `_ensure_default_tenant` in `Backend/main.py`:
- Inserts row only if absent.
- Prevents 500 on `/api/public/tenant-meta` for fresh DBs.

## 5. Troubleshooting 500 on /api/public/tenant-meta
Checklist:
1. Curl endpoint: `curl -i https://<host>/api/public/tenant-meta`.
2. If 500, exec into container and run `psql` -> ensure table & row exist.
3. Check logs for "Startup: created missing default tenant" (means seeder executed).
4. Validate `DEFAULT_TENANT` env var set in Azure.

## 6. Pipelines Policy
Keep only essential:
- `backend-ci.yml` (lint+migrate+test).
- `backend-deploy.yml` (deploy & smoke test) [TO ADD].
Disable/remove legacy duplicates: `backend-quality.yml`, `ci.yml`, extraneous var config workflows.

## 7. Smoke Test Script (Planned)
A small Python script will:
- GET /health/ready
- GET /api/public/tenant-meta
- Fail non-200 -> cause deploy rollback/manual intervention.

## 8. Rollback Procedure
1. List revisions: `az containerapp revision list -n <app> -g <rg>`.
2. Activate previous stable: `az containerapp revision activate -n <app> -g <rg> --revision <revName>`.
3. (Optional) Disable bad revision: `az containerapp revision deactivate ...`.

## 9. Security & Linting
- Ruff enforces style; temporary ignores: `E402`, `I001`, `B904` (will phase out after refactors).
- Coverage threshold: 78% (adjust upward after stabilization).

## 10. Future Hardening Backlog
- Re-enable exception chaining rule B904 after converting broad except blocks.
- Sort imports & drop I001 ignore.
- Add structured logging correlation id for public endpoints.
- Add pip-audit gate to nightly job instead of every PR.

## 11. Contact & Escalation
- Primary maintainer: (fill in)
- Pager / alert source: (fill in)

*Last updated: automated runbook creation.*
