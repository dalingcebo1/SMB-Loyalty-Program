# Release & Deployment Flow

This document codifies the end-to-end flow from code merge to production verification.

## 1. Branching & Versioning
- `main` is always deployable (CI enforced).
- Feature branches merge via PR (require green backend/frontend CI + reviews).
- Semantic version tags: `vMAJOR.MINOR.PATCH`.
  - Patch: backwards-compatible fixes.
  - Minor: additive, backwards-compatible features.
  - Major: breaking changes (coordinate migrations & clients).

## 2. Pre-Tag Checklist
Run locally (or via a dedicated GitHub Action):
```
make strict            # lint, type, tests, coverage, drift
make snapshot-openapi  # if new endpoints intentionally added
```
Confirm:
- Coverage >= threshold.
- Migration drift check passes.
- OpenAPI snapshot updated when adding/removing endpoints.

## 3. Create Tag
```
git tag v1.0.0
git push origin v1.0.0
```
Triggers:
- `release-backend.yml` → Builds & pushes backend image to GHCR (`:v1.0.0`, `:latest`).
- `release-frontend.yml` → Builds & pushes frontend image to GHCR (`:v1.0.0`, `:latest`).

## 4. Azure Deployment (Continuous)
- Push to `main` with backend changes triggers `backend-azure-containerapps.yml` which remote builds in ACR & updates the Container App to the commit SHA image.
- (Optional) Pin production to a version tag image by manually updating Container App: 
```
az containerapp update -g <RG> -n <APP> --image <ACR>.azurecr.io/smb-api:v1.0.0
```

## 5. Environment Configuration
Managed via `containerapp-configure-env.yml` (workflow dispatch) – never hardcode secrets in code.
Secrets/vars include: DATABASE_URL, JWT_SECRET, RESET_SECRET, SECRET_KEY, ALLOWED_ORIGINS, FRONTEND_URL, YOCO keys, SENTRY_DSN.

## 6. Database Migrations
Strategy: run Alembic upgrade as part of deployment OR via manual invocation after image deploy.
Recommended: Add a job step after Container App image update:
```
az containerapp exec -g $RG -n $APP --command "alembic -c alembic.ini upgrade head"
```
(Planned: separate migration job container or GitHub Action.)

## 7. Frontend Deployment
Options:
1. Azure Static Web Apps: Auto build from `main` (preferred).
2. GHCR image used behind Nginx in Azure Web App / Container App.
3. Static storage + CDN upload pipeline.
Set `VITE_API_BASE_URL` appropriately.

## 8. Post-Deploy Smoke
Run `post-deploy-smoke.yml` with input `api_url`.
Manual curl set:
```
API=https://<fqdn>
curl -fsSL $API/health/ready
curl -fsSL $API/api/public/tenant-meta
```
Confirm:
- 200 responses
- No unexpected 5xx in logs
- Rate-limit headers sane

## 9. Monitoring & Alerts
- Enable Sentry (SENTRY_DSN).
- Azure alerts: Container Restarts > 2 in 10m, HTTP 5xx > threshold, CPU > 80% sustained.
- Capture performance baseline (p95 latency, error rate) after each release for regression tracking.

## 10. Rollback
1. Identify previous good tag (e.g., `v1.0.0`).
2. Update Container App image to that tag.
3. Re-run smoke tests.
4. If schema migrations introduced breaks, ship forward fix migration (avoid downgrade).

## 11. Release Notes (Optional)
Maintain `CHANGELOG.md` or GitHub Releases description summarizing:
- Added / Changed / Fixed / Security.
- Migration implications.
- Deprecations.

## 12. Automation Roadmap
- Add automated OpenAPI diff comment on PRs.
- Add SBOM & provenance (SLSA) for images.
- Auto-run migration job with canary health gate before full rollout.
- Progressive traffic shifting (future service mesh / gateway).

## 13. Responsibility Matrix (RACI Draft)
| Activity | Dev | DevOps | QA |
|----------|-----|--------|----|
| Tag creation | R | C | C |
| CI pass gate | R | C | A |
| Env secret rotation | C | R | I |
| Migration review | R | C | A |
| Smoke test | R | C | A |
| Rollback | C | R | I |

Legend: R=Responsible, A=Accountable, C=Consulted, I=Informed.

---
Adopt this flow to keep deployments predictable, auditable, and recoverable.
