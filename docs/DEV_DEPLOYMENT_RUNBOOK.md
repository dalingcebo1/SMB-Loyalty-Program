# Dev Deployment Runbook (Multitenant & Multivertical)

This runbook explains how to deploy the current code to **dev** Azure environments (Container Apps + Static Web Apps) so you can test multitenant / multivertical behaviour before promoting to production.

## 1. Backend (Azure Container Apps - Dev)

- Workflow: `backend-azure-containerapps-dev.yml`.
- Target app: `apismbloyaltyapp-dev` in resource group `SMB-Loyalty-Group`.
- Trigger:
  - Push to `develop`, `feature/**`, or `test/**` touching `Backend/**`.
  - Manual `workflow_dispatch` (allows toggling migrations).

### Secrets / Variables expected (Dev)

Set these in GitHub **Secrets/Variables** for dev:

- `CA_DATABASE_URL_DEV` / `DATABASE_URL_DEV` – dev Postgres URL.
- `CA_ALLOWED_ORIGINS_DEV` / `ALLOWED_ORIGINS_DEV` – comma-separated origins (include dev SWA + localhost if needed).
- `CA_FRONTEND_URL_DEV` / `FRONTEND_URL_DEV` – URL of dev SWA.
- `CA_JWT_SECRET_DEV` / `JWT_SECRET_DEV`.
- `CA_RESET_SECRET_DEV` / `RESET_SECRET_DEV`.
- `CA_SECRET_KEY_DEV` / `SECRET_KEY_DEV`.
- `CA_SENTRY_DSN_DEV` / `SENTRY_DSN_DEV` (optional).
- `CA_DEFAULT_TENANT_DEV` / `DEFAULT_TENANT_DEV` / `DEFAULT_TENANT_DEV` var (defaults to `default`).

The workflow resolves `*_DEV` values first, then falls back to shared prod ones so you can onboard gradually.

### Typical usage

1. Push branch to `develop` (or `feature/*`).
2. Wait for `Deploy API (Azure Container Apps - Dev)` workflow to finish.
3. Confirm dev API health:

```bash
RG="SMB-Loyalty-Group"
APP_DEV="apismbloyaltyapp-dev"
FQDN=$(az containerapp show -g "$RG" -n "$APP_DEV" --query "properties.configuration.ingress.fqdn" -o tsv)
curl -ks -w "\n%{http_code}\n" "https://$FQDN/health/ready"
curl -ks -w "\n%{http_code}\n" "https://$FQDN/api/public/tenant-meta"
```

4. Optional: re-run migrations manually if needed:

```bash
az containerapp exec -g "$RG" -n "$APP_DEV" --command "cd /app && alembic -c alembic.ini upgrade head"
```

## 2. Frontend (Azure Static Web Apps - Dev)

- Workflow: `azure-static-web-apps-dev.yml`.
- Target SWA: token `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` (dev SWA instance).
- Trigger:
  - Push to `develop`, `feature/**`, or `test/**`.
  - PRs into `develop`.
  - Manual `workflow_dispatch` with optional `vite_api_base_url`.

### Dev SWA variables

Set these **dev** variables/secrets (they fallback to prod values if not provided):

- `VITE_API_BASE_URL_DEV` or `CA_PUBLIC_API_URL_DEV` – should point at dev Container App FQDN.
- `VITE_FIREBASE_*_DEV` – optional overrides for dev Firebase project.
- `VITE_YOCO_PUBLIC_KEY_DEV` – dev payments public key.

### Typical usage

1. Ensure dev API is deployed and healthy (see section 1).
2. Run `Azure Static Web Apps CI/CD (Dev)` (push/PR or manual dispatch). For manual dispatch you can override API base:

   - `vite_api_base_url = https://<dev-api-fqdn>`

3. When workflow succeeds, browse to dev SWA URL and verify:

   - Login works for dev users.
   - Dev admin panel (`/dev-admin`) lets you create tenants.
   - Verticals/tenants behave as expected.

## 3. Multitenant / Multivertical Validation Checklist (Dev)

In dev SWA, with dev API:

1. **Default tenant & health**
   - `/health/ready` → 200 JSON.
   - `/api/public/tenant-meta` → 200 with default tenant.

2. **Dev users**
   - Seed via `Backend/seed_users.py` (workflow/ops script) so that developer + staff accounts exist in dev DB.

3. **Tenants & verticals**
   - Use dev admin UI (`/dev-admin`) to create at least one tenant per vertical type.
   - Verify `primary_domain` and `config` saved correctly.

4. **Access control**
   - Ensure only developer/superadmin roles can reach `/api/dev/*` and dev admin UI.

5. **Promotion path**
   - Once dev looks good, open PR from `develop` → `main` so existing prod workflows (`backend-azure-containerapps.yml`, `azure-static-web-apps-gray-river-01eda360f.yml`) deploy the same code to production.
