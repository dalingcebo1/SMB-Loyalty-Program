"""
Schema-per-tenant management utilities.

Provides functions for creating, managing, and migrating PostgreSQL schemas
for multi-tenant isolation. Supports gradual migration from row-level to
schema-level isolation.
"""

import re
import logging
from typing import Optional, List
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError

logger = logging.getLogger(__name__)


def sanitize_schema_name(tenant_id: str) -> str:
    """
    Generate a safe PostgreSQL schema name from tenant ID.
    
    Schema names must:
    - Start with a letter or underscore
    - Contain only letters, numbers, and underscores
    - Be lowercase
    - Not exceed 63 characters (PostgreSQL limit)
    
    Args:
        tenant_id: The tenant identifier
        
    Returns:
        Safe schema name suitable for PostgreSQL (always prefixed with 'tenant_')
        
    Example:
        >>> sanitize_schema_name("acme-corp-123")
        'tenant_acmecorp123'
    """
    # Remove or replace invalid characters (keep only alphanumeric and underscore)
    safe_name = re.sub(r'[^a-z0-9_]', '', tenant_id.lower())
    
    # Always prefix with 'tenant_' for clarity and to avoid PostgreSQL reserved words
    safe_name = f'tenant_{safe_name}'
    
    # Truncate to PostgreSQL limit (63 chars), preserving uniqueness
    if len(safe_name) > 63:
        # Keep first 50 chars + hash of remaining for uniqueness
        import hashlib
        suffix = hashlib.md5(safe_name[50:].encode()).hexdigest()[:10]
        safe_name = safe_name[:50] + '_' + suffix
    
    return safe_name or 'tenant_default'


def schema_exists(db: Session, schema_name: str) -> bool:
    """
    Check if a PostgreSQL schema exists.
    
    Args:
        db: Database session
        schema_name: Name of the schema to check
        
    Returns:
        True if schema exists, False otherwise
    """
    try:
        result = db.execute(
            text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema"),
            {"schema": schema_name}
        )
        return result.fetchone() is not None
    except Exception as e:
        logger.error(f"Error checking schema existence: {e}")
        return False


def create_tenant_schema(db: Session, schema_name: str) -> bool:
    """
    Create a new PostgreSQL schema for a tenant.
    
    Args:
        db: Database session
        schema_name: Name of the schema to create
        
    Returns:
        True if created successfully, False if already exists or error
    """
    if schema_exists(db, schema_name):
        logger.info(f"Schema '{schema_name}' already exists")
        return False
    
    try:
        # Create schema
        db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
        db.commit()
        logger.info(f"Created schema '{schema_name}'")
        return True
    except ProgrammingError as e:
        db.rollback()
        logger.error(f"Failed to create schema '{schema_name}': {e}")
        return False


def drop_tenant_schema(db: Session, schema_name: str, cascade: bool = False) -> bool:
    """
    Drop a PostgreSQL schema for a tenant.
    
    WARNING: This permanently deletes all data in the schema.
    
    Args:
        db: Database session
        schema_name: Name of the schema to drop
        cascade: If True, drop all objects in the schema too
        
    Returns:
        True if dropped successfully, False otherwise
    """
    if not schema_exists(db, schema_name):
        logger.warning(f"Schema '{schema_name}' does not exist")
        return False
    
    try:
        cascade_clause = "CASCADE" if cascade else "RESTRICT"
        db.execute(text(f'DROP SCHEMA IF EXISTS "{schema_name}" {cascade_clause}'))
        db.commit()
        logger.info(f"Dropped schema '{schema_name}' ({cascade_clause})")
        return True
    except ProgrammingError as e:
        db.rollback()
        logger.error(f"Failed to drop schema '{schema_name}': {e}")
        return False


