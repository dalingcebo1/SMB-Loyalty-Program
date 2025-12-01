#!/usr/bin/env python3
"""Generate OpenAPI snapshot for testing."""
import sys
import os
import json
import logging

# Disable all logging
logging.disable(logging.CRITICAL)

# Set environment variables to prevent metrics duplication
os.environ['PYTEST_CURRENT_TEST'] = '1'
os.environ['LOG_LEVEL'] = 'CRITICAL'

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import main app
import main

# Generate OpenAPI spec
spec = main.app.openapi()
spec.pop('_requires_init', None)

# Write to snapshot file
snapshot_path = os.path.join(os.path.dirname(__file__), '../tests/openapi_snapshot.json')
with open(snapshot_path, 'w') as f:
    json.dump(spec, f, indent=2)

print(f"✅ OpenAPI snapshot generated successfully at {snapshot_path}")
