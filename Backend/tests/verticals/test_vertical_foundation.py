"""Unit tests for the vertical standardization foundation.

Tests cover:
- schemas.py  — PaginationParams, PaginatedResponse, ErrorResponse
- tenant_router.py — create_tenant_router, get_tenant_query, raise_not_found
- crud_service.py — CRUDService generic CRUD operations
- base.py — new VerticalModule helper methods
- registry.py — mount_all()
"""

import os
import sys
from pathlib import Path

# Ensure test DB is in-memory sqlite before any app imports
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ["PYTEST_CURRENT_TEST"] = "1"

_backend_dir = Path(__file__).resolve().parent.parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import pytest
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import Session

from app.core.database import Base, engine, SessionLocal


# ---------------------------------------------------------------------------
# Lightweight model used exclusively by these tests
# ---------------------------------------------------------------------------
class _Widget(Base):
    """Minimal model for CRUD / query tests."""
    __tablename__ = "test_widgets"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# Create the test table once
Base.metadata.create_all(bind=engine)


@pytest.fixture()
def db():
    session = SessionLocal()
    # Clean up test table
    session.query(_Widget).delete()
    session.commit()
    try:
        yield session
    finally:
        session.close()


TENANT = "test-tenant-vertical"


# ===================================================================
# schemas.py
# ===================================================================
class TestPaginationParams:
    def test_defaults(self):
        from app.verticals.schemas import PaginationParams

        p = PaginationParams()
        assert p.page == 1
        assert p.per_page == 20
        assert p.sort_by == "created_at"
        assert p.sort_order == "desc"

    def test_custom_values(self):
        from app.verticals.schemas import PaginationParams

        p = PaginationParams(page=3, per_page=50, sort_by="name", sort_order="asc")
        assert p.page == 3
        assert p.per_page == 50
        assert p.sort_by == "name"
        assert p.sort_order == "asc"

    def test_page_min_validation(self):
        from app.verticals.schemas import PaginationParams
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            PaginationParams(page=0)

    def test_per_page_max_validation(self):
        from app.verticals.schemas import PaginationParams
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            PaginationParams(per_page=101)


class TestPaginatedResponse:
    def test_basic(self):
        from app.verticals.schemas import PaginatedResponse

        resp = PaginatedResponse[str](
            items=["a", "b"],
            total=5,
            page=1,
            per_page=2,
            has_next=True,
        )
        assert resp.items == ["a", "b"]
        assert resp.total == 5
        assert resp.has_next is True

    def test_empty(self):
        from app.verticals.schemas import PaginatedResponse

        resp = PaginatedResponse[int](
            items=[], total=0, page=1, per_page=20, has_next=False
        )
        assert resp.items == []
        assert resp.total == 0
        assert resp.has_next is False


class TestErrorResponse:
    def test_minimal(self):
        from app.verticals.schemas import ErrorResponse

        err = ErrorResponse(detail="boom")
        assert err.detail == "boom"
        assert err.error_code == "error"
        assert err.field_errors is None

    def test_full(self):
        from app.verticals.schemas import ErrorResponse

        err = ErrorResponse(
            detail="Validation failed",
            error_code="validation_error",
            field_errors={"name": ["required"]},
        )
        assert err.field_errors == {"name": ["required"]}


# ===================================================================
# tenant_router.py
# ===================================================================
class TestCreateTenantRouter:
    def test_returns_router_with_prefix_and_tags(self):
        from app.verticals.tenant_router import create_tenant_router

        router = create_tenant_router("/api/test", ["TestTag"])
        assert router.prefix == "/api/test"
        assert router.tags == ["TestTag"]

    def test_dependencies_include_tenant_context(self):
        from app.verticals.tenant_router import create_tenant_router
        from app.core.tenant_context import get_tenant_context

        router = create_tenant_router("/api/x", ["X"])
        # The router should have at least one dependency (get_tenant_context)
        dep_callables = [d.dependency for d in router.dependencies]
        assert get_tenant_context in dep_callables


class TestGetTenantQuery:
    def test_filters_by_tenant(self, db: Session):
        from app.verticals.tenant_router import get_tenant_query

        db.add(_Widget(tenant_id=TENANT, name="mine"))
        db.add(_Widget(tenant_id="other-tenant", name="theirs"))
        db.commit()

        results = get_tenant_query(db, _Widget, TENANT).all()
        assert len(results) == 1
        assert results[0].name == "mine"


