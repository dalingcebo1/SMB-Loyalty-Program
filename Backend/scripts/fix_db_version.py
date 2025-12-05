import os
import sys
from sqlalchemy import create_engine, text
from config import settings

def fix_version():
    """
    Force sets the alembic version to '79b1837424d4' (the parent of our new migration).
    This fixes the 'Can't locate revision' error caused by a zombie migration.
    """
    print(f"Connecting to database: {settings.database_url.split('@')[1]}") # Hide password
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        # Check current version
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        current = result.scalar()
        print(f"Current DB Revision: {current}")
        
        if current == '20251111_vert_id_not_null':
            print("Found zombie revision. Resetting to '79b1837424d4'...")
            conn.execute(text("UPDATE alembic_version SET version_num = '79b1837424d4'"))
            conn.commit()
            print("Success! You can now run 'alembic upgrade head'.")
        elif current == 'ac2175519b17':
            print("Database is already up to date!")
        else:
            print(f"Warning: Unexpected revision '{current}'. Expected '20251111_vert_id_not_null' or '79b1837424d4'.")
            confirm = input("Do you want to force reset to '79b1837424d4'? (y/n): ")
            if confirm.lower() == 'y':
                conn.execute(text("UPDATE alembic_version SET version_num = '79b1837424d4'"))
                conn.commit()
                print("Reset complete.")

if __name__ == "__main__":
    fix_version()
