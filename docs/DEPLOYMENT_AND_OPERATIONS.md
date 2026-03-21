# Deployment & Operations Guide

## Azure Resource Inventory

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `SMB-Loyalty-Group` | All Azure resources |
| Dev Backend | `apismbloyaltyapp-dev` | Container App (dev) |
| Dev Frontend | `SMBstaticwebapp` | Static Web App (dev) |
| Prod Backend | `apismbloyaltyapp` | Container App (production) |
| Container Registry | `smblpcontainerregistry` | Docker image registry (ACR) |
| Database | Azure PostgreSQL Flexible Server | Primary datastore |
| Dev API URL | `https://dev-loyalty-backend.mangoplant-11c2323f.southafricanorth.azurecontainerapps.io` | Dev backend FQDN |
| Dev Frontend URL | `https://orange-pond-06eea490f.3.azurestaticapps.net` | Dev SWA URL |

---

## CI/CD Pipelines

### Workflow Overview

| Workflow file | Trigger | Action |
|--------------|---------|--------|
| `backend-ci.yml` | PR to any branch | Lint, type check, tests, coverage |
| `frontend-ci.yml` | PR to any branch | ESLint, Vitest, build check |
| `e2e-tests.yml` | PR / push | Cypress smoke tests |
| `backend-azure-containerapps-dev.yml` | Push to `develop`, `feature/**`, `test/**` | Build & deploy dev backend |
| `azure-static-web-apps-dev.yml` | Push to `develop`, `feature/**` | Build & deploy dev frontend |
| `backend-azure-containerapps.yml` | Push to `main` | Build & deploy prod backend |
| `azure-static-web-apps-*.yml` | Push to `main` | Build & deploy prod frontend |
| `release-backend.yml` | Version tag (`vX.Y.Z`) | Build & push GHCR image |
| `release-frontend.yml` | Version tag | Build & push GHCR image |
| `containerapp-configure-env.yml` | Manual dispatch | Update Container App env vars |
| `branch-cleanup.yml` | Weekly / manual | Detect and remove stale branches |

### CI Quality Gates

All PRs must pass:
- **Backend**: `ruff check` + `mypy` + `pytest --cov` ≥ 78% + migration drift check
- **Frontend**: `eslint` + `vitest` + TypeScript build
- **OpenAPI snapshot**: fails if public endpoints changed without updating `openapi_snapshot.json`

---

## Deployment Procedures

### Standard Flow (Dev)

1. Push feature branch (or `develop`).
2. `Deploy API (Azure Container Apps - Dev)` workflow runs automatically.
3. Verify dev backend health:
   ```bash
   RG="SMB-Loyalty-Group"
   APP_DEV="apismbloyaltyapp-dev"
   FQDN=$(az containerapp show -g "$RG" -n "$APP_DEV" --query "properties.configuration.ingress.fqdn" -o tsv)
   curl -ks -w "\n%{http_code}\n" "https://$FQDN/health/ready"
   curl -ks -w "\n%{http_code}\n" "https://$FQDN/api/public/tenant-meta"
   ```
4. Verify dev frontend at `https://orange-pond-06eea490f.3.azurestaticapps.net`.

### Standard Flow (Production)

1. Open PR: `develop` → `main`.
2. All CI checks must pass (required status checks).
3. Merge → production deploy workflows trigger automatically.
4. Run post-deploy smoke (see below).

### Manual Re-deploy (Without New Merge)

```bash
# Trigger backend deploy via workflow dispatch
gh workflow run backend-azure-containerapps.yml -f run_migrations=false
```

Or pin to a specific tag:
```bash
az containerapp update -g SMB-Loyalty-Group -n apismbloyaltyapp \
  --image smblpcontainerregistry.azurecr.io/smb-api:v1.2.3
```

---

## Release Process

### Pre-Release Checklist

```bash
# 1. Full strict gate (must all pass before tagging)
make strict
# Runs: ruff format check, ruff lint, mypy, pip-audit, migration drift, coverage ≥ 78%

# 2. OpenAPI diff (update snapshot if endpoints changed intentionally)
make openapi-diff
make snapshot-openapi   # then commit the updated snapshot
```

### Create Release Tag

