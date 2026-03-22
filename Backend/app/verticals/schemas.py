"""
Shared schemas for vertical modules.

Provides reusable Pydantic models for pagination, paginated responses,
and standardized error responses used across all verticals.
"""

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """
    Query parameters for paginated list endpoints.

    Can be used as a FastAPI dependency::

        @router.get("/items")
        def list_items(pagination: PaginationParams = Depends()):
            ...
    """

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    per_page: int = Field(
        default=20, ge=1, le=100, description="Results per page (max 100)"
    )
    sort_by: str = Field(
        default="created_at", description="Column name to sort by"
    )
    sort_order: Literal["asc", "desc"] = Field(
        default="desc", description="Sort direction"
    )


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response wrapper.

    Usage::

        PaginatedResponse[ItemSchema](
            items=[...],
            total=42,
            page=1,
            per_page=20,
            has_next=True,
        )
    """

    items: list[T]
    total: int = Field(ge=0, description="Total number of matching records")
    page: int = Field(ge=1)
    per_page: int = Field(ge=1)
    has_next: bool = Field(description="Whether more pages exist")


class ErrorResponse(BaseModel):
    """Standardized error response body."""

    detail: str
    error_code: str = Field(default="error", description="Machine-readable error code")
    field_errors: dict[str, list[str]] | None = Field(
        default=None,
        description="Per-field validation errors (field name → list of messages)",
    )
