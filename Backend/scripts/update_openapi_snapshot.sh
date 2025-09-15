#!/usr/bin/env bash
set -euo pipefail

# Regenerate OpenAPI snapshot in a controlled way.
# Usage: ./Backend/scripts/update_openapi_snapshot.sh
# Optionally set ENVIRONMENT to influence config (defaults to development).

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export ENVIRONMENT="${ENVIRONMENT:-development}"
mkdir -p static  # ensure static dir exists for app mounting

PYTHONPATH=. python scripts/dump_openapi.py > tests/openapi_snapshot.json

# Remove any placeholder keys if previously present
if grep -q '"_requires_init"' tests/openapi_snapshot.json; then
  echo "[WARN] Placeholder marker still present; manual cleanup required." >&2
fi

echo "OpenAPI snapshot updated: Backend/tests/openapi_snapshot.json"
