"""
Pagination utilities for database queries.

Provides consistent pagination defaults and helpers to prevent unbounded queries
and memory exhaustion.
"""

from sqlalchemy.orm import Query
from typing import TypeVar, List

# Constants
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 500
MIN_PAGE = 1

T = TypeVar('T')


def paginate(
    query: Query,
    page: int = 1,
    per_page: int = DEFAULT_PAGE_SIZE,
    max_per_page: int = MAX_PAGE_SIZE
) -> Query:
    """
    Apply pagination to a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy Query object
        page: Page number (1-indexed)
        per_page: Items per page (defaults to DEFAULT_PAGE_SIZE)
        max_per_page: Maximum allowed items per page
        
    Returns:
        Paginated Query object
        
    Example:
        query = db.query(User).filter(User.tenant_id == tenant_id)
        results = paginate(query, page=2, per_page=25).all()
    """
    # Enforce limits
    page = max(MIN_PAGE, page)
    per_page = min(per_page, max_per_page)
    per_page = max(1, per_page)
    
    offset = (page - 1) * per_page
    return query.limit(per_page).offset(offset)


def safe_limit(query: Query, limit: int = DEFAULT_PAGE_SIZE, max_limit: int = MAX_PAGE_SIZE) -> Query:
    """
    Apply a safe limit to prevent unbounded queries.
    
    Use this for queries that don't need pagination but should have a maximum result cap.
    
    Args:
        query: SQLAlchemy Query object
        limit: Desired limit (defaults to DEFAULT_PAGE_SIZE)
        max_limit: Maximum allowed limit
        
    Returns:
        Limited Query object
        
    Example:
        recent_orders = safe_limit(
            db.query(Order).filter(Order.created_at > yesterday),
            limit=100
        ).all()
    """
    limit = min(limit, max_limit)
    limit = max(1, limit)
    return query.limit(limit)
