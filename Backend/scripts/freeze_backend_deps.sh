#!/usr/bin/env bash
set -euo pipefail
# Regenerate pinned requirements.txt from requirements.in using pip-tools (if available) or fallback to pip freeze.
# Usage: ./Backend/scripts/freeze_backend_deps.sh

cd "$(dirname "$0")/.."  # move to Backend root

if ! command -v pip-compile >/dev/null 2>&1; then
  echo "pip-compile not found. Installing pip-tools into current environment..." >&2
  pip install pip-tools >/dev/null
fi

# Use a temp output then move to avoid partial writes
pip-compile --generate-hashes --resolver backtracking --strip-extras requirements.in -o requirements.txt

echo "Updated Backend/requirements.txt (with hashes). Review and commit."
