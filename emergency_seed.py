#!/usr/bin/env python3
"""
Emergency tenant seeding script to run directly in production container
"""

import json
from datetime import datetime

# Minimal DB setup using environment variables
import os
db_url = os.environ['DATABASE_URL']
print(f"DB URL: {db_url[:30]}...")

try:
    import psycopg2
    
    # Parse database URL and connect
    if db_url.startswith('postgresql+psycopg2://'):
        db_url = db_url.replace('postgresql+psycopg2://', 'postgresql://')
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    # Check if tenant exists
    cursor.execute("SELECT id FROM tenants WHERE id = %s", ('default',))
    if cursor.fetchone():
        print("✅ Default tenant already exists")
    else:
        # Insert tenant
        cursor.execute("""
            INSERT INTO tenants (id, name, loyalty_type, vertical_type, primary_domain, config, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            'default',
            'Default Tenant',
            'basic', 
            'carwash',
            'apismbloyaltyapp.redsky-09cfd59a.southafricanorth.azurecontainerapps.io',
            json.dumps({"theme_color": "#007bff"}),
            datetime.utcnow()
        ))
        
        conn.commit()
        print("✅ Default tenant created successfully")
    
    cursor.close()
    conn.close()
    print("Done!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()