from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Tenant
from app.core.authz import developer_only

router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@router.get("/", response_model=dict)
def dev_status(db: Session = Depends(get_db)):
    """Return basic dev console status and list of tenants."""
    tenants = db.query(Tenant).all()
    return {"status": "ok", "tenants": [{"id": t.id, "name": t.name} for t in tenants]}

@router.post("/reset-db")
def reset_db(db: Session = Depends(get_db)):
    """Dangerous: drop and recreate all tables"""
    # Use centralized database definitions
    from app.core.database import Base, engine
    # Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database reset complete."}