class TestRaiseNotFound:
    def test_raises_404(self):
        from fastapi import HTTPException
        from app.verticals.tenant_router import raise_not_found

        with pytest.raises(HTTPException) as exc_info:
            raise_not_found("Widget", "42")
        assert exc_info.value.status_code == 404
        assert "Widget 42 not found" in exc_info.value.detail


# ===================================================================
# crud_service.py
# ===================================================================
class TestCRUDService:
    """Tests for CRUDService using the _Widget model."""

    @pytest.fixture(autouse=True)
    def _setup_service(self):
        from pydantic import BaseModel
        from app.verticals.crud_service import CRUDService

        class WidgetCreate(BaseModel):
            name: str
            status: str = "active"

        class WidgetUpdate(BaseModel):
            name: str | None = None
            status: str | None = None

        class WidgetService(CRUDService[_Widget, WidgetCreate, WidgetUpdate]):
            model = _Widget

        self.service = WidgetService()
        self.WidgetCreate = WidgetCreate
        self.WidgetUpdate = WidgetUpdate

    def test_create_and_get(self, db: Session):
        created = self.service.create(db, TENANT, self.WidgetCreate(name="Alpha"))
        assert created.id is not None
        assert created.tenant_id == TENANT
        assert created.name == "Alpha"

        fetched = self.service.get_by_id(db, TENANT, created.id)
        assert fetched.id == created.id

    def test_get_not_found(self, db: Session):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            self.service.get_by_id(db, TENANT, 999999)
        assert exc_info.value.status_code == 404

    def test_list_pagination(self, db: Session):
        for i in range(5):
            self.service.create(db, TENANT, self.WidgetCreate(name=f"W{i}"))

        page1 = self.service.list(db, TENANT, page=1, per_page=2)
        assert len(page1.items) == 2
        assert page1.total == 5
        assert page1.has_next is True

        page3 = self.service.list(db, TENANT, page=3, per_page=2)
        assert len(page3.items) == 1
        assert page3.has_next is False

    def test_list_filters(self, db: Session):
        self.service.create(db, TENANT, self.WidgetCreate(name="A", status="active"))
        self.service.create(db, TENANT, self.WidgetCreate(name="B", status="inactive"))

        active = self.service.list(db, TENANT, filters={"status": "active"})
        assert active.total == 1
        assert active.items[0].name == "A"

    def test_list_sort_asc(self, db: Session):
        self.service.create(db, TENANT, self.WidgetCreate(name="Bravo"))
        self.service.create(db, TENANT, self.WidgetCreate(name="Alpha"))

        result = self.service.list(db, TENANT, sort_by="name", sort_order="asc")
        names = [w.name for w in result.items]
        assert names == ["Alpha", "Bravo"]

    def test_list_tenant_isolation(self, db: Session):
        self.service.create(db, TENANT, self.WidgetCreate(name="mine"))
        self.service.create(db, "other", self.WidgetCreate(name="theirs"))

        mine = self.service.list(db, TENANT)
        assert mine.total == 1

    def test_update(self, db: Session):
        created = self.service.create(db, TENANT, self.WidgetCreate(name="Old"))
        updated = self.service.update(
            db, TENANT, created.id, self.WidgetUpdate(name="New")
        )
        assert updated.name == "New"

    def test_update_partial(self, db: Session):
        created = self.service.create(
            db, TENANT, self.WidgetCreate(name="X", status="active")
        )
        updated = self.service.update(
            db, TENANT, created.id, self.WidgetUpdate(status="inactive")
        )
        assert updated.name == "X"  # unchanged
        assert updated.status == "inactive"

    def test_update_not_found(self, db: Session):
        from fastapi import HTTPException

        with pytest.raises(HTTPException):
            self.service.update(db, TENANT, 999999, self.WidgetUpdate(name="?"))

    def test_delete(self, db: Session):
        created = self.service.create(db, TENANT, self.WidgetCreate(name="Gone"))
        self.service.delete(db, TENANT, created.id)
        assert self.service.count(db, TENANT) == 0

    def test_delete_not_found(self, db: Session):
        from fastapi import HTTPException

        with pytest.raises(HTTPException):
            self.service.delete(db, TENANT, 999999)

    def test_count(self, db: Session):
        assert self.service.count(db, TENANT) == 0
        self.service.create(db, TENANT, self.WidgetCreate(name="One"))
        self.service.create(db, TENANT, self.WidgetCreate(name="Two"))
        assert self.service.count(db, TENANT) == 2

    def test_count_with_filters(self, db: Session):
        self.service.create(db, TENANT, self.WidgetCreate(name="A", status="active"))
        self.service.create(db, TENANT, self.WidgetCreate(name="B", status="inactive"))
        assert self.service.count(db, TENANT, filters={"status": "active"}) == 1


