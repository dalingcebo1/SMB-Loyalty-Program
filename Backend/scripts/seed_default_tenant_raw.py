#!/usr/bin/env python3
"""
Simple script to seed default tenant using raw SQL to avoid model mismatches.
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add Backend to path for imports
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.core.database import DATABASE_URL
from config import settings

def seed_default_tenant_raw():
    """Create default tenant using raw SQL to avoid model schema mismatches."""
    print(f"Connecting to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'local'}")
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if default tenant exists
        result = conn.execute(text("SELECT id, name FROM tenants WHERE id = :tenant_id"), 
                            {"tenant_id": settings.default_tenant})
        existing_tenant = result.fetchone()
        
        if existing_tenant:
            print(f"✅ Default tenant '{settings.default_tenant}' already exists")
            print(f"   Name: {existing_tenant[1]}")
            return
        
        # Insert default tenant with only required fields
        conn.execute(text("""
            INSERT INTO tenants (id, name, display_name, vertical_type, config, created_by)
            VALUES (:id, :name, :display_name, :vertical_type, :config, :created_by)
        """), {
            "id": settings.default_tenant,
            "name": "Default Tenant", 
            "display_name": "Default",
            "vertical_type": "general",
            "config": "{}",
            "created_by": "system"
        })
        
        conn.commit()
        
        print(f"✅ Created default tenant '{settings.default_tenant}'")
        print(f"   Name: Default Tenant")
        print(f"   Display Name: Default")

if __name__ == "__main__":
    try:
        seed_default_tenant_raw()
    except Exception as e:
        print(f"❌ Error seeding default tenant: {e}")
        sys.exit(1)