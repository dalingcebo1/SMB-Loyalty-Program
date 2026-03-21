# CI/CD Workflows

This repository deploys on Azure with separate dev and production environments.

## Workflow Naming Convention

All workflows follow a consistent naming pattern:
- `{component}-{action}-{environment}.yml`
- Examples: `backend-deploy-prod.yml`, `frontend-deploy-dev.yml`, `backend-ci.yml`

## Overview

### CI (Quality Gates)

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `backend-ci.yml` | Lint (ruff), type-check (mypy), tests, coverage | Push/PR to `Backend/**` |
| `frontend-ci.yml` | Install, test, build | Push/PR to `Frontend/**` |
| `e2e-tests.yml` | Cypress E2E tests against ephemeral stack | Push/PR to `main` |

### Deployment - Dev

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `backend-deploy-dev.yml` | Deploy backend to Azure Container Apps (dev) | Push to `develop`/`feature/**`/`test/**` |
| `frontend-deploy-dev.yml` | Deploy frontend to Azure Static Web Apps (dev) | Push to `develop`/`feature/**`/`test/**` |

### Deployment - Production

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `backend-deploy-prod.yml` | Deploy backend to Azure Container Apps (prod) | Push to `main` |
| `frontend-deploy-prod.yml` | Deploy frontend to Azure Static Web Apps (prod) | Push to `main` |

### Operations (Manual)

| Workflow | Purpose |
|----------|---------|
| `backend-migrate.yml` | Run Alembic migrations (supports dev/prod selection) |
| `backend-db-bootstrap.yml` | Bootstrap database and run migrations (supports dev/prod) |

### Security

| Workflow | Purpose |
|----------|---------|
| `codeql.yml` | SAST (Static Application Security Testing) |
| `secret-scan.yml` | Secret detection in commits |

## Environment Selection

The migration and bootstrap workflows now support environment selection:

```yaml
inputs:
  environment:
    type: choice
    options:
      - dev   # Uses apismbloyaltyapp-dev
      - prod  # Uses apismbloyaltyapp
  containerapp_name:
    description: "Override Container App name (optional)"
    default: ""  # If provided, overrides environment-based naming
```

**Note:** If you provide a custom `containerapp_name`, it will be used regardless of the environment selection. Leave it empty to use the environment-based defaults.

## Ringfenced Health Strategy

Health checks run from inside the Container App using `az containerapp exec` to curl `http://localhost:8000/health/ready-lite`. This avoids hitting the public ingress when the backend is ringfenced.

External smoke tests run only when `CA_PUBLIC_API_URL` secret is configured.

## Action Version Standards

All workflows use these standardized versions:
- `actions/checkout@v4`
- `actions/setup-python@v5`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `azure/login@v2`
- Node.js: 20 (LTS)
- Python: 3.11

## Removed Workflows

These workflows have been removed during cleanup:
- `ci.yml` - Duplicate of `backend-ci.yml`
- `deploy.yml` - Legacy AWS deployment (we use Azure only)
- `azure-static-web-apps-dev.yml` - Consolidated into `frontend-deploy-dev.yml`
- `azure-static-web-apps-orange-pond-*.yml` - Consolidated into `frontend-deploy-dev.yml`

## Secrets & Variables

### Backend (Container Apps)

Secrets follow this priority order: `CA_*_DEV` → `*_DEV` → `CA_*` → `*`

| Secret | Purpose |
|--------|---------|
| `CA_DATABASE_URL` / `CA_DATABASE_URL_DEV` | PostgreSQL connection string |
| `CA_JWT_SECRET` / `CA_JWT_SECRET_DEV` | JWT signing key |
| `CA_SECRET_KEY` / `CA_SECRET_KEY_DEV` | App secret key |
| `CA_ALLOWED_ORIGINS` / `CA_ALLOWED_ORIGINS_DEV` | CORS origins |

### Frontend (Static Web Apps)

| Variable/Secret | Purpose |
|-----------------|---------|
| `VITE_API_BASE_URL` / `VITE_API_BASE_URL_DEV` | API base URL |
| `VITE_FIREBASE_*` / `VITE_FIREBASE_*_DEV` | Firebase config |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_*` | SWA deployment tokens |

## Contributor Tips

1. **Backend tests** use Postgres in CI. Run migrations locally before pushing:
   ```bash
   alembic -c Backend/alembic.ini upgrade head
   ```

2. **Frontend builds** use Node 20 and npm. Keep `package-lock.json` updated.

3. **Releases**: Tag with `vX.Y.Z` to publish images to GHCR.

4. **E2E tests** run headlessly with `xvfb`. Replicate locally with:
   ```bash
   npm run cypress:run
   ```
