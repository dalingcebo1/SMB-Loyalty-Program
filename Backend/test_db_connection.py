#!/usr/bin/env python3
"""Quick database connection test for local PostgreSQL setup."""

from app.core.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        # Test basic query
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        
        # Count tables
        result = conn.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        table_count = result.fetchone()[0]
        
        # Count services
        result = conn.execute(text("SELECT COUNT(*) FROM services"))
        service_count = result.fetchone()[0]
        
        print("✅ Database Connection Successful!")
        print(f"   PostgreSQL: {version.split(',')[0]}")
        print(f"   Tables: {table_count}")
        print(f"   Services: {service_count}")
        print(f"   URL: {engine.url}")
        
except Exception as e:
    print(f"❌ Database Connection Failed: {e}")
    exit(1)
