# Azure Deployment Overview (Phased Flow)

This document unifies the end-to-end production deployment process for the SMB Loyalty Program across the Backend (Azure Container Apps) and Frontend (Azure Static Web Apps) along with supporting workflows.

## 1. Components & Workflows

| Area | Azure Resource | Workflow(s) | Purpose |
|------|----------------|-------------|---------|
| Backend API | Container App `apismbloyaltyapp` | `backend-azure-containerapps.yml` | Build & deploy image from Backend directory via remote ACR build |
| Backend Migrations | Same Container App | `backend-migrate.yml` (manual) or optional step in deploy workflow (`run_migrations=true`) | Apply Alembic schema changes |
| Backend Env Config | Container App | `containerapp-configure-env.yml` | Set / update environment variables & secrets |
| Frontend | Static Web App (SWA) | `azure-static-web-apps-*.yml` | Build Vite frontend and deploy static assets |
| Smoke Tests | N/A | `post-deploy-smoke.yml` | External health verification |
| Release Images | GitHub Container Registry | `release-backend.yml` / `release-frontend.yml` | Publish immutable version-tagged images |

## 2. Environment Variables / Secrets Summary

Backend Critical:
- `DATABASE_URL`, `JWT_SECRET`, `RESET_SECRET`, `SECRET_KEY`
- `ALLOWED_ORIGINS`, `FRONTEND_URL`
- `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET` (payments)
- `SENTRY_DSN` (optional)
- `FIREBASE_CREDENTIALS_JSON` (inline) OR `GOOGLE_APPLICATION_CREDENTIALS` (path)
- Rate limiting overrides only if deviating from defaults.

Frontend (SWA build env):
- `VITE_API_BASE_URL` (pointing to Backend API base, e.g. https://api.chaosx.co.za)
- `VITE_YOCO_PUBLIC_KEY` (public key only)
- Optional Firebase Web config values (`VITE_FIREBASE_*`).

## 3. Phased Deployment Flow

1. Feature Branch & PR (Optional Stage)
   - Develop feature → open PR → CI (backend + frontend) must pass.
   - Merge to `main` triggers backend + frontend auto builds.

2. Backend Deploy (Automatic)
   - `backend-azure-containerapps.yml` builds new image `<sha>` in ACR and updates the Container App revision.
   - Step includes readiness health check; optionally pass `run_migrations=true` on manual dispatch when you want code + schema in one run.

3. Environment Configuration (Conditional)
   - If secrets / env vars changed: run `containerapp-configure-env.yml` specifying `firebase_mode` as needed.
   - This updates env vars without redeploying image (Container App triggers implicit revision).

4. Database Migration
   - Option A: Manual run `backend-migrate.yml` (preferred for explicit control).
   - Option B: Use `backend-azure-containerapps.yml` workflow dispatch with `run_migrations=true`.
   - Migrations are idempotent; safe to re-run if uncertain.

5. Smoke Tests
   - Run `post-deploy-smoke.yml` with `api_url=https://<fqdn>`.
   - Validates `/health/`, public tenant meta endpoint, and version (if exposed).

6. Frontend Auto Update
   - SWA workflow builds frontend with current `VITE_API_BASE_URL` and deploys to domain (e.g. https://chaosx.co.za).
   - If API base changes (staging → prod), update SWA workflow env var or SWA configuration.

7. Version Tag (Optional But Recommended)
   - Create tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   - Triggers `release-backend.yml` & `release-frontend.yml` to publish GHCR images (`:vX.Y.Z`, `:latest`).
   - Record tag in release notes or change log.

8. Monitoring & Acceptance (15–30 min window)
   - Observe Container App logs (errors, latency spikes), Sentry issues, rate of 5xx.
   - If stable, mark release as accepted.

## 4. Operational Commands

Health & Logs:
```bash
# Fetch FQDN
az containerapp show -g SMB-Loyalty-Group -n apismbloyaltyapp --query properties.configuration.ingress.fqdn -o tsv

# Tail logs
az containerapp logs show -g SMB-Loyalty-Group -n apismbloyaltyapp --follow
```

Migrations (manual):
```bash
az containerapp exec -g SMB-Loyalty-Group -n apismbloyaltyapp --command "alembic -c alembic.ini upgrade head"
```

Rollback (previous commit SHA or version tag):
```bash
az containerapp update -g SMB-Loyalty-Group -n apismbloyaltyapp \
  --image smblpcontainerregistry.azurecr.io/smb-api:<previous-sha-or-tag>
```

Smoke (ad hoc):
```bash
API=https://api.chaosx.co.za
curl -fsSL $API/health/ready
curl -i $API/api/public/tenant-meta
```

## 5. Decision Points

| Question | Choice | Notes |
|----------|--------|-------|
| Run migrations automatically? | Manual (`backend-migrate.yml`) | Clear separation of deploy vs schema change |
| Firebase credentials method | Inline JSON | Already implemented via `FIREBASE_CREDENTIALS_JSON` |
| Tagging cadence | Each accepted production release | Enables reproducible rollback |
| Observability | Sentry + Container App logs | Add Log Analytics later |

## 6. Recommended Enhancements (Next Iteration)
- Add staging Container App & SWA for canary + promote workflow.
- Key Vault integration for secrets (remove raw env values from workflow usage).
- Automated OpenAPI diff comment on PRs.
- Add `/health/detailed` check to smoke workflow (currently only basic + meta endpoint).
- Lighthouse performance job for frontend bundle.

## 7. Quick Checklist (One-Liner View)

1. Merge PR → backend & frontend build.
2. (If needed) Run env workflow.
3. Run `Backend Migrate` workflow.
4. Run `Post-deploy Smoke` workflow.
5. Tag `vX.Y.Z` (optional) → GHCR images published.
6. Observe logs & Sentry.
7. Accept release or rollback.

## 8. Troubleshooting Table

| Issue | Symptom | Resolution |
|-------|---------|------------|
| Revision stuck in Provisioned state | `az containerapp revision show` reports new revision but replicas stay at 0; container logs include `ENV_VALIDATION` errors | Fix production guards: ensure `ALLOWED_ORIGINS` is a specific domain list (no `*`), `SECRET_KEY` ≥ 24 chars, and `DATABASE_URL` is a real Postgres URL. Update the Container App secrets/env vars, then redeploy the latest image. |
| Missing secrets | 500 on startup; env validation failure | Re-run env workflow; verify secrets present |
| Health check failing post deploy | Readiness step loops & fails | View logs, check DB connectivity & migrations |
| Migration drift errors in tests | CI drift check failing | Generate new Alembic revision & apply |
| CORS errors | Browser blocked requests | Ensure `ALLOWED_ORIGINS` includes production domain(s) |
| Payment webhook failing | 401 / signature mismatch | Verify `YOCO_WEBHOOK_SECRET` and production URL correctness |
| Firebase admin errors | Credential file not found | Ensure `FIREBASE_CREDENTIALS_JSON` secret set & env workflow run |

---
This overview complements `AZURE_DEPLOYMENT_STEPS.md` (procedural) and `RELEASE_FLOW.md` (versioning). Update as new environments or automation are introduced.