```bash
git tag v1.2.3
git push origin v1.2.3
```

This triggers:
- `release-backend.yml` → pushes `ghcr.io/<owner>/smb-loyalty-backend:v1.2.3` and `:latest`
- `release-frontend.yml` → pushes `ghcr.io/<owner>/smb-loyalty-frontend:v1.2.3` and `:latest`

### Post-Deploy Smoke Test

Run after each deployment:

```bash
API=https://<fqdn>
curl -fsSL $API/health/ready
curl -fsSL $API/health/ready-lite
curl -fsSL $API/api/public/tenant-meta
```

Or use the automated smoke script:
```bash
chmod +x Backend/scripts/wait_revision_healthy.sh Backend/scripts/post_deploy_smoke.sh
./Backend/scripts/wait_revision_healthy.sh --api-base "$API" --timeout 600
API_BASE="$API" ./Backend/scripts/post_deploy_smoke.sh
```

The smoke script covers:
1. `/health/ready-lite` — process/container liveness
2. `/api/openapi.json` — routing and middleware chain
3. `/` — root route
4. `/api/public/tenant-meta` — database + tenant resolution

Exit codes 10–13 indicate which check failed for rapid triage.

### Versioning Semantics

| Bump | When |
|------|------|
| Patch | Bug fixes, backwards-compatible |
| Minor | New features, backwards-compatible |
| Major | Breaking changes (coordinate migrations, client updates) |

### RACI Matrix

| Activity | Dev | DevOps | QA |
|----------|-----|--------|----|
| Tag creation | R | C | C |
| CI pass gate | R | C | A |
| Secret rotation | C | R | I |
| Migration review | R | C | A |
| Smoke test | R | C | A |
| Rollback | C | R | I |

---

## Database Migrations

### Running Migrations

**Via Azure Portal Console** (Container App → Console):
```bash
cd /app
alembic -c alembic.ini upgrade head
python scripts/seed_tenant_domains.py
```

**Via Workflow Dispatch:**
1. Actions → "Deploy API (Azure Container Apps - Dev)"
2. Click "Run workflow"
3. Set `run_migrations: true`

**Via Azure CLI:**
```bash
az containerapp exec -g SMB-Loyalty-Group -n apismbloyaltyapp \
  --command "alembic -c alembic.ini upgrade head"
```

**Locally:**
```bash
make migrate
```

### Migration Guidelines

- Alembic is the **sole** source of truth — never call `Base.metadata.create_all` in production.
- Verify current revision: `alembic -c Backend/alembic.ini current`.
- Generate new migration after model changes: `alembic -c Backend/alembic.ini revision --autogenerate -m "description"`.
- Review autogenerated migration carefully before committing.
- Migrations are designed to be idempotent (safe to re-run in CI/containers).
- Prefer forward-fix migrations over downgrade to avoid data loss.

### Seeding

```bash
# Seed default tenant domains
python Backend/scripts/seed_tenant_domains.py

# Seed test users (dev only)
python Backend/seed_users.py
```

---

## Environment Variables

### Backend (Container App / `.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | SQLAlchemy connection string (PostgreSQL or SQLite) |
| `SECRET_KEY` | ✅ | App signing key (32+ chars) |
| `JWT_SECRET` | ✅ | JWT token signing |
| `RESET_SECRET` | ✅ | Password reset token signing |
| `ENVIRONMENT` | ✅ | `production` / `staging` / `local` |
| `DEFAULT_TENANT` | ✅ | Default tenant ID (e.g. `default`) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `FRONTEND_URL` | ✅ | Frontend base URL (fallback for CORS) |
| `YOCO_SECRET_KEY` | ✅ | Yoco payment API key |
| `YOCO_WEBHOOK_SECRET` | ✅ | Yoco webhook signature key |
| `FIREBASE_CREDENTIALS_JSON` | Optional | Firebase service account JSON |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | Path to Firebase credentials file |
| `SENTRY_DSN` | Optional | Sentry error tracking |
| `CSP_POLICY` | Optional | Content-Security-Policy header value |
| `ALLOW_DEFAULT_TENANT_FALLBACK_NON_PROD` | Dev only | Enable tenant fallback in non-prod |

