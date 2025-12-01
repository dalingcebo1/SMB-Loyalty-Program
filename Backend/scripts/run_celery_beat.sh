#!/bin/bash
#
# Start Celery Beat (Periodic Task Scheduler)
#
# Usage:
#   ./scripts/run_celery_beat.sh
#

set -e

cd "$(dirname "$0")/.."

echo "⏰ Starting Celery Beat..."

# Activate virtual environment if exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Run celery beat for periodic tasks
celery -A app.workers.celery_app beat \
    --loglevel=info \
    --scheduler celery.beat:PersistentScheduler
