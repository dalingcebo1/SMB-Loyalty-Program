"""Authorization helpers and role definitions for Phase 1.

Centralizes role enumeration and provides a reusable dependency for
enforcing role-based access in FastAPI endpoints. This allows later
refactors to swap simple string roles for an enum or bitmask without
touching every route.
"""
from enum import Enum
from fastapi import Depends, HTTPException, status, Request, Header
from typing import Iterable

from app.plugins.auth.routes import get_current_user
from config import settings
from app.models import User
from sqlalchemy.orm import Session
from app.core.database import get_db
from jose import jwt, JWTError


class UserRole(str, Enum):
    superadmin = "superadmin"  # cross-tenant platform owner
    developer = "developer"    # internal development tooling
    admin = "admin"            # tenant admin (legacy existing)
    staff = "staff"            # tenant staff / operator
    user = "user"              # end-customer


PRIVILEGE_ORDER = {
    UserRole.superadmin: 5,
    UserRole.developer: 4,
    UserRole.admin: 3,
    UserRole.staff: 2,
    UserRole.user: 1,
}


def require_roles(*allowed: UserRole):
    """Return dependency that ensures current user has one of the allowed roles.

    Example:
        @router.get("/dev", dependencies=[Depends(require_roles(UserRole.developer, UserRole.superadmin))])
    """
    if not allowed:
        raise ValueError("At least one role required")

    def _dep(user: User = Depends(get_current_user)) -> User:
        try:
            role_enum = UserRole(user.role)  # type: ignore[arg-type]
        except Exception:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")
        if role_enum in allowed:
            return user
        # superadmin always allowed as implicit highest role
        if UserRole.superadmin in PRIVILEGE_ORDER and role_enum == UserRole.superadmin:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    return _dep


def require_min_role(min_role: UserRole):
    """Dependency enforcing a minimum privilege level based on PRIVILEGE_ORDER."""
    min_level = PRIVILEGE_ORDER[min_role]

    def _dep(user: User = Depends(get_current_user)) -> User:
        try:
            lvl = PRIVILEGE_ORDER[UserRole(user.role)]
        except Exception:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")
        # superadmin override
        if lvl >= min_level or user.role == UserRole.superadmin:
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role level")

    return _dep


def developer_only(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User | None:
    """Gate for /api/dev endpoints with relaxed semantics in development.

    Test-aligned rules:
      - Development env & no Authorization header: allow (open console) returning None.
      - With Authorization header:
            * Validate JWT (same logic as get_current_user) and load user.
            * In development: block staff role; allow others (developer, superadmin, admin, user).
            * In non-development: only developer or superadmin allowed.
    """
    if not authorization:
        if settings.environment == 'development':
            return None
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Auth required")

    # Extract bearer token (support either 'Bearer <token>' or raw token)
    token = authorization.split()[1] if authorization.lower().startswith('bearer ') else authorization

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
        email: str | None = payload.get("sub")  # type: ignore[assignment]
        if not email:
            raise credentials_exception
        user = db.query(User).filter_by(email=email).first()
        if not user:
            # In development, allow anonymous access to dev console even if user record is missing
            if settings.environment == 'development':
                return None
            raise credentials_exception
    except JWTError:
        # In development, treat invalid/expired tokens as anonymous for dev tools
        if settings.environment == 'development':
            return None
        raise credentials_exception

    try:
        role_enum = UserRole(user.role)  # type: ignore[arg-type]
    except Exception:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown role")

    if settings.environment != 'development':
        if role_enum in (UserRole.developer, UserRole.superadmin):
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    # Development environment: allow everything except staff
    if role_enum == UserRole.staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return user
tenant_admin_only = require_roles(UserRole.admin, UserRole.superadmin, UserRole.developer)
staff_only = require_roles(UserRole.staff, UserRole.admin, UserRole.superadmin, UserRole.developer)
superadmin_only = require_roles(UserRole.superadmin)