> **Quote stripping:** The `Settings.normalise()` method automatically strips a single layer of surrounding quotes from `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_ORIGINS`, and `FRONTEND_URL`. This prevents deploy failures from accidentally quoted secrets in Azure.

> **CORS fallback:** If `ALLOWED_ORIGINS` is missing or set to `*`, the backend derives a safe origin from `FRONTEND_URL` and logs a warning instead of failing.

### Frontend (Vite env / Static Web Apps Variables)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_YOCO_PUBLIC_KEY` | Yoco public key |
| `VITE_FIREBASE_API_KEY` | Firebase Web SDK |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web SDK |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web SDK |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Web SDK |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web SDK |
| `VITE_FIREBASE_APP_ID` | Firebase Web SDK |
| `VITE_ENVIRONMENT` | `development` / `production` |

Set these in GitHub **Settings → Secrets and variables → Actions** as Repository Variables (preferred for non-secret values) or Secrets.

### Dev-Specific Secrets (GitHub)

| Secret | Purpose |
|--------|---------|
| `CA_DATABASE_URL_DEV` | Dev Postgres URL |
| `CA_ALLOWED_ORIGINS_DEV` | Dev CORS origins |
| `CA_FRONTEND_URL_DEV` | Dev frontend URL |
| `CA_JWT_SECRET_DEV` | Dev JWT secret |
| `CA_SECRET_KEY_DEV` | Dev app key |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | Dev SWA deploy token |
| `VITE_API_BASE_URL_DEV` | Dev API URL for frontend build |

The dev workflows resolve `*_DEV` values first, then fall back to shared production secrets.

---

## Local Development Databases

### SQLite (Default)

No setup needed. Set or omit `DATABASE_URL`:
```bash
# In Backend/.env.local:
# DATABASE_URL=sqlite:///./dev.db
```

### Local PostgreSQL

```bash
docker compose -f docker-compose.local-db.yml up -d
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/loyalty_local
make migrate
```

### Production Compose (Docker)

```bash
PUBLIC_API_BASE_URL=https://api.example.com \
  POSTGRES_USER=postgres \
  POSTGRES_PASSWORD=<secret> \
  POSTGRES_DB=loyalty_prod \
  BACKEND_TAG=v1.2.3 \
  FRONTEND_TAG=v1.2.3 \
  docker compose -f docker-compose.prod.yml up -d
```

Images must be published to GHCR first (via version tag workflow). Never commit production secrets.

---

## SSL/TLS Configuration

### Azure Container Apps

SSL is automatically managed for `*.azurecontainerapps.io` domains.

**Custom domain:**
1. Azure Portal → Container Apps → `apismbloyaltyapp-dev` → Custom domains
2. Add domain → verify ownership via CNAME/TXT DNS record
3. Azure provisions a managed certificate automatically

### Azure Static Web Apps

SSL is automatically managed.

**Custom domain:**
1. Azure Portal → Static Web Apps → `SMBstaticwebapp` → Custom domains
2. Add domain, follow DNS verification steps
3. Free managed certificate provisioned automatically

---

## Monitoring & Alerting

### Health Endpoints

```bash
GET /health/            # basic status
GET /health/detailed    # full system with DB and env checks
GET /health/ready       # Kubernetes readiness
GET /health/live        # Kubernetes liveness
GET /health/metrics     # application metrics
```

Example detailed response:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "environment": { "status": "healthy" },
    "resources": { "status": "healthy", "details": { "memory_percent": 75 } }
  }
}
```

### Recommended Azure Alerts

| Alert | Threshold |
|-------|-----------|
| Container Restarts | > 2 in 10 minutes |
| HTTP 5xx responses | > threshold per minute |
| CPU utilization | > 80% sustained |
| Memory utilization | > 85% |

### Sentry

Set `SENTRY_DSN` environment variable to enable error tracking. Tracing sample rate defaults to 0.1.

### Structured Logging

Production emits JSON logs. To preview locally:
```bash
ENVIRONMENT=production uvicorn main:app --port 8000
```

Emit application-level events via `logging.getLogger(__name__)` only for actionable events (not routine requests — those are covered by access log middleware).

---

## Rollback Procedures

### Application Rollback

```bash
# 1. Identify previous stable revision
az containerapp revision list -g SMB-Loyalty-Group -n apismbloyaltyapp -o table

