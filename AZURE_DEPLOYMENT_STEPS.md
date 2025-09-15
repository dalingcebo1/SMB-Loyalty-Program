# Azure Deployment Runbook

This runbook standardizes production deployment on Azure using:
- Azure Container Apps for the Python FastAPI backend
- Azure Static Web Apps (or Azure Storage Static Website + CDN) for the React/Vite frontend
- Azure Container Registry (ACR) for image storage
- GitHub Actions (OIDC) for CI/CD

## 1. Prerequisites

| Item | Notes |
|------|-------|
| Azure Subscription | Owner or Contributor on target RG |
| Resource Group | Example: `SMB-Loyalty-Group` |
| ACR | Example: `smblpcontainerregistry` (login server: `smblpcontainerregistry.azurecr.io`) |
| Container App Environment | Created once (e.g. `smb-loyalty-cae`) |
| GitHub OIDC App Registrations | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` secrets set |
| Database (Azure Postgres Flexible Server) | Provision separately; gather connection string |
| DNS & TLS | Point domain to Front Door / SWA / Container Apps ingress as needed |

## 2. One-Time Azure Setup (CLI)

```bash
RG=SMB-Loyalty-Group
LOC=westeurope
ACR=smblpcontainerregistry
ENV_NAME=smb-loyalty-cae
APP_NAME=apismbloyaltyapp

# Resource group
az group create -n $RG -l $LOC

# ACR (Basic SKU fine initially)
az acr create -n $ACR -g $RG --sku Basic --admin-enabled false

# Container Apps env
az extension add --name containerapp --upgrade
az containerapp env create -g $RG -n $ENV_NAME -l $LOC

# (Optional) Log analytics workspace for better observability
# az monitor log-analytics workspace create -g $RG -n smb-loyalty-law -l $LOC
```

## 3. Backend Container App Create (First Time)

```bash
IMAGE="$ACR.azurecr.io/smb-api:bootstrap"
# Build locally & push (or let GH workflow do it)
docker build -t $IMAGE -f Backend/Dockerfile Backend
az acr login -n $ACR
docker push $IMAGE

az containerapp create \
  -g $RG -n $APP_NAME \
  --image $IMAGE \
  --environment $ENV_NAME \
  --ingress external --target-port 8000 \
  --min-replicas 1 --max-replicas 2 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars \
    ENVIRONMENT=production \
    ALLOWED_ORIGINS="https://yourdomain.com" \
    FRONTEND_URL="https://yourdomain.com" \
  --registry-server $ACR.azurecr.io
```
Then configure secrets (JWT_SECRET etc.) either via Portal or CLI.

```bash
az containerapp secret set -g $RG -n $APP_NAME \
  --secrets \
    jwt-secret=$(openssl rand -hex 32) \
    reset-secret=$(openssl rand -hex 32) \
    app-secret=$(openssl rand -hex 32) \
    database-url="postgresql://user:pass@host:5432/dbname" \
    yoco-secret=live_yoco_key \
    yoco-webhook-secret=live_webhook_secret

az containerapp update -g $RG -n $APP_NAME \
  --set-env-vars \
    JWT_SECRET=secretref:jwt-secret \
    RESET_SECRET=secretref:reset-secret \
    SECRET_KEY=secretref:app-secret \
    DATABASE_URL=secretref:database-url \
    YOCO_SECRET_KEY=secretref:yoco-secret \
    YOCO_WEBHOOK_SECRET=secretref:yoco-webhook-secret
