#!/usr/bin/env bash
set -euo pipefail

# Update ACA ALLOWED_ORIGIN_REGEX and roll a new revision.
# Defaults come from repo docs: RG=SMB-Loyalty-Group, APP=apismbloyaltyapp
# Usage examples:
#   ./scripts/update_cors_regex_and_roll.sh
#   ./scripts/update_cors_regex_and_roll.sh --include-swa
#   ./scripts/update_cors_regex_and_roll.sh -g MyRG -a MyApp --regex '^https://([a-z0-9-]+\.)?example\.com$'

RG="${RG:-SMB-Loyalty-Group}"
APP="${APP:-apismbloyaltyapp}"
INCLUDE_SWA=false
REGEX=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -g|--resource-group) RG="$2"; shift 2;;
    -a|--app|--name) APP="$2"; shift 2;;
    --include-swa) INCLUDE_SWA=true; shift;;
    --regex) REGEX="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [-g RG] [-a APP] [--include-swa] [--regex REGEX]";
      exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: Azure CLI (az) not found on PATH" >&2
  exit 3
fi

# Default ChaosX pattern (allows https://chaosx.co.za and any subdomain, e.g., www, api)
DEFAULT_REGEX='^https://([a-z0-9-]+\.)?chaosx\.co\.za$'

if [[ -z "$REGEX" ]]; then
  REGEX="$DEFAULT_REGEX"
fi

if $INCLUDE_SWA; then
  # Add azurestaticapps.net alternation
  REGEX="${REGEX}|^https://([a-z0-9-]+\.)?azurestaticapps\.net$"
fi

echo "Setting ALLOWED_ORIGIN_REGEX on $APP in $RG:" >&2
echo "  $REGEX" >&2

az containerapp update \
  --resource-group "$RG" \
  --name "$APP" \
  --set-env-vars ALLOWED_ORIGIN_REGEX="$REGEX"

echo "Forcing new revision..." >&2
az containerapp update \
  --resource-group "$RG" \
  --name "$APP" \
  --set-env-vars REVISION_TRIGGER="$(date +%s)"

echo "Waiting for revision to become healthy (best-effort)..." >&2
if [[ -f "$(dirname "$0")/wait_revision_healthy.sh" ]]; then
  "$(dirname "$0")/wait_revision_healthy.sh" --app "$APP" --resource-group "$RG" || true
fi

echo "Done. Consider running scripts/post_deploy_smoke.sh to validate endpoints." >&2
