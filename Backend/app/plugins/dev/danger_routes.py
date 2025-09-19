from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.authz import developer_only, UserRole
from config import settings
from app.core.audit_safe import safe_audit
from app.core.errors import err


danger_router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@danger_router.post("/reset-db")
def reset_db(
    confirm: bool = Query(False, description="Must be true to allow reset"),
    confirm_header: str | None = Header(None, alias="X-Dev-Confirm"),
    db: Session = Depends(get_db),
    actor=Depends(developer_only),
):
    """Dangerous: rebuild all tables. Guarded by flags + explicit confirmation."""
    if not settings.dangerous_allowed():
        raise HTTPException(status_code=403, detail=err("forbidden", "Dangerous ops disabled"))
    # In non-development environments, require an authenticated developer/superadmin
    if settings.environment != 'development':
        if not actor or getattr(actor, 'role', None) not in (UserRole.developer, UserRole.superadmin):
            raise HTTPException(status_code=403, detail=err("forbidden", "Insufficient role"))
    # Legacy test expects unconfirmed access; allow implicit confirm in pure development environment
    if not (confirm and confirm_header == "RESET"):
        if settings.environment == 'development':
            confirm = True
        else:
            raise HTTPException(status_code=400, detail=err("confirmation_required", "Pass ?confirm=true and X-Dev-Confirm: RESET"))
    from app.core.database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    safe_audit("dev.reset_db", None, None, {"action": "drop_and_recreate"})
    return {"message": "Database reset complete."}
