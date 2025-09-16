#!/usr/bin/env bash
# Helper script to build, deploy, promote, and verify the Backend Container App.
# Safe to source or execute. Requires: az CLI (with containerapp extension), git, openssl (for secret generation option).
# Does NOT print secret values; only lengths / masked preview.

set -euo pipefail

# Defaults (override via env or flags)
RG_DEFAULT="SMB-Loyalty-Group"
APP_DEFAULT="apismbloyaltyapp"
ACR_DEFAULT="smblpcontainerregistry"
IMAGE_DEFAULT="smb-api"
TIMEOUT_DEFAULT=360
POLL_INTERVAL=8

usage() {
  cat <<'EOF'
Usage: scripts/containerapp_backend_helper.sh [options]

Actions:
  --build                 Build & push new image to ACR (remote az acr build)
  --deploy                Update container app to use image tag (build or provided)
  --promote               After healthy, route 100% traffic to new revision
  --verify                Run readiness curl + secret length check via exec
  --set-secrets           (Idempotent) ensure secretRefs exist (will not rotate existing)
  --rotate-secrets        Force rotate secretkey/jwtsecretkey/resetsecretkey with random values
  --run-migrations        Run Alembic upgrade head inside latest ready revision
  --dry-run               Show what would run without executing updates

Options:
  -g, --resource-group RG
  -a, --app-name NAME
  -r, --registry REGISTRY
  -i, --image-name NAME
  -t, --tag TAG           Explicit image tag (default: current commit SHA)
  -T, --timeout SECONDS   Max seconds to wait for healthy (default 360)

Examples:
  # Full typical flow (build, deploy, wait, promote, verify)
  scripts/containerapp_backend_helper.sh --build --deploy --promote --verify

  # Only redeploy current image (no rebuild) and verify
  scripts/containerapp_backend_helper.sh --deploy --verify

  # Rotate secrets then deploy new image
  scripts/containerapp_backend_helper.sh --rotate-secrets --build --deploy --promote --verify

Exit codes:
  0 success, non-zero on failure or timeout.
EOF
}

log() { echo "[INFO] $*" >&2; }
warn() { echo "[WARN] $*" >&2; }
err() { echo "[ERROR] $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

# Parse flags
BUILD=false
DEPLOY=false
PROMOTE=false
VERIFY=false
SET_SECRETS=false
ROTATE_SECRETS=false
RUN_MIGRATIONS=false
DRY_RUN=false

RG="$RG_DEFAULT"
APP="$APP_DEFAULT"
ACR="$ACR_DEFAULT"
IMAGE="$IMAGE_DEFAULT"
TAG=""
TIMEOUT="$TIMEOUT_DEFAULT"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) BUILD=true ; shift ;;
    --deploy) DEPLOY=true ; shift ;;
    --promote) PROMOTE=true ; shift ;;
    --verify) VERIFY=true ; shift ;;
    --set-secrets) SET_SECRETS=true ; shift ;;
    --rotate-secrets) ROTATE_SECRETS=true ; shift ;;
    --run-migrations) RUN_MIGRATIONS=true ; shift ;;
    --dry-run) DRY_RUN=true ; shift ;;
    -g|--resource-group) RG="$2"; shift 2 ;;
    -a|--app-name) APP="$2"; shift 2 ;;
    -r|--registry) ACR="$2"; shift 2 ;;
    -i|--image-name) IMAGE="$2"; shift 2 ;;
    -t|--tag) TAG="$2"; shift 2 ;;
    -T|--timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

need az
need git

