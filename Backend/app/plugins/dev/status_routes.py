from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Tenant
from app.core.authz import developer_only

status_router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@status_router.get("/", response_model=dict)
def dev_status(db: Session = Depends(get_db)):
    """Basic status + tenant list."""
    tenants = db.query(Tenant).all()
    return {"status": "ok", "tenants": [{"id": t.id, "name": t.name} for t in tenants]}
