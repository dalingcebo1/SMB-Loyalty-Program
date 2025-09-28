#!/usr/bin/env python3
"""
Production tenant seeding script - to be run inside the container.
"""

from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL")
DEFAULT_TENANT = "default"

def main():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check what columns exist in tenants table
        print("Checking tenants table structure...")
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'tenants' 
            ORDER BY ordinal_position
        """))
        columns = [row[0] for row in result.fetchall()]
        print(f"Available columns: {columns}")
        
        # Check if default tenant exists
        result = conn.execute(text("SELECT id, name FROM tenants WHERE id = :tenant_id"), 
                            {"tenant_id": DEFAULT_TENANT})
        existing_tenant = result.fetchone()
        
        if existing_tenant:
            print(f"✅ Default tenant '{DEFAULT_TENANT}' already exists")
            return
        
        # Insert with minimal required columns only
        basic_columns = ["id", "name", "vertical_type", "config"]
        available_columns = [col for col in basic_columns if col in columns]
        
        if "created_by" in columns:
            available_columns.append("created_by")
        
        column_list = ", ".join(available_columns)
        values_list = ", ".join([f":{col}" for col in available_columns])
        
        insert_data = {
            "id": DEFAULT_TENANT,
            "name": "Default Tenant",
            "vertical_type": "general",
            "config": "{}"
        }
        
        if "created_by" in available_columns:
            insert_data["created_by"] = "system"
        
        conn.execute(text(f"INSERT INTO tenants ({column_list}) VALUES ({values_list})"), 
                    insert_data)
        conn.commit()
        
        print(f"✅ Created default tenant '{DEFAULT_TENANT}'")

if __name__ == "__main__":
    main()