# ===================================================================
# base.py — new default methods
# ===================================================================
class TestVerticalModuleNewDefaults:
    """Verify the new base-class helpers return sensible defaults."""

    @pytest.fixture()
    def dummy_vertical(self):
        """Minimal concrete subclass of VerticalModule."""
        from app.verticals.base import VerticalModule

        class _Dummy(VerticalModule):
            @property
            def vertical_key(self) -> str:
                return "dummy"

            @property
            def display_name(self) -> str:
                return "Dummy Vertical"

            def get_features(self):
                return ["feat_a"]

        return _Dummy()

    def test_default_router_prefix(self, dummy_vertical):
        assert dummy_vertical.get_router_prefix() == "/api/dummy"

    def test_default_router_tags(self, dummy_vertical):
        assert dummy_vertical.get_router_tags() == ["Dummy Vertical"]

    def test_default_schemas_empty(self, dummy_vertical):
        assert dummy_vertical.get_schemas() == {}

    def test_default_required_capabilities_empty(self, dummy_vertical):
        assert dummy_vertical.get_required_capabilities() == {}


# ===================================================================
# Carwash backward compatibility
# ===================================================================
class TestCarwashBackwardCompat:
    """Ensure the existing carwash vertical still validates against the enhanced base."""

    def test_carwash_instantiates(self):
        from app.verticals.carwash.module import CarwashVertical

        cw = CarwashVertical()
        assert cw.vertical_key == "carwash"
        assert cw.display_name == "Car Wash & Detailing"

    def test_carwash_inherits_new_defaults(self):
        from app.verticals.carwash.module import CarwashVertical

        cw = CarwashVertical()
        assert cw.get_router_prefix() == ""  # prefix is in the router itself
        assert cw.get_router_tags() == ["Car Wash & Detailing"]
        assert cw.get_schemas() == {}
        assert cw.get_required_capabilities() == {}

    def test_carwash_existing_methods_still_work(self):
        from app.verticals.carwash.module import CarwashVertical

        cw = CarwashVertical()
        assert "vehicle_tracking" in cw.get_features()
        assert len(cw.get_admin_capabilities()) > 0
        assert len(cw.get_staff_capabilities()) > 0
        assert cw.get_default_config()["features"]["vehicle_tracking"] is True


# ===================================================================
# registry.py — mount_all
# ===================================================================
class TestRegistryMountAll:
    def test_mount_all_includes_routers(self):
        from fastapi import FastAPI, APIRouter
        from app.verticals.registry import VerticalRegistry
        from app.verticals.base import VerticalModule

        class _TestVertical(VerticalModule):
            @property
            def vertical_key(self):
                return "test_v"

            @property
            def display_name(self):
                return "Test V"

            def get_features(self):
                return []

            def get_routes(self):
                r = APIRouter()

                @r.get("/ping")
                def ping():
                    return {"ok": True}

                return [r]

        app = FastAPI()
        reg = VerticalRegistry()
        reg.register(_TestVertical())
        reg.mount_all(app)

        # Verify that the route was mounted
        paths = [route.path for route in app.routes]
        assert "/api/test_v/ping" in paths

    def test_mount_all_skips_verticals_without_routes(self):
        from fastapi import FastAPI
        from app.verticals.registry import VerticalRegistry
        from app.verticals.base import VerticalModule

        class _Empty(VerticalModule):
            @property
            def vertical_key(self):
                return "empty"

            @property
            def display_name(self):
                return "Empty"

            def get_features(self):
                return []

        app = FastAPI()
        reg = VerticalRegistry()
        reg.register(_Empty())
        initial_count = len(list(app.routes))
        reg.mount_all(app)
        assert len(list(app.routes)) == initial_count
