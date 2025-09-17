# Deployment Hardening & Resilience Additions

This document summarizes recent defensive changes to make production deployments via Azure Container Apps + GitHub Actions more resilient to configuration mistakes (particularly secret / env var quoting) and to reduce full‑startup failures.

## 1. Problems Observed

1. Quoted environment values (e.g. `"postgresql://..."`) broke SQLAlchemy URL parsing.
2. Short / missing `SECRET_KEY` and wildcard `ALLOWED_ORIGINS` caused hard startup failures via `_validate_environment()`.
3. GitHub Actions workflow performed health checks before the new revision was fully provisioned, returning misleading 401/redirect results.
4. Re‑entering sensitive values in workflow YAML increased risk of typos or quoting errors.

## 2. Code-Level Safeguards Added

| Area | Change | Benefit |
|------|--------|---------|
| Settings normalization | `Settings.normalise()` strips a single layer of surrounding quotes from `DATABASE_URL`, `loyalty_secret` (SECRET_KEY), `allowed_origins`, `frontend_url` | Survives accidental quoting in CI/CD or portal edits |
| Allowed origins fallback | `_validate_environment()` now derives a safe single origin from `FRONTEND_URL` if `ALLOWED_ORIGINS` is missing or wildcard and logs a warning instead of immediate failure | Reduces deploy failures when only frontend URL is configured |
| Workflow wait logic | Added explicit wait for revision provisioning state + replica count prior to curling health endpoint | Eliminates premature health probes hitting old revision |
| Diagnostic health probe | First failed `/health/ready-lite` attempt now logs headers & body (diagnostics only once) | Faster root cause analysis (auth, redirect, 5xx) |

## 3. Recommended Secret Handling Strategy (Azure-centric)

1. **Primary Secrets in Azure**: Store `secretkey`, `jwtsecretkey`, `resetsecretkey` (and optionally `dburl`) as Container App secrets.
2. **Reference via secretRef** in deployment (`SECRET_KEY=secretref:secretkey`, etc.)—avoid re‑embedding raw secret values in the workflow.
3. **Optionally move DATABASE_URL to a secret**:
   ```bash
   az containerapp secret set -g <RG> -n <APP> --secrets dburl="<actual_database_url>"
   az containerapp update -g <RG> -n <APP> --set-env-vars DATABASE_URL=secretref:dburl
   ```
4. Keep non-sensitive configuration (origins, frontend URL) as plain env vars.

## 4. Operational Checklist (Hardened Flow)

Before merging to `main`:
- Confirm Container App secrets exist: `az containerapp secret list -g <RG> -n <APP> -o table`
- (Optional) Rotate with helper script or manual `secret set`.

On deploy:
- Workflow builds remote image, updates revision, waits for provisioning success, then runs health checks.
- If `/health/ready-lite` fails, log output shows first response body & hints.

After deploy:
- Verify fallback warning (if any) in logs: `ENV_VALIDATION: ALLOWED_ORIGINS was invalid/missing; derived fallback ...`.
- Run deep readiness: `curl -fsSL https://<FQDN>/health/ready || echo 'not ready'`.

## 5. Future Enhancements (Optional)
- Migrate secrets to Azure Key Vault and reference via DAPR/KeyVault integration.
- Add a small endpoint `/health/version` exposing image SHA & revision for debugging traffic splits.
- Add automatic OpenAPI spec diff in PR to catch unintentional breaking changes.
- Implement Log Analytics workspace for richer queryable logs.

## 6. Rollback Strategy Recap
```
az containerapp update -g <RG> -n <APP> \
  --image <ACR_LOGIN>.azurecr.io/smb-api:<previous_sha_or_tag>
```
If rollback fails due to env validation:
1. Ensure secrets still populated (no rotation mismatch).
2. If `ALLOWED_ORIGINS` intentionally relaxed, supply explicit list temporarily.

## 7. Quick Validation Script (Ad Hoc)
```bash
RG=SMB-Loyalty-Group
APP=apismbloyaltyapp
FQDN=$(az containerapp show -g $RG -n $APP --query properties.configuration.ingress.fqdn -o tsv)
# Show critical envs
az containerapp show -g $RG -n $APP --query "properties.template.containers[0].env[?name=='SECRET_KEY'||name=='ALLOWED_ORIGINS'||name=='DATABASE_URL']" -o jsonc
curl -ks -w "\n%{http_code}\n" https://$FQDN/health/ready-lite
```

## 8. Automated Smoke Tests (New)

After a revision turns Healthy, run `scripts/post_deploy_smoke.sh` to quickly assert end-to-end surface availability.

What it covers:
1. `/health/ready-lite` – container/process is live.
2. `/api/openapi.json` – application routing + docs generation.
3. `/` landing page – root route & middleware chain.
4. `/api/public/tenant-meta` – DB + tenant resolution path (core metadata).

Distinct exit codes (10–13) make CI failure triage immediate. Integrate directly after `scripts/wait_revision_healthy.sh` in the deployment workflow.

Example snippet:
```bash
chmod +x scripts/wait_revision_healthy.sh scripts/post_deploy_smoke.sh
./scripts/wait_revision_healthy.sh --api-base "$API_BASE" --timeout 600
API_BASE="$API_BASE" ./scripts/post_deploy_smoke.sh
```

If smoke fails, abort before announcing deployment success. Avoid auto-rollback unless failure types are consistently safe to interpret (manual review recommended initially).

### Redirect Loop Mitigation
Added `ProxyHeadersMiddleware` plus enhanced conditional HTTPS redirect logic to suppress self-redirect (307) loops on `/` and `/api/openapi.json` when Azure already terminates TLS and sets `X-Forwarded-Proto=https`. Health endpoints remain exempt.

---
These changes aim to reduce fatigue from repeated secret/env deploy issues and provide graceful degradation where safe. Update this document when additional protections are added.
