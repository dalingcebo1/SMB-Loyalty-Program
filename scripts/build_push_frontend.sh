#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} == "" ]]; then
  echo "Usage: $0 <version-tag>" >&2
  exit 1
fi
VERSION="$1"
IMAGE="ghcr.io/${GITHUB_REPOSITORY_OWNER:-dalingcebo1}/smb-loyalty-frontend"
CONTEXT_DIR=${CONTEXT_DIR:-Frontend}
DOCKERFILE=${DOCKERFILE:-Frontend/Dockerfile}

echo "Installing deps (CI-style)"
( cd "$CONTEXT_DIR" && npm ci )

echo "Building production bundle"
( cd "$CONTEXT_DIR" && npm run build )

echo "Building image: $IMAGE:$VERSION"
docker build -t "$IMAGE:$VERSION" -f "$DOCKERFILE" "$CONTEXT_DIR"

echo "Tagging latest"
docker tag "$IMAGE:$VERSION" "$IMAGE:latest"

echo "Pushing..."
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"

echo "Done: $IMAGE:$VERSION"