```

## 4. GitHub Actions Workflows

Already present:
- `backend-azure-containerapps.yml`: Builds & deploys backend image using ACR remote build.
- `containerapp-configure-env.yml`: Manually apply/override environment variables.
- `release-backend.yml` / `release-frontend.yml`: Publish GHCR images (optional parallel registry).

### Secrets Needed (Repository Settings → Secrets & Variables → Actions)
```
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
CA_DATABASE_URL (optional if using workflow input)
CA_JWT_SECRET
CA_RESET_SECRET
CA_SECRET_KEY
CA_ALLOWED_ORIGINS (e.g. https://yourdomain.com)
CA_FRONTEND_URL (e.g. https://yourdomain.com)
```

## 5. Frontend Hosting Options

### Option A: Azure Static Web Apps (Recommended)
Use existing or create new SWA linked to `Frontend` build. Provide `VITE_API_BASE_URL` as configuration.

### Option B: Static Website on Azure Storage + CDN
```bash
STORAGE=smbloyaltyweb
az storage account create -n $STORAGE -g $RG -l $LOC --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false
az storage blob service-properties update --account-name $STORAGE --static-website --404-document index.html --index-document index.html
npm --prefix Frontend ci
npm --prefix Frontend run build
az storage blob upload-batch -s Frontend/dist -d '$web' --account-name $STORAGE --overwrite
```
Add Azure CDN / Front Door for custom domain + HTTPS.

## 6. End-to-End Release Flow

1. Merge to `main` triggers `backend-azure-containerapps.yml` (deploy latest SHA) if Backend changes.
2. Create tag `vX.Y.Z` to publish immutable images (backend & frontend) to GHCR.
3. Run `containerapp-configure-env.yml` (if new env vars or secrets changed).
4. Deploy / update frontend (Static Web Apps or storage upload pipeline).
5. Run `post-deploy-smoke.yml` with the public API base URL.
6. Monitor logs & metrics (Container App -> Logs). Optionally integrate Azure Monitor / Sentry.

## 7. Database Migrations

Container start runs Alembic only when you execute it. Recommended pattern: dedicated migration job/workflow.

Manual via Azure CLI connection (if shell inside container):
```bash
az containerapp exec -g $RG -n $APP_NAME --command \
  "bash -c 'alembic -c alembic.ini upgrade head'"
```
Automate by adding a GitHub Action job after successful image deploy (idempotent) or a sidecar init container pattern.

## 8. Observability / Health

Health endpoints (no auth):
- `/health/` basic
- `/health/detailed` extended
- `/health/ready` readiness
- `/health/live` liveness

Add Azure Monitor alert rules: HTTP 5xx threshold, latency, container restarts.

## 9. Rollback Strategy

1. Identify previous successful commit SHA or version tag.
2. Re-run `backend-azure-containerapps.yml` pinned to that ref (workflow dispatch) OR update Container App to previous image tag:
```bash
az containerapp update -g $RG -n $APP_NAME --image $ACR.azurecr.io/smb-api:<OLD_SHA_OR_TAG>
```
3. Verify health endpoints and core transactions.

DB schema rollback is avoided—forward fix preferred. If a faulty migration shipped, create a new corrective migration.

## 10. Scaling & Sizing (Initial)

| Component | Start | Notes |
|-----------|-------|-------|
| Backend CPU | 0.5 vCPU | Increase if p95 latency > 500ms under load |
| Backend Memory | 1 GiB | Watch RSS; increase if OOM kills occur |
| Replicas | 1–2 | Enable min=2 for HA once traffic > low baseline |
| Postgres | 2 vCore | Adjust based on active connections + CPU |

Set autoscale rules (future):
```bash
az containerapp update -g $RG -n $APP_NAME \
  --scale-rule-name http-concurrency \
  --scale-rule-type http \
  --scale-rule-metadata concurrentRequests=80 \
  --min-replicas 1 --max-replicas 5
```

## 11. Security Checklist (Azure Specific)
- Use Managed Identity for future secret retrieval (Key Vault) instead of static secrets.
- Restrict Postgres firewall to Container App egress & admin IP.
- Enforce HTTPS only, add custom domain + TLS.
- Add WAF (Front Door) for advanced protection.
- Rotate secrets quarterly (script workflow).

## 12. Next Improvements
- Bicep definitions for Container App, ACR, Postgres, Static assets (currently placeholders in `infra/azure`).
- Key Vault integration + secret referencing in Container App.
- Prometheus scraping (Azure Monitor managed). 
- Scheduled job container or Azure Functions for periodic tasks (billing, cleanup).

## 13. Quick Smoke Commands

```bash
API=https://<your-app>.azurecontainerapps.io
curl -fsSL $API/health/ready
curl -i $API/api/public/tenant-meta
```

---
This runbook will evolve as infrastructure as code (Bicep/Terraform) matures.
