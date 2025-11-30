#!/usr/bin/env python3
"""Seed tenant_domains table with default mappings.

Usage:
    python scripts/seed_tenant_domains.py

Environment variables:
    DATABASE_URL - connection string (defaults to settings.database_url)
"""
import sys
from pathlib import Path

# Add Backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.core.database import engine
from app.models import TenantDomain, Tenant
from datetime import datetime
from config import settings


def seed_domains():
    """Add default tenant domain mappings."""
    with Session(engine) as db:
        # Check if default tenant exists
        default_tenant = db.query(Tenant).filter_by(id=settings.default_tenant).first()
        if not default_tenant:
            print(f"❌ Default tenant '{settings.default_tenant}' not found. Run seed script first.")
            return
        
        # Define domain mappings
        domains_to_add = [
            {
                "tenant_id": settings.default_tenant,
                "domain": "orange-pond-06eea490f.3.azurestaticapps.net",
                "is_primary": False,
                "environment": "dev",
            },
            {
                "tenant_id": settings.default_tenant,
                "domain": "localhost:5173",
                "is_primary": False,
                "environment": "local",
            },
            {
                "tenant_id": settings.default_tenant,
                "domain": "127.0.0.1:5173",
                "is_primary": False,
                "environment": "local",
            },
        ]
        
        added_count = 0
        for domain_data in domains_to_add:
            # Check if domain already exists
            existing = db.query(TenantDomain).filter_by(domain=domain_data["domain"]).first()
            if existing:
                print(f"⏭️  Domain '{domain_data['domain']}' already exists, skipping")
                continue
            
            # Create new domain mapping
            new_domain = TenantDomain(
                tenant_id=domain_data["tenant_id"],
                domain=domain_data["domain"],
                is_primary=domain_data["is_primary"],
                environment=domain_data["environment"],
                created_at=datetime.utcnow(),
            )
            db.add(new_domain)
            added_count += 1
            print(f"✅ Added domain: {domain_data['domain']} -> {domain_data['tenant_id']} ({domain_data['environment']})")
        
        db.commit()
        print(f"\n🎉 Seeding complete! Added {added_count} new domain mappings.")
        
        # Display all domains
        print("\n📋 Current domain mappings:")
        all_domains = db.query(TenantDomain).all()
        for td in all_domains:
            primary_marker = " [PRIMARY]" if td.is_primary else ""
            env_marker = f" ({td.environment})" if td.environment else ""
            print(f"   {td.domain} -> {td.tenant_id}{env_marker}{primary_marker}")


if __name__ == "__main__":
    seed_domains()
