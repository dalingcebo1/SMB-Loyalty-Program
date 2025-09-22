#!/usr/bin/env bash
set -euo pipefail
# Post-deployment smoke tests for the SMB Loyalty API
# Usage: API_BASE="https://your-approved-api-domain" ./scripts/post_deploy_smoke.sh
# Exit codes:
# 0 success
# 10 health not ready
# 11 openapi fetch failed
# 12 landing page failed
# 13 tenant-meta failed

if [ -z "${API_BASE:-}" ]; then
  echo "[SMOKE] ERROR: API_BASE is not set. Provide an approved public API URL. Skipping to respect backend ringfencing." >&2
  exit 0
fi
CURL_OPTS=(--fail --silent --show-error --max-time 10)

log() { echo "[SMOKE] $*" >&2; }

# 1. Ready-lite health
log "Checking ready-lite health..." 
if ! out=$(curl "${CURL_OPTS[@]}" "${API_BASE}/health/ready-lite"); then
  log "ready-lite health check failed"; exit 10; fi
log "ready-lite OK: $(echo "$out" | tr -d '\n' | cut -c1-120)"

# 2. OpenAPI (follow redirects)
log "Fetching OpenAPI spec..."
if ! ver=$(curl -L "${CURL_OPTS[@]}" "${API_BASE}/api/openapi.json" | jq -r '.info.version' 2>/dev/null); then
  log "OpenAPI fetch failed"; exit 11; fi
if [[ -z "$ver" || "$ver" == "null" ]]; then log "OpenAPI version empty"; exit 11; fi
log "OpenAPI version: $ver"

# 3. Landing page (ensure 200 eventually; allow a redirect chain but cut off loops)
log "Fetching landing page root..."
code=$(curl -L -o /dev/null -w '%{http_code}' "${API_BASE}/")
if [[ "$code" != "200" && "$code" != "307" ]]; then
  log "Unexpected root status $code"; exit 12; fi
log "Root status: $code"

# 4. Public tenant meta (allow 200 or 304)
log "Fetching public tenant meta..."
HDRS=()
if [ -n "${SMOKE_HOST_HEADER:-}" ]; then HDRS+=( -H "Host: ${SMOKE_HOST_HEADER}" ); fi
if [ -n "${SMOKE_TENANT_ID:-}" ]; then HDRS+=( -H "X-Tenant-ID: ${SMOKE_TENANT_ID}" ); fi
meta_code=$(curl -o /dev/null -w '%{http_code}' "${API_BASE}/api/public/tenant-meta" "${HDRS[@]}")
if [[ "$meta_code" != "200" && "$meta_code" != "304" ]]; then
  log "Unexpected tenant-meta status $meta_code"; exit 13; fi
log "tenant-meta status: $meta_code"

# 5. Public tenant theme (allow 200)
log "Fetching public tenant theme..."
theme_code=$(curl -o /dev/null -w '%{http_code}' "${API_BASE}/api/public/tenant-theme" "${HDRS[@]}")
if [[ "$theme_code" != "200" && "$theme_code" != "304" ]]; then
  log "Unexpected tenant-theme status $theme_code"; exit 13; fi
log "tenant-theme status: $theme_code"

log "All smoke checks passed."
