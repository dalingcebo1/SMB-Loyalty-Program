# Azure Deployment Overview (Phased Flow)

This document has been moved. The canonical deployment overview now lives at `docs/deployment/overview.md`.
Please update links to use `docs/deployment/overview.md`.

## 1. Components & Workflows

| Area | Azure Resource | Workflow(s) | Purpose |
|------|----------------|-------------|---------|
| Backend API | Container App `apismbloyaltyapp` | `backend-azure-containerapps.yml` | Build & deploy image from Backend directory via remote ACR build |
| Backend Migrations | Same Container App | `backend-migrate.yml` (manual) or optional step in deploy workflow (`run_migrations=true`) | Apply Alembic schema changes |
| Backend Env Config | Container App | `containerapp-configure-env.yml` | Set / update environment variables & secrets |
| Frontend | Static Web App (SWA) | `azure-static-web-apps-*.yml` | Build Vite frontend and deploy static assets |
| Smoke Tests | N/A | `post-deploy-smoke.yml` | External health verification |
| Release Images | GitHub Container Registry | `release-backend.yml` / `release-frontend.yml` | Publish immutable version-tagged images |
This document has been moved into `docs/deployment/overview.md`.

Please update any links to point to `docs/deployment/overview.md` (the original content is preserved there).
Backend Critical:
