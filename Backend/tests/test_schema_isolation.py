"""Integration tests for schema-per-tenant isolation.

Tests the schema management utilities and TenantContext schema support.
These tests verify:
1. Schema creation and deletion
2. Schema name sanitization
3. Search path switching
4. TenantContext schema isolation awareness
5. Dual-mode support (row-level vs schema-level)
"""
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.core.schema_manager import (
    sanitize_schema_name,
    schema_exists,
    create_tenant_schema,
    drop_tenant_schema,
    set_search_path,
    get_current_search_path,
    list_tenant_schemas,
)
from app.core.tenant_context import TenantContext
from app.models import Tenant


@pytest.fixture
def db_session():
    """Provide a database session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_tenant(db_session: Session):
    """Create a test tenant with schema isolation."""
    tenant = Tenant(
        id="test_schema_tenant",
        name="Test Schema Tenant",
        schema_name="tenant_test_schema_001",
        loyalty_type="standard",
        primary_domain="test-schema.example.com",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    yield tenant
    # Cleanup
    db_session.delete(tenant)
    db_session.commit()


@pytest.fixture
def legacy_tenant(db_session: Session):
    """Create a legacy tenant without schema isolation."""
    tenant = Tenant(
        id="legacy_tenant",
        name="Legacy Tenant",
        schema_name=None,  # Row-level isolation
        loyalty_type="standard",
        primary_domain="legacy.example.com",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    yield tenant
    # Cleanup
    db_session.delete(tenant)
    db_session.commit()


class TestSchemaNameSanitization:
    """Test schema name sanitization and validation."""

    def test_sanitize_basic_tenant_id(self):
        """Test sanitization of simple tenant ID."""
        result = sanitize_schema_name("abc123")
        assert result == "tenant_abc123"

    def test_sanitize_removes_special_chars(self):
        """Test that special characters are removed."""
        result = sanitize_schema_name("test-tenant@123!")
        # Special chars removed, not replaced with underscore
        assert result == "tenant_testtenant123"
        assert "-" not in result
        assert "@" not in result
        assert "!" not in result

    def test_sanitize_preserves_underscores(self):
        """Test that underscores are preserved."""
        result = sanitize_schema_name("test_tenant_001")
        assert result == "tenant_test_tenant_001"

    def test_sanitize_lowercase(self):
        """Test that result is lowercase."""
        result = sanitize_schema_name("TestTenant")
        assert result == "tenant_testtenant"

    def test_sanitize_empty_string(self):
        """Test handling of empty tenant ID."""
        result = sanitize_schema_name("")
        assert result == "tenant_"


class TestSchemaOperations:
    """Test schema creation, existence checks, and deletion."""

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_schema_exists_false(self, db_session: Session):
        """Test schema_exists returns False for non-existent schema."""
        result = schema_exists(db_session, "tenant_nonexistent_999")
        assert result is False

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_create_and_check_schema(self, db_session: Session):
        """Test creating a schema and verifying existence."""
        schema_name = "tenant_test_create_001"
        
        # Schema should not exist initially
        assert not schema_exists(db_session, schema_name)
        
        # Create schema
        create_tenant_schema(db_session, schema_name)
        
        # Schema should now exist
        assert schema_exists(db_session, schema_name)
        
        # Cleanup
        drop_tenant_schema(db_session, schema_name, cascade=True)

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_drop_schema(self, db_session: Session):
        """Test dropping a schema."""
        schema_name = "tenant_test_drop_001"
        
        # Create schema
        create_tenant_schema(db_session, schema_name)
        assert schema_exists(db_session, schema_name)
        
        # Drop schema
        drop_tenant_schema(db_session, schema_name, cascade=False)
        
        # Schema should no longer exist
        assert not schema_exists(db_session, schema_name)

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_drop_schema_with_cascade(self, db_session: Session):
        """Test dropping a schema with cascade option."""
        schema_name = "tenant_test_cascade_001"
        
        # Create schema and add a table
        create_tenant_schema(db_session, schema_name)
        db_session.execute(text(f"CREATE TABLE {schema_name}.test_table (id INTEGER)"))
        db_session.commit()
        
        # Drop schema with cascade
        drop_tenant_schema(db_session, schema_name, cascade=True)
        
        # Schema should be gone
        assert not schema_exists(db_session, schema_name)

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_create_duplicate_schema_safe(self, db_session: Session):
        """Test that creating duplicate schema is safe (idempotent)."""
        schema_name = "tenant_test_duplicate_001"
        
        # Create schema twice
        create_tenant_schema(db_session, schema_name)
        create_tenant_schema(db_session, schema_name)  # Should not raise error
        
        # Schema should exist
        assert schema_exists(db_session, schema_name)
        
        # Cleanup
        drop_tenant_schema(db_session, schema_name, cascade=True)


class TestSearchPath:
    """Test PostgreSQL search_path operations."""

    @pytest.mark.skip(reason="SQLite doesn't support search_path")
    def test_set_search_path(self, db_session: Session):
        """Test setting search_path for a session."""
        schema_name = "tenant_test_path_001"
        
        # Create schema
        create_tenant_schema(db_session, schema_name)
        
        # Set search_path
        set_search_path(db_session, schema_name)
        
        # Verify search_path
        current_path = get_current_search_path(db_session)
        assert schema_name in current_path
        
        # Cleanup
        drop_tenant_schema(db_session, schema_name, cascade=True)

    @pytest.mark.skip(reason="SQLite doesn't support search_path")
    def test_get_current_search_path(self, db_session: Session):
        """Test getting current search_path."""
        current_path = get_current_search_path(db_session)
        assert current_path is not None
        assert isinstance(current_path, str)

    @pytest.mark.skip(reason="SQLite doesn't support search_path")
    def test_search_path_isolation(self, db_session: Session):
        """Test that search_path isolates queries to schema."""
        schema1 = "tenant_test_isolation_001"
        schema2 = "tenant_test_isolation_002"
        
        # Create two schemas
        create_tenant_schema(db_session, schema1)
        create_tenant_schema(db_session, schema2)
        
        # Create table in schema1
        set_search_path(db_session, schema1)
        db_session.execute(text("CREATE TABLE test_table (id INTEGER, value TEXT)"))
        db_session.execute(text("INSERT INTO test_table VALUES (1, 'schema1')"))
        db_session.commit()
        
        # Create table in schema2
        set_search_path(db_session, schema2)
        db_session.execute(text("CREATE TABLE test_table (id INTEGER, value TEXT)"))
        db_session.execute(text("INSERT INTO test_table VALUES (1, 'schema2')"))
        db_session.commit()
        
        # Query from schema1
        set_search_path(db_session, schema1)
        result1 = db_session.execute(text("SELECT value FROM test_table WHERE id = 1")).scalar()
        assert result1 == "schema1"
        
        # Query from schema2
        set_search_path(db_session, schema2)
        result2 = db_session.execute(text("SELECT value FROM test_table WHERE id = 1")).scalar()
        assert result2 == "schema2"
        
        # Cleanup
        drop_tenant_schema(db_session, schema1, cascade=True)
        drop_tenant_schema(db_session, schema2, cascade=True)


class TestListTenantSchemas:
    """Test listing tenant schemas."""

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_list_tenant_schemas_empty(self, db_session: Session):
        """Test listing when no tenant schemas exist."""
        # Clean up any existing tenant schemas first
        schemas = list_tenant_schemas(db_session)
        for schema in schemas:
            drop_tenant_schema(db_session, schema, cascade=True)
        
        # Now list should be empty
        result = list_tenant_schemas(db_session)
        assert result == []

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_list_tenant_schemas(self, db_session: Session):
        """Test listing tenant schemas."""
        # Create a few tenant schemas
        schemas = ["tenant_list_001", "tenant_list_002", "tenant_list_003"]
        for schema_name in schemas:
            create_tenant_schema(db_session, schema_name)
        
        # List tenant schemas
        result = list_tenant_schemas(db_session)
        
        # Verify all created schemas are listed
        for schema_name in schemas:
            assert schema_name in result
        
        # Cleanup
        for schema_name in schemas:
            drop_tenant_schema(db_session, schema_name, cascade=True)

    @pytest.mark.skip(reason="SQLite doesn't support schema operations")
    def test_list_excludes_non_tenant_schemas(self, db_session: Session):
        """Test that listing excludes non-tenant schemas."""
        # Create a tenant schema
        tenant_schema = "tenant_exclude_001"
        create_tenant_schema(db_session, tenant_schema)
        
        # Create a non-tenant schema
        db_session.execute(text("CREATE SCHEMA other_schema"))
        db_session.commit()
        
        # List tenant schemas
        result = list_tenant_schemas(db_session)
        
        # Should include tenant schema but not other_schema
        assert tenant_schema in result
        assert "other_schema" not in result
        
        # Cleanup
        drop_tenant_schema(db_session, tenant_schema, cascade=True)
        db_session.execute(text("DROP SCHEMA other_schema"))
        db_session.commit()


class TestTenantContextSchemaSupport:
    """Test TenantContext integration with schema isolation."""

    def test_legacy_tenant_no_schema_isolation(self, db_session: Session, legacy_tenant):
        """Test that legacy tenant doesn't use schema isolation."""
        context = TenantContext(legacy_tenant)
        
        assert context.id == "legacy_tenant"
        assert context.schema_name is None
        assert not context.uses_schema_isolation()

    def test_schema_tenant_uses_isolation(self, db_session: Session, test_tenant):
        """Test that tenant with schema_name uses schema isolation."""
        context = TenantContext(test_tenant)
        
        assert context.id == "test_schema_tenant"
        assert context.schema_name == "tenant_test_schema_001"
        assert context.uses_schema_isolation()

    @pytest.mark.skip(reason="SQLite doesn't support search_path")
    def test_apply_search_path_with_schema(self, db_session: Session, test_tenant):
        """Test applying search_path for schema-isolated tenant."""
        # Create the schema
        create_tenant_schema(db_session, test_tenant.schema_name)
        
        # Create context and apply search_path
        context = TenantContext(test_tenant)
        context.apply_search_path(db_session)
        
        # Verify search_path was set
        current_path = get_current_search_path(db_session)
        assert test_tenant.schema_name in current_path
        
        # Cleanup
        drop_tenant_schema(db_session, test_tenant.schema_name, cascade=True)

    @pytest.mark.skip(reason="SQLite doesn't support search_path")
    def test_apply_search_path_without_schema(self, db_session: Session, legacy_tenant):
        """Test that legacy tenant doesn't change search_path."""
        # Get original search_path
        original_path = get_current_search_path(db_session)
        
        # Create context and apply search_path
        context = TenantContext(legacy_tenant)
        context.apply_search_path(db_session)
        
        # Verify search_path unchanged (or set to default)
        current_path = get_current_search_path(db_session)
        # For legacy tenants, search_path should remain public or default
        assert "public" in current_path or current_path == original_path


class TestDualModeSupport:
    """Test that both isolation modes work simultaneously."""

    def test_both_tenant_types_in_database(self, db_session: Session, test_tenant, legacy_tenant):
        """Test that schema and row-level tenants coexist."""
        # Query both tenants
        schema_tenant = db_session.query(Tenant).filter_by(id="test_schema_tenant").first()
        legacy = db_session.query(Tenant).filter_by(id="legacy_tenant").first()
        
        assert schema_tenant is not None
        assert legacy is not None
        
        # Verify schema tenant has schema_name
        assert schema_tenant.schema_name == "tenant_test_schema_001"
        
        # Verify legacy tenant doesn't have schema_name
        assert legacy.schema_name is None

    def test_context_distinguishes_modes(self, db_session: Session, test_tenant, legacy_tenant):
        """Test that TenantContext correctly identifies isolation mode."""
        schema_context = TenantContext(test_tenant)
        legacy_context = TenantContext(legacy_tenant)
        
        # Schema tenant uses schema isolation
        assert schema_context.uses_schema_isolation() is True
        
        # Legacy tenant uses row-level isolation
        assert legacy_context.uses_schema_isolation() is False

    def test_schema_name_uniqueness(self, db_session: Session):
        """Test that schema_name must be unique across tenants."""
        tenant1 = Tenant(
            id="unique_test_1",
            name="Unique Test 1",
            schema_name="tenant_unique_schema",
            loyalty_type="standard",
            primary_domain="unique1.example.com",
        )
        tenant2 = Tenant(
            id="unique_test_2",
            name="Unique Test 2",
            schema_name="tenant_unique_schema",  # Same schema_name
            loyalty_type="standard",
            primary_domain="unique2.example.com",
        )
        
        db_session.add(tenant1)
        db_session.commit()
        
        # Adding second tenant with same schema_name should fail
        db_session.add(tenant2)
        with pytest.raises(Exception):  # IntegrityError or similar
            db_session.commit()
        
        db_session.rollback()
        
        # Cleanup
        db_session.delete(tenant1)
        db_session.commit()


