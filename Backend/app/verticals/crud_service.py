"""
Generic CRUD service for tenant-scoped resources.

Provides a reusable base class that verticals can subclass to get
standard list / get / create / update / delete operations with
pagination, sorting, and tenant isolation built in.
"""

from typing import Any, Generic, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session

from app.verticals.schemas import PaginatedResponse

ModelT = TypeVar("ModelT")
CreateSchemaT = TypeVar("CreateSchemaT", bound=BaseModel)
UpdateSchemaT = TypeVar("UpdateSchemaT", bound=BaseModel)


class CRUDService(Generic[ModelT, CreateSchemaT, UpdateSchemaT]):
    """Base CRUD service with tenant isolation.

    Subclasses **must** set the ``model`` class attribute to the
    SQLAlchemy model they operate on.  The model is expected to have at
    least ``id``, ``tenant_id``, and ``created_at`` columns.

    Example::

        class ProductService(CRUDService[Product, ProductCreate, ProductUpdate]):
            model = Product
    """

    model: type[ModelT]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _base_query(self, db: Session, tenant_id: str):
        """Return a tenant-filtered query."""
        return db.query(self.model).filter(
            self.model.tenant_id == tenant_id  # type: ignore[attr-defined]
        )

    def _get_or_404(self, db: Session, tenant_id: str, resource_id: Any) -> ModelT:
        """Fetch a single record or raise 404."""
        instance = self._base_query(db, tenant_id).filter(
            self.model.id == resource_id  # type: ignore[attr-defined]
        ).first()
        if instance is None:
            model_name = getattr(self.model, "__name__", "Resource")
            raise HTTPException(
                status_code=404,
                detail=f"{model_name} {resource_id} not found",
            )
        return instance  # type: ignore[return-value]

    @staticmethod
    def _apply_sort(query, model: type, sort_by: str, sort_order: str):
        """Apply sorting to a query."""
        column = getattr(model, sort_by, None)
        if column is None:
            column = getattr(model, "created_at", None)
        if column is not None:
            order_fn = desc if sort_order == "desc" else asc
            query = query.order_by(order_fn(column))
        return query

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list(
        self,
        db: Session,
        tenant_id: str,
        *,
        page: int = 1,
        per_page: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        filters: dict[str, Any] | None = None,
    ) -> PaginatedResponse:
        """Return a paginated, sorted list of records.

        Args:
            db: Database session.
            tenant_id: Tenant scope.
            page: 1-indexed page number.
            per_page: Items per page.
            sort_by: Column to sort by.
            sort_order: ``"asc"`` or ``"desc"``.
            filters: Optional ``{column: value}`` equality filters.

        Returns:
            ``PaginatedResponse`` with typed items.
        """
        query = self._base_query(db, tenant_id)

        if filters:
            for col_name, value in filters.items():
                col = getattr(self.model, col_name, None)
                if col is not None:
                    query = query.filter(col == value)

        total: int = query.count()

        query = self._apply_sort(query, self.model, sort_by, sort_order)
        query = query.offset((page - 1) * per_page).limit(per_page)
        items = query.all()

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            has_next=(page * per_page) < total,
        )

    def get_by_id(self, db: Session, tenant_id: str, resource_id: Any) -> ModelT:
        """Fetch a single record by ID (raises 404 if missing)."""
        return self._get_or_404(db, tenant_id, resource_id)

    def create(self, db: Session, tenant_id: str, schema: CreateSchemaT) -> ModelT:
        """Create a new record for the given tenant.

        Args:
            db: Database session.
            tenant_id: Owning tenant.
            schema: Pydantic create schema.

        Returns:
            The newly created model instance.
        """
        data = schema.model_dump()
        data["tenant_id"] = tenant_id
        instance = self.model(**data)  # type: ignore[call-arg]
        db.add(instance)
        db.commit()
        db.refresh(instance)
        return instance  # type: ignore[return-value]

    def update(
        self, db: Session, tenant_id: str, resource_id: Any, schema: UpdateSchemaT
    ) -> ModelT:
        """Update an existing record (raises 404 if missing).

        Only fields explicitly set on *schema* are applied.
        """
        instance = self._get_or_404(db, tenant_id, resource_id)
        update_data = schema.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(instance, key, value)
        db.commit()
        db.refresh(instance)
        return instance  # type: ignore[return-value]

    def delete(self, db: Session, tenant_id: str, resource_id: Any) -> None:
        """Delete a record (raises 404 if missing)."""
        instance = self._get_or_404(db, tenant_id, resource_id)
        db.delete(instance)
        db.commit()

    def count(
        self,
        db: Session,
        tenant_id: str,
        filters: dict[str, Any] | None = None,
    ) -> int:
        """Return the number of matching records for the tenant."""
        query = self._base_query(db, tenant_id)
        if filters:
            for col_name, value in filters.items():
                col = getattr(self.model, col_name, None)
                if col is not None:
                    query = query.filter(col == value)
        return query.count()
