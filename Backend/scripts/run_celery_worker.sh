#!/bin/bash
#
# Start Celery Worker
#
# Usage:
#   ./scripts/run_celery_worker.sh
#

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting Celery Worker..."

# Activate virtual environment if exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Run celery worker with auto-reload for development
celery -A app.workers.celery_app worker \
    --loglevel=info \
    --pool=prefork \
    --concurrency=4 \
    --max-tasks-per-child=100 \
    --task-events \
    --without-gossip \
    --without-mingle \
    --without-heartbeat
