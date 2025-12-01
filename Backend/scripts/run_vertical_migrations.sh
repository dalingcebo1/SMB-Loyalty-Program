#!/bin/bash
#
# Run Vertical-Specific Migrations
#
# Usage:
#   ./scripts/run_vertical_migrations.sh <vertical_name>
#   ./scripts/run_vertical_migrations.sh carwash
#   ./scripts/run_vertical_migrations.sh all
#

set -e

cd "$(dirname "$0")/.."

VERTICAL=$1

if [ -z "$VERTICAL" ]; then
    echo "Usage: $0 <vertical_name|all>"
    echo "Available verticals: carwash, dispensary, padel, flowershop, beauty"
    exit 1
fi

echo "🔄 Running vertical-specific migrations..."

# Activate virtual environment if exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Run migrations for specific vertical
if [ "$VERTICAL" = "all" ]; then
    echo "📦 Running migrations for all verticals..."
    
    for vertical_dir in app/verticals/*/migrations; do
        if [ -d "$vertical_dir" ]; then
            vertical_name=$(basename $(dirname "$vertical_dir"))
            echo "  → $vertical_name"
            
            # Run alembic upgrade for this vertical
            python -c "
from alembic import command
from alembic.config import Config
from pathlib import Path

# Find migration files
migration_dir = Path('$vertical_dir')
migration_files = sorted(migration_dir.glob('*.py'))
migration_files = [f for f in migration_files if not f.name.startswith('__')]

for migration_file in migration_files:
    print(f'  Executing: {migration_file.name}')
    # Import and execute migration
    import importlib.util
    spec = importlib.util.spec_from_file_location('migration', migration_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    if hasattr(module, 'upgrade'):
        try:
            module.upgrade()
            print(f'  ✓ {migration_file.name} applied')
        except Exception as e:
            print(f'  ✗ {migration_file.name} failed: {e}')
"
        fi
    done
else
    echo "📦 Running migrations for vertical: $VERTICAL..."
    
    MIGRATION_DIR="app/verticals/$VERTICAL/migrations"
    
    if [ ! -d "$MIGRATION_DIR" ]; then
        echo "❌ Vertical '$VERTICAL' not found or has no migrations"
        exit 1
    fi
    
    # Run Python migration executor
    python -c "
from pathlib import Path
from sqlalchemy import create_engine
from database import SessionLocal
from config import settings
import importlib.util

migration_dir = Path('$MIGRATION_DIR')
migration_files = sorted(migration_dir.glob('*.py'))
migration_files = [f for f in migration_files if not f.name.startswith('__')]

print(f'Found {len(migration_files)} migration(s)')

db = SessionLocal()
try:
    for migration_file in migration_files:
        print(f'Executing: {migration_file.name}')
        
        # Import migration module
        spec = importlib.util.spec_from_file_location('migration', migration_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        if hasattr(module, 'upgrade'):
            try:
                module.upgrade()
                print(f'✓ {migration_file.name} applied successfully')
            except Exception as e:
                print(f'✗ {migration_file.name} failed: {e}')
                raise
finally:
    db.close()
"
fi

echo "✅ Vertical migrations complete!"