# 2. Activate previous revision
az containerapp revision activate \
  -g SMB-Loyalty-Group -n apismbloyaltyapp --revision <revisionName>

# 3. Optionally deactivate bad revision
az containerapp revision deactivate \
  -g SMB-Loyalty-Group -n apismbloyaltyapp --revision <badRevisionName>
```

Or roll back to a known-good image tag:
```bash
az containerapp update -g SMB-Loyalty-Group -n apismbloyaltyapp \
  --image smblpcontainerregistry.azurecr.io/smb-api:<previous-tag>
```

### Database Rollback

Avoid Alembic downgrade unless absolutely necessary — prefer a forward-fix migration. If a rollback is unavoidable:
```bash
alembic -c Backend/alembic.ini downgrade <target_revision>
```

Then redeploy the matching application version.

---

## Operations Runbook

### Daily Operations

- Verify health endpoint returns 200
- Check application logs for elevated 5xx rates
- Monitor Sentry for new error classes

### Troubleshooting: 500 on `/api/public/tenant-meta`

1. `curl -i https://<host>/api/public/tenant-meta`
2. Exec into container: check `tenant_domains` and `tenants` tables exist and have data
3. Check logs for `"Startup: created missing default tenant"` (seeder ran on boot)
4. Validate `DEFAULT_TENANT` env var is set in Azure Container App

### Troubleshooting: Auth / 401 Errors

1. Verify `JWT_SECRET` env var is set and matches what was used to sign tokens
2. Check `ALLOWED_ORIGINS` includes the frontend domain (no trailing slash)
3. Review `FIREBASE_CREDENTIALS_JSON` is valid if social login fails

### Troubleshooting: Deploy Health Check Fails

The deploy workflow waits for the new revision to provision before probing health. If it still fails:
1. Check `az containerapp revision list` for revision status
2. Review Container App environment variables: `az containerapp show ... --query "properties.template.containers[0].env"`
3. Check for quote-wrapped secrets (quotes are stripped at startup, but malformed JSON is not)
4. Review startup logs in Azure Log Stream

### Quick Validation Script

```bash
RG=SMB-Loyalty-Group
APP=apismbloyaltyapp
FQDN=$(az containerapp show -g $RG -n $APP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

az containerapp show -g $RG -n $APP \
  --query "properties.template.containers[0].env[?name=='SECRET_KEY'||name=='ALLOWED_ORIGINS'||name=='DATABASE_URL']" \
  -o jsonc

curl -ks -w "\n%{http_code}\n" https://$FQDN/health/ready-lite
```

### Maintenance Schedule

| Frequency | Task |
|-----------|------|
| Daily | Health check validation, review 5xx logs |
| Weekly | Review Dependabot PRs, check stale branches |
| Monthly | Security audit (`pip-audit`), rotate secrets if needed |
| Quarterly | Performance baseline review, dependency major upgrades |

---

## Image Publishing

### Via Version Tag (Recommended)

```bash
git tag v1.2.3
git push origin v1.2.3
```

Publishes to GHCR:
- `ghcr.io/<owner>/smb-loyalty-backend:v1.2.3`
- `ghcr.io/<owner>/smb-loyalty-frontend:v1.2.3`
- `:latest` updated on both

### Manual Build & Push

```bash
# Requires: docker login ghcr.io
./Backend/scripts/build_push_backend.sh v1.2.3
./Backend/scripts/build_push_frontend.sh v1.2.3
```

### Local Docker Build

```bash
docker build -t loyalty-backend:local -f Backend/Dockerfile Backend
docker run -p 8000:8000 --env-file Backend/.env.local loyalty-backend:local
```

---

## Future Hardening Roadmap

- SBOM + provenance attestation (SLSA) for container images
- Automated OpenAPI diff comment on PRs
- Migrate secrets to Azure Key Vault (DAPR/KeyVault integration)
- Add `/health/version` endpoint exposing image SHA for traffic-split debugging
- Automated migration job container with canary health gate before full rollout
- Progressive tightening of mypy overrides (payments module pilot already done)
- Re-enable exception chaining rule B904 after converting broad `except` blocks