class TestBackwardCompatibility:
    """Test that schema isolation doesn't break existing functionality."""

    def test_legacy_tenant_queries_work(self, db_session: Session, legacy_tenant):
        """Test that row-level isolation still works for legacy tenants."""
        # This should work without any schema-related errors
        tenant = db_session.query(Tenant).filter_by(id="legacy_tenant").first()
        assert tenant is not None
        assert tenant.name == "Legacy Tenant"

    def test_null_schema_name_allowed(self, db_session: Session):
        """Test that schema_name can be NULL."""
        tenant = Tenant(
            id="null_schema_test",
            name="Null Schema Test",
            schema_name=None,
            loyalty_type="standard",
            primary_domain="null-schema.example.com",
        )
        db_session.add(tenant)
        db_session.commit()
        
        # Query back
        retrieved = db_session.query(Tenant).filter_by(id="null_schema_test").first()
        assert retrieved is not None
        assert retrieved.schema_name is None
        
        # Cleanup
        db_session.delete(retrieved)
        db_session.commit()

    def test_multiple_null_schema_names_allowed(self, db_session: Session):
        """Test that multiple tenants can have NULL schema_name."""
        tenant1 = Tenant(
            id="null_test_1",
            name="Null Test 1",
            schema_name=None,
            loyalty_type="standard",
            primary_domain="null1.example.com",
        )
        tenant2 = Tenant(
            id="null_test_2",
            name="Null Test 2",
            schema_name=None,
            loyalty_type="standard",
            primary_domain="null2.example.com",
        )
        
        db_session.add(tenant1)
        db_session.add(tenant2)
        db_session.commit()  # Should not raise uniqueness error
        
        # Cleanup
        db_session.delete(tenant1)
        db_session.delete(tenant2)
        db_session.commit()
