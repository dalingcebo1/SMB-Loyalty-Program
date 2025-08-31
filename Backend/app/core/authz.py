"""Authorization helpers and role definitions for Phase 1.

Centralizes role enumeration and provides a reusable dependency for
enforcing role-based access in FastAPI endpoints. This allows later
refactors to swap simple string roles for an enum or bitmask without
touching every route.
"""
from enum import Enum
from fastapi import Depends, HTTPException, status
from typing import Iterable

from app.plugins.auth.routes import get_current_user
from app.models import User


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


developer_only = require_roles(UserRole.developer, UserRole.superadmin)
tenant_admin_only = require_roles(UserRole.admin, UserRole.superadmin, UserRole.developer)
staff_only = require_roles(UserRole.staff, UserRole.admin, UserRole.superadmin, UserRole.developer)
superadmin_only = require_roles(UserRole.superadmin)

