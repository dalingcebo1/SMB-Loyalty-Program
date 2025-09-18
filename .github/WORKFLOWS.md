# CI/CD Workflows

This repository deploys on Azure. We removed legacy AWS pipelines and kept a focused set of workflows for CI, releases, and Azure deploys.

## Overview

- Backend CI and Quality
  - `backend-ci.yml`: Lint, type-check, run tests (push/PR to `Backend/**`)
  - `backend-quality.yml`: Enhanced PR checks (ruff, mypy, migration drift, pip-audit, coverage gate)
  - `backend-trivy-scan.yml`: Container image vulnerability scanning for PRs
- Frontend CI
  - `frontend-ci.yml`: Install, test, and build Frontend on push/PR
- E2E and Smoke
  - `e2e-tests.yml`: Local ephemeral stack, runs Cypress against preview servers
  - `post-deploy-smoke.yml`: Manual smoke checks against a provided API URL
- Releases
  - `release-backend.yml`: Build and push backend image to GHCR on `v*.*.*` tags
  - `release-frontend.yml`: Build and push frontend image to GHCR on `v*.*.*` tags
- Azure Deployments
  - `backend-azure-containerapps.yml`: Builds via ACR Build and deploys the backend to Azure Container Apps. Optional Alembic run and health checks.
  - `backend-migrate.yml`: Manually run Alembic migrations inside the running Container App.
  - `containerapp-configure-env.yml`: Manually set and update environment variables on the Container App.
  
  Ringfenced health strategy:
  - Health checks run from inside the Container App using `az containerapp exec` to curl `http://localhost:8000/health/ready-lite`. This avoids hitting the public ingress when the backend is ringfenced.
  - External smoke tests run only when `CA_PUBLIC_API_URL` secret is configured. If not provided, smoke tests are skipped.
- Static Web Apps (Frontend)
  - `azure-static-web-apps-*.yml`: Builds the frontend using npm and deploys to Azure Static Web Apps.

## Removed/Disabled

- `deploy.yml`: DISABLED legacy AWS (S3 + Elastic Beanstalk). Kept as a no-op manual file with a notice.
- `frontend-azure-swa.yml`: Removed (empty). SWA deployments are handled by `azure-static-web-apps-*.yml`.
- `ci.yml`: Removed (duplicate of backend CI).

## Triggers

- CI (push/PR): `backend-ci.yml`, `frontend-ci.yml`, `backend-quality.yml`, `backend-trivy-scan.yml`, `e2e-tests.yml`
- Release (tags): `release-backend.yml`, `release-frontend.yml`
- Deploy (push to main): `backend-azure-containerapps.yml`, `azure-static-web-apps-*.yml`
- Manual: `backend-migrate.yml`, `containerapp-configure-env.yml`, `post-deploy-smoke.yml`, `deploy.yml` (disabled)

Notes:
- SWA build uses `VITE_API_BASE_URL` from `CA_PUBLIC_API_URL` secret. Set this to an approved public domain. If unset, frontend may not be able to call the API.
- E2E workflow applies Alembic migrations and sets `ENVIRONMENT=production` before starting the backend to avoid automatic table creation and enforce the real schema.

## Contributor tips

- Backend tests use Postgres in CI. Ensure DB migrations run locally with `alembic -c Backend/alembic.ini upgrade head` before pushing.
- Frontend builds use Node 18/20 and npm. Keep `package-lock.json` up to date.
- For Azure Container Apps secrets, update repository secrets prefixed with `CA_...`.
- Tag a release (`vX.Y.Z`) to publish images to GHCR.
- E2E runs headlessly with `xvfb`; if tests fail on CI, replicate locally with `npm run cypress:run`.
