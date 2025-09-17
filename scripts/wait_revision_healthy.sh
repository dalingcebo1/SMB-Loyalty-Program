#!/usr/bin/env bash
# wait_revision_healthy.sh
# Purpose: After updating an Azure Container App, wait until the newest revision
# becomes Running + Healthy (or fail with a non‑zero exit code on timeout).
#
# Usage:
#   ./scripts/wait_revision_healthy.sh \
#       --app apismbloyaltyapp \
#       --resource-group SMB-Loyalty-Group \
#       [--timeout 600] [--interval 10]
#
# Exits 0 on success, non-zero on failure.
set -euo pipefail

APP=""
RG=""
TIMEOUT=600
INTERVAL=10

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app) APP="$2"; shift 2;;
    --resource-group|--rg) RG="$2"; shift 2;;
    --timeout) TIMEOUT="$2"; shift 2;;
    --interval) INTERVAL="$2"; shift 2;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# //'; exit 0;;
    *) echo "Unknown argument: $1" >&2; exit 2;;
  esac
done

if [[ -z "$APP" || -z "$RG" ]]; then
  echo "ERROR: --app and --resource-group are required" >&2
  exit 2
fi

echo "Waiting for latest revision of $APP in $RG to become Healthy (timeout=${TIMEOUT}s, interval=${INTERVAL}s)"
START=$(date +%s)

get_latest_rev() {
  az containerapp show -n "$APP" -g "$RG" --query properties.latestRevisionName -o tsv || true
}

REV=$(get_latest_rev)
if [[ -z "$REV" ]]; then
  echo "ERROR: Could not determine latest revision name" >&2
  exit 3
fi

echo "Tracking revision: $REV"

while true; do
  HEALTH=$(az containerapp revision show -n "$APP" -g "$RG" --revision "$REV" --query properties.healthState -o tsv || true)
  RUNNING=$(az containerapp revision show -n "$APP" -g "$RG" --revision "$REV" --query properties.runningState -o tsv || true)
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "[$TS] status: revision=$REV running=$RUNNING health=$HEALTH"

  if [[ "$HEALTH" == "Healthy" && "$RUNNING" == "Running" ]]; then
    echo "Revision $REV is Healthy and Running."; break
  fi

  NOW=$(date +%s)
  ELAPSED=$((NOW-START))
  if (( ELAPSED >= TIMEOUT )); then
    echo "ERROR: Timeout waiting for revision $REV to become Healthy (elapsed ${ELAPSED}s)" >&2
    exit 4
  fi

  sleep "$INTERVAL"
  # Detect superseding newer revision (rare in Single mode but guarded)
  NEW_REV=$(get_latest_rev)
  if [[ -n "$NEW_REV" && "$NEW_REV" != "$REV" ]]; then
    echo "Detected newer revision $NEW_REV (superseding $REV); switching target." >&2
    REV="$NEW_REV"
  fi
done

# Basic smoke probe (non-fatal if it fails; you may choose to enforce):
BASE_FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv || true)
if [[ -n "$BASE_FQDN" ]]; then
  echo "Performing smoke GET /health/ready-lite on https://$BASE_FQDN" || true
  if curl -fsS --max-time 10 "https://$BASE_FQDN/health/ready-lite" >/dev/null; then
    echo "Smoke health check succeeded.";
  else
    echo "WARNING: Smoke health check failed (continuing)." >&2
  fi
fi

echo "Success."