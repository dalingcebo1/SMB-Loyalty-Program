"""
Tenant-scoped router factory and query helpers.

Provides utilities for creating FastAPI routers that automatically inject
``TenantContext`` and for building pre-filtered database queries.
"""

from typing import NoReturn

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Query, Session

from app.core.tenant_context import TenantContext, get_tenant_context


def create_tenant_router(prefix: str, tags: list[str]) -> APIRouter:
    """Create an ``APIRouter`` with ``TenantContext`` auto-injected.

    Every route registered on the returned router will receive
    ``TenantContext`` via FastAPI's dependency injection without the
    endpoint having to declare it explicitly (it is still available as
    a route dependency when needed).

    Args:
        prefix: URL prefix, e.g. ``/api/retail``.
        tags: OpenAPI grouping tags.

    Returns:
        A configured ``APIRouter`` instance.
    """
    return APIRouter(
        prefix=prefix,
        tags=tags,
        dependencies=[Depends(get_tenant_context)],
    )


def get_tenant_query(db: Session, model: type, tenant_id: str) -> Query:
    """Return a query pre-filtered to a specific tenant.

    Assumes the *model* has a ``tenant_id`` column.

    Args:
        db: Active SQLAlchemy session.
        model: SQLAlchemy model class.
        tenant_id: Tenant identifier to filter by.

    Returns:
        A ``Query`` instance with the tenant filter applied.
    """
    return db.query(model).filter(model.tenant_id == tenant_id)  # type: ignore[attr-defined]


def raise_not_found(resource: str, resource_id: str) -> NoReturn:
    """Raise a standardized 404 ``HTTPException``.

    Args:
        resource: Human-readable resource name (e.g. ``"Product"``).
        resource_id: The identifier that was not found.

    Raises:
        HTTPException: Always raised with status 404.
    """
    raise HTTPException(
        status_code=404,
        detail=f"{resource} {resource_id} not found",
    )
