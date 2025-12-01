#!/bin/bash
#
# Start Flower (Celery Monitoring UI)
#
# Usage:
#   ./scripts/run_flower.sh
#
# Access UI at: http://localhost:5555
#

set -e

cd "$(dirname "$0")/.."

echo "🌸 Starting Flower (Celery Monitoring)..."

# Activate virtual environment if exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install flower if not already installed
if ! command -v celery flower &> /dev/null; then
    echo "📦 Installing Flower..."
    pip install flower
fi

# Run flower
celery -A app.workers.celery_app flower \
    --port=5555 \
    --broker_api=redis://localhost:6379/0
