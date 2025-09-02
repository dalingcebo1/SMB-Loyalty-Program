from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.authz import developer_only
from config import settings
from app.core.audit_safe import safe_recent_audit
from app.core.errors import err

audit_router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@audit_router.get("/audit")
def recent_audit(limit: int = Query(50, le=200)):
    if not settings.enable_dev_audit_view:
        raise HTTPException(status_code=403, detail=err("disabled", "Audit viewer disabled"))
    return {"events": safe_recent_audit(limit=limit)}