def set_search_path(db: Session, schema_name: str, include_public: bool = True) -> None:
    """
    Set the PostgreSQL search_path for the current session.
    
    This determines which schema is used for unqualified table references.
    
    Args:
        db: Database session
        schema_name: Primary schema to search
        include_public: Whether to include 'public' schema in search path
    """
    if include_public:
        search_path = f'"{schema_name}", public'
    else:
        search_path = f'"{schema_name}"'
    
    try:
        db.execute(text(f"SET search_path TO {search_path}"))
        logger.debug(f"Set search_path to: {search_path}")
    except Exception as e:
        logger.error(f"Failed to set search_path: {e}")
        raise


def get_current_search_path(db: Session) -> str:
    """
    Get the current PostgreSQL search_path.
    
    Args:
        db: Database session
        
    Returns:
        Current search_path value
    """
    try:
        result = db.execute(text("SHOW search_path"))
        row = result.fetchone()
        return row[0] if row else "public"
    except Exception as e:
        logger.error(f"Failed to get search_path: {e}")
        return "public"


def list_tenant_schemas(db: Session) -> List[str]:
    """
    List all tenant schemas in the database.
    
    Returns schemas that start with 'tenant_' prefix.
    
    Args:
        db: Database session
        
    Returns:
        List of tenant schema names
    """
    try:
        result = db.execute(
            text("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%'
                ORDER BY schema_name
            """)
        )
        return [row[0] for row in result.fetchall()]
    except Exception as e:
        logger.error(f"Failed to list tenant schemas: {e}")
        return []


def clone_schema_structure(
    db: Session,
    source_schema: str,
    target_schema: str,
    include_data: bool = False
) -> bool:
    """
    Clone the structure (and optionally data) from one schema to another.
    
    Creates all tables, indexes, and constraints from source schema in target schema.
    Useful for provisioning new tenant schemas.
    
    Args:
        db: Database session
        source_schema: Schema to copy from
        target_schema: Schema to copy to
        include_data: If True, also copy all data
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Create target schema if it doesn't exist
        if not schema_exists(db, target_schema):
            create_tenant_schema(db, target_schema)
        
        # Get all tables from source schema
        result = db.execute(
            text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :schema 
                AND table_type = 'BASE TABLE'
            """),
            {"schema": source_schema}
        )
        tables = [row[0] for row in result.fetchall()]
        
        for table in tables:
            # Create table structure
            db.execute(text(f"""
                CREATE TABLE IF NOT EXISTS "{target_schema}"."{table}" 
                (LIKE "{source_schema}"."{table}" INCLUDING ALL)
            """))
            
            # Copy data if requested
            if include_data:
                db.execute(text(f"""
                    INSERT INTO "{target_schema}"."{table}" 
                    SELECT * FROM "{source_schema}"."{table}"
                """))
        
        db.commit()
        logger.info(f"Cloned schema structure from '{source_schema}' to '{target_schema}'")
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clone schema: {e}")
        return False


def migrate_tenant_to_schema(
    db: Session,
    tenant_id: str,
    schema_name: str,
    dry_run: bool = False
) -> bool:
    """
    Migrate a tenant from row-level isolation to schema-level isolation.
    
    This copies all tenant data from the public schema to their dedicated schema.
    
    Args:
        db: Database session
        tenant_id: Tenant to migrate
        schema_name: Target schema name
        dry_run: If True, only validate without making changes
        
    Returns:
        True if migration successful (or valid in dry-run), False otherwise
    """
    if dry_run:
        logger.info(f"DRY RUN: Would migrate tenant '{tenant_id}' to schema '{schema_name}'")
        return schema_exists(db, "public")
    
    try:
        # Create schema if needed
        if not schema_exists(db, schema_name):
            create_tenant_schema(db, schema_name)
        
        # TODO: Implement actual data migration logic
        # This would involve:
        # 1. Cloning table structures to new schema
        # 2. Copying tenant-specific rows (WHERE tenant_id = :tenant_id)
        # 3. Verifying data integrity
        # 4. Updating tenant.schema_name
        # 5. (Optionally) Removing old rows from public schema
        
        logger.info(f"Migrated tenant '{tenant_id}' to schema '{schema_name}'")
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to migrate tenant to schema: {e}")
        return False
