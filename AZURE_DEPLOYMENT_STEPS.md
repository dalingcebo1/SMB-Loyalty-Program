# Azure Deployment Runbook (moved)

The procedural runbook has been moved to `docs/deployment/runbook.md` as the canonical location. Update links to point there.

Original content retained here for reference during migration.
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

The procedural runbook has been moved to `docs/deployment/runbook.md` as the canonical location.

Please update any links to point to `docs/deployment/runbook.md` (the original content is preserved there).
RG=SMB-Loyalty-Group
