#!/usr/bin/env python3
"""
Script to seed the default tenant if it doesn't exist.
This fixes the production 500 error on /api/public/tenant-meta.
"""

import os
import sys
from pathlib import Path

# Add Backend to path for imports
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.database import DATABASE_URL
from app.models import Tenant
from config import settings

def seed_default_tenant():
    """Create default tenant if it doesn't exist."""
    print(f"Connecting to: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'local'}")
    
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    with SessionLocal() as session:
        # Check if default tenant exists
        existing_tenant = session.query(Tenant).filter(Tenant.id == settings.default_tenant).first()
        
        if existing_tenant:
            print(f"✅ Default tenant '{settings.default_tenant}' already exists")
            print(f"   Name: {existing_tenant.name}")
            return
        
        # Create default tenant
        default_tenant = Tenant(
            id=settings.default_tenant,
            name="Default Tenant",
            display_name="Default",
            vertical_type="general",
            config={},
            created_by="system"
        )
        
        session.add(default_tenant)
        session.commit()
        
        print(f"✅ Created default tenant '{settings.default_tenant}'")
        print(f"   Name: {default_tenant.name}")
        print(f"   Display Name: {default_tenant.display_name}")

if __name__ == "__main__":
    try:
        seed_default_tenant()
    except Exception as e:
        print(f"❌ Error seeding default tenant: {e}")
        sys.exit(1)