if [[ -z "$TAG" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    TAG=$(git rev-parse --short=12 HEAD)
  else
    TAG=$(date +%Y%m%d%H%M%S)
  fi
fi

IMAGE_REF="${ACR}.azurecr.io/${IMAGE}:${TAG}"
log "Using image tag: $IMAGE_REF"

if $ROTATE_SECRETS && ! $SET_SECRETS; then
  SET_SECRETS=true
fi

random_secret() {
  # 48 bytes base64 (~64 chars) sanitized for typical env constraints
  openssl rand -base64 48 | tr -d '\n' | tr '/+=' 'xyz'
}

ensure_secrets() {
  local rotate=$1
  log "Ensuring secrets exist (rotate=$rotate)"
  # Fetch existing secrets list
  local existing; existing=$(az containerapp show -g "$RG" -n "$APP" --query 'properties.configuration.secrets[].name' -o tsv)
  local sk jwt rs
  if $rotate; then
    sk=$(random_secret); jwt=$(random_secret); rs=$(random_secret)
  else
    # Only create missing; else leave empty to skip
    [[ $existing =~ secretkey ]] || sk=$(random_secret)
    [[ $existing =~ jwtsecretkey ]] || jwt=$(random_secret)
    [[ $existing =~ resetsecretkey ]] || rs=$(random_secret)
  fi
  local args=()
  [[ -n $sk ]] && args+=(secretkey="$sk")
  [[ -n $jwt ]] && args+=(jwtsecretkey="$jwt")
  [[ -n $rs ]] && args+=(resetsecretkey="$rs")
  if ((${#args[@]})); then
    if $DRY_RUN; then
      log "DRY-RUN: would set secrets: ${args[*]}"
    else
      az containerapp secret set -g "$RG" -n "$APP" --secrets "${args[@]}"
      log "Secrets updated. A revision restart will occur on next deploy/update."
    fi
  else
    log "All secrets already present (no rotation)."
  fi
}

build_image() {
  log "Building image via ACR remote build"
  if $DRY_RUN; then
    log "DRY-RUN: az acr build -r $ACR -t $IMAGE_REF -f Backend/Dockerfile Backend"
  else
    az acr build -r "$ACR" -t "$IMAGE_REF" -f Backend/Dockerfile Backend
  fi
}

deploy_image() {
  log "Deploying image to Container App"
  if $DRY_RUN; then
    log "DRY-RUN: az containerapp update -g $RG -n $APP --image $IMAGE_REF --set-env-vars SECRET_KEY=secretref:secretkey JWT_SECRET=secretref:jwtsecretkey RESET_SECRET=secretref:resetsecretkey"
  else
    az containerapp update -g "$RG" -n "$APP" \
      --image "$IMAGE_REF" \
      --set-env-vars SECRET_KEY=secretref:secretkey JWT_SECRET=secretref:jwtsecretkey RESET_SECRET=secretref:resetsecretkey
  fi
}

wait_for_revision() {
  log "Waiting for new revision to become Running (timeout ${TIMEOUT}s)"
  local start now revName
  start=$(date +%s)
  # Get the latest revision name (changes after deploy)
  revName=$(az containerapp show -g "$RG" -n "$APP" --query properties.latestRevisionName -o tsv)
  while true; do
    now=$(date +%s)
    if (( now - start > TIMEOUT )); then
      err "Timeout waiting for revision $revName to become healthy"
    fi
    local status replicas
    status=$(az containerapp revision show -g "$RG" -n "$APP" --revision "$revName" --query properties.provisioningState -o tsv 2>/dev/null || echo unknown)
    replicas=$(az containerapp revision show -g "$RG" -n "$APP" --revision "$revName" --query properties.instances | grep -c 'name' || true)
    log "Revision $revName state=$status replicas=$replicas"
    if [[ "$status" == "Succeeded" && $replicas -ge 1 ]]; then
      echo "$revName"
      return 0
    fi
    sleep "$POLL_INTERVAL"
  done
}

promote_revision() {
  local rev=$1
  log "Promoting revision $rev to 100% traffic"
  if $DRY_RUN; then
    log "DRY-RUN: az containerapp ingress traffic set -g $RG -n $APP --revision-weight $rev=100"
  else
    az containerapp ingress traffic set -g "$RG" -n "$APP" --revision-weight "$rev=100"
  fi
}

run_migrations() {
  local rev=$1
  log "Running Alembic migrations in revision $rev"
  if $DRY_RUN; then
    log "DRY-RUN: az containerapp exec -g $RG -n $APP --revision $rev --command 'alembic -c alembic.ini upgrade head'"
  else
    az containerapp exec -g "$RG" -n "$APP" --revision "$rev" --command "alembic -c alembic.ini upgrade head"
  fi
}

verify_runtime() {
  local rev=$1
  log "Verifying runtime (health + secret length)"
  local fqdn
  fqdn=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
  if $DRY_RUN; then
    log "DRY-RUN: curl https://$fqdn/health/ready"
  else
    set +e
    local code
    code=$(curl -k -s -o /dev/null -w '%{http_code}' "https://$fqdn/health/ready" || echo 000)
    log "/health/ready HTTP $code"
    set -e
    if [[ $code != 200 ]]; then
      warn "Readiness endpoint not returning 200 (code=$code). Check logs." 
    fi
    # Exec to get secret length (mask output)
    local secret_output
    secret_output=$(az containerapp exec -g "$RG" -n "$APP" --revision "$rev" --command "python -c 'from Backend.config import get_settings; s=get_settings(); print(len(s.loyalty_secret), s.loyalty_secret[:6])'" 2>/dev/null || true)
    log "loyalty_secret length+prefix: $secret_output"
  fi
}

main() {
  $SET_SECRETS && ensure_secrets false
  $ROTATE_SECRETS && ensure_secrets true
  $BUILD && build_image
  local new_rev=""
  if $DEPLOY; then
    deploy_image
    new_rev=$(wait_for_revision)
    log "New revision: $new_rev"
  else
    # If not deploying, still capture latest for verify/promote
    new_rev=$(az containerapp show -g "$RG" -n "$APP" --query properties.latestRevisionName -o tsv)
  fi
  if $RUN_MIGRATIONS && [[ -n $new_rev ]]; then
    run_migrations "$new_rev"
  fi
  if $PROMOTE && [[ -n $new_rev ]]; then
    promote_revision "$new_rev"
  fi
  if $VERIFY && [[ -n $new_rev ]]; then
    verify_runtime "$new_rev"
  fi
  log "Done"
}

main "$@"
