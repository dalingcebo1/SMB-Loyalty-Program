#!/usr/bin/env bash
set -euo pipefail

# Sync VITE_* keys from a .env file to GitHub repo Variables (default) or Secrets.
#
# Requirements:
# - gh CLI installed and authenticated (gh auth login)
# - repo write access for setting variables/secrets
#
# Usage examples:
#   ./scripts/sync_frontend_vite_env_to_github.sh                      # uses current repo, Frontend/.env, mode=vars
#   ./scripts/sync_frontend_vite_env_to_github.sh --mode secrets       # set as Secrets instead of Variables
#   ./scripts/sync_frontend_vite_env_to_github.sh --env Frontend/.env.prod --repo owner/name
#
# Notes:
# - Firebase Web config values are client-side (public) config; Variables are fine.
# - If you prefer Secrets, use --mode secrets (workflows already fall back to secrets).

MODE="vars"                          # vars | secrets
ENV_FILE="Frontend/.env"             # path to .env
REPO=""                               # owner/name; if empty, derive from git

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"; shift 2;;
    --env|--env-file)
      ENV_FILE="$2"; shift 2;;
    --repo)
      REPO="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--mode vars|secrets] [--env Frontend/.env] [--repo owner/name]"; exit 0;;
    *)
      echo "Unknown arg: $1"; exit 1;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

# Ensure we have auth; non-zero exit means not logged in
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [[ -z "$REPO" ]]; then
  # Try infer from git remote
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    origin_url=$(git config --get remote.origin.url || true)
    # Support both SSH and HTTPS forms
    if [[ "$origin_url" =~ github.com[:/](.+/.+?)(\.git)?$ ]]; then
      REPO="${BASH_REMATCH[1]}"
    fi
  fi
fi

if [[ -z "$REPO" ]]; then
  echo "Error: Could not determine repo. Provide --repo owner/name" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Env file not found: $ENV_FILE" >&2
  exit 1
fi

echo "Repo: $REPO"
echo "Mode: $MODE"
echo "Env file: $ENV_FILE"

declare -A KV
while IFS= read -r line || [[ -n "$line" ]]; do
  # skip comments/blank
  [[ -z "${line//[[:space:]]/}" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ ^[[:space:]]*(VITE_[A-Z0-9_]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    # Trim surrounding quotes if present
    if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:${#val}-2}"; fi
    if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:${#val}-2}"; fi
    KV["$key"]="$val"
  fi
done < "$ENV_FILE"

if [[ ${#KV[@]} -eq 0 ]]; then
  echo "No VITE_* keys found in $ENV_FILE" >&2
  exit 1
fi

echo "Keys to set: ${!KV[@]}"

for key in "${!KV[@]}"; do
  val="${KV[$key]}"
  if [[ -z "$val" ]]; then
    echo "Skipping $key (empty value)"
    continue
  fi
  if [[ "$MODE" == "vars" ]]; then
    echo "Setting Variable: $key"
    gh repo variable set "$key" --repo "$REPO" --body "$val"
  else
    echo "Setting Secret: $key"
    gh secret set "$key" --repo "$REPO" --body "$val"
  fi
done

echo "Done. Variables/Secrets updated."
