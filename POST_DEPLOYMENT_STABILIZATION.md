# Post-Deployment Stabilization & Recovery Guide

This document captures how we recovered the backend (FastAPI on Azure Container Apps) to a Healthy, Running state and defines the repeatable procedure for future deployments.

## 1. Timeline & Root Causes Encountered
| Phase | Issue / Symptom | Root Cause | Action Taken | Result |
|-------|-----------------|-----------|--------------|--------|
| A | Revisions failing (ActivationFailed / Degraded) after deploy | Excessive simultaneous active revisions (Multiple mode) + large resource requests (4 CPU / 8Gi) blocking new replica scheduling | Switched to *Single* revision mode | New revision could schedule replicas |
| B | Health endpoints earlier returned 307/401 in past attempts | HTTPS redirect middleware applied to /health/* | Added conditional HTTPS redirect exemption for /health paths | Probes no longer redirected/unauthorized |
| C | Startup 400 / readiness 504 loops (previous revision set) | TrustedHost restrictions + empty env (ALLOWED_ORIGINS / FRONTEND_URL) causing validation/wrapping failures | Added wildcard `*` & localhost to TrustedHost; fallback + normalization for origins; set correct env vars in ACA | Environment stabilized |
| D | ACR build failed (COPY requirements.txt) | Built from repo root instead of `Backend/` so Dockerfile couldn't find `requirements.txt` | Re-ran ACR build with `Backend` as build context | Image built & pushed |
| E | Persistent Degraded revisions (0 replicas) | Capacity fragmentation: many old active revisions each reserving minReplicas=2 | Move to *Single* revision mode then resource right-sizing | Healthy running revision successfully stabilized |
| F | Over-provisioned cost / capacity risk | 4 CPU / 8Gi per replica was unnecessarily high | Right-sized to 1 CPU / 2Gi, minReplicas=1 | Reduced footprint & improved scheduling headroom |

## 2. Current Golden Configuration (Backend)
- Revision mode: **Single**
- Resources per replica: **1 CPU / 2Gi RAM**
- Scale: minReplicas=1, maxReplicas=5 (no custom autoscale rules yet)
- Probes:
  - Liveness: `GET /health/ready-lite`
  - Readiness: `GET /health/ready-lite`
  - Startup: `GET /health/startup`
- Environment resilience:
  - `ALLOWED_ORIGINS` fallback derived from `FRONTEND_URL` if missing or wildcard
  - Normalization strips stray wrapping quotes in critical settings
  - TrustedHost includes wildcard + localhost to avoid probe Host header failures

## 3. Standard Deployment Flow (Repeatable Procedure)
1. Commit & push backend changes (ensure `Backend/Dockerfile` + `requirements.txt` intact).
2. Build & push image (ACR build from Backend directory):
   ```bash
   TAG=$(git rev-parse --short HEAD)
   az acr build -r smblpcontainerregistry -t smb-api:$TAG Backend
   ```
3. Update Container App image:
   ```bash
   az containerapp update -n apismbloyaltyapp -g SMB-Loyalty-Group \
     --image smblpcontainerregistry.azurecr.io/smb-api:$TAG
   ```
4. Wait for new revision to become **Healthy** (see automated health gate suggestion below). Identify new revision name:
   ```bash
   az containerapp show -n apismbloyaltyapp -g SMB-Loyalty-Group --query properties.latestRevisionName -o tsv
   az containerapp revision show -n apismbloyaltyapp -g SMB-Loyalty-Group --revision <REV> --query "{running:properties.runningState,health:properties.healthState}"
   ```
5. Validate endpoints (smoke tests):
   ```bash
   curl -sf https://api.chaosx.co.za/health/ready-lite
   curl -sf https://api.chaosx.co.za/health/ready
   ```
6. (Optional) Run a focused functional smoke (login, basic CRUD) from local or CI script.
7. Mark deployment complete or rollback (see §6) if not healthy within timeout.

## 4. Automating a Post-Deploy Health Gate (Recommended)
Add a shell step **after** the deploy in the GitHub Actions workflow:
```bash
set -euo pipefail
APP=apismbloyaltyapp
RG=SMB-Loyalty-Group
TIMEOUT=600   # 10 minutes
SLEEP=10
echo "Waiting for new revision to become Healthy..."
NEW_REV=$(az containerapp show -n $APP -g $RG --query properties.latestRevisionName -o tsv)
START=$(date +%s)
while true; do
  HEALTH=$(az containerapp revision show -n $APP -g $RG --revision $NEW_REV --query properties.healthState -o tsv || echo "")
  RUNNING=$(az containerapp revision show -n $APP -g $RG --revision $NEW_REV --query properties.runningState -o tsv || echo "")
  echo "Revision $NEW_REV status: running=$RUNNING health=$HEALTH"
  if [ "$HEALTH" = "Healthy" ] && [ "$RUNNING" = "Running" ]; then
    echo "Revision healthy."; break
  fi
  NOW=$(date +%s); ELAPSED=$((NOW-START))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "ERROR: Revision did not become Healthy within ${TIMEOUT}s" >&2
    exit 1
  fi
  sleep $SLEEP
  # In case another revision supersedes it (rare in Single mode) re-read
  CUR_REV=$(az containerapp show -n $APP -g $RG --query properties.latestRevisionName -o tsv)
  if [ "$CUR_REV" != "$NEW_REV" ]; then
    echo "Detected newer revision $CUR_REV; switching watch target."; NEW_REV=$CUR_REV
  fi
done
# Optional smoke probe
curl -sf https://api.chaosx.co.za/health/ready-lite >/dev/null
curl -sf https://api.chaosx.co.za/health/ready >/dev/null
```
If this step fails, the workflow fails—preventing unnoticed bad deploys.

## 5. Observability & Troubleshooting Checklist
| Symptom | Quick Checks | Likely Causes | Remediation |
|---------|--------------|--------------|-------------|
| ActivationFailed (0 replicas) | `revision show` replicas=0 | Capacity / resource requests too high | Lower CPU/RAM, Single mode, deactivate old revisions |
| Degraded then Unhealthy with restarts | Get container logs or events; curl health endpoints internally | Exception in startup, bad env var, probe path failure | Fix env, confirm probes reachable, verify TrustedHost wildcard |
| Health endpoints 307 / 401 | Curl `/health/ready-lite` | Misapplied HTTPS redirect / auth middleware | Ensure conditional redirect skip list includes `/health/*` |
| 400 Host header errors | Logs show host rejection | TrustedHostMiddleware restrictive | Include wildcard + internal hostnames |
| Readiness stuck but app ok | Ready vs ready-lite discrepancy | Cache TTL / deep checks blocking | Use `/health/ready-lite` for probes; tune TTL |

## 6. Rollback Procedure
1. Identify last known good image tag (e.g. from git commit SHA or ACR repository tags):
   ```bash
   az acr repository show-tags -n smblpcontainerregistry --repository smb-api --top 10 -o table
   ```
2. Update app to previous tag:
   ```bash
   az containerapp update -n apismbloyaltyapp -g SMB-Loyalty-Group \
     --image smblpcontainerregistry.azurecr.io/smb-api:<GOOD_TAG>
   ```
3. Wait for Healthy (use health gate script logic).
4. Record rollback in CHANGELOG / incident notes.

## 7. Capacity & Scaling Guidance
| Dimension | Current | Recommendation |
|-----------|---------|----------------|
| CPU/RAM | 1 CPU / 2Gi | Monitor; adjust only with sustained >70% CPU or memory pressure |
| minReplicas | 1 | Increase to 2 if cold-start latency becomes a concern |
| maxReplicas | 5 | Increase if sustained throughput saturates CPU at scale |
| Scale rule | None | Add CPU rule if average >70% for 2+ mins during load tests |

## 8. Configuration Guardrails (Keep)
- Keep normalization & origin fallback logic in `config.py`.
- Maintain wildcard TrustedHost until custom domain-only traffic is enforced and internal probes are verified stable.
- Keep `/health/ready-lite` lightweight; avoid DB or third-party calls there.
- Keep startup probe path distinct (`/health/startup`) to allow future specialized warmup logic.

## 9. Future Enhancements (Backlog)
- Add DB connectivity + Redis (if adopted) to a deeper `/health/detailed` endpoint kept out of probe paths.
- Integrate structured metric export (Prometheus or Azure Monitor) for CPU/memory & request latency.
- Add automatic revision pruning (retain last 3 healthy) in CI/CD.
- Implement load test workflow before scaling parameter changes.

## 10. Quick Reference Commands
```bash
# Latest revision name
az containerapp show -n apismbloyaltyapp -g SMB-Loyalty-Group --query properties.latestRevisionName -o tsv

# Inspect revision health
REV=apismbloyaltyapp--0000040
az containerapp revision show -n apismbloyaltyapp -g SMB-Loyalty-Group --revision $REV --query "{running:properties.runningState,health:properties.healthState,resources:properties.template.containers[0].resources}"

# List recent unhealthy revisions
az containerapp revision list -n apismbloyaltyapp -g SMB-Loyalty-Group --query "[?properties.healthState!='Healthy'].{name:name,running:properties.runningState,health:properties.healthState}" -o table

# Smoke health checks
curl -sf https://api.chaosx.co.za/health/ready-lite
curl -sf https://api.chaosx.co.za/health/ready
```

---
**Summary:** Stabilization required (1) fixing env var gaps and host restrictions, (2) reducing revision sprawl via Single mode, (3) right-sizing resources, and (4) ensuring probes target lightweight endpoints. Follow the standard deployment flow and add the health gate script in CI to prevent regressions.
