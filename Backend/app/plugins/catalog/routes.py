from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Service, Extra
from app.plugins.auth.routes import get_current_user

router = APIRouter(tags=["catalog"])

@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    out: dict[str, list] = {}
    for s in db.query(Service).all():
        out.setdefault(s.category, []).append({
            "id": s.id,
            "name": s.name,
            "base_price": s.base_price,
        })
    return out

@router.get("/extras")
def list_extras(db: Session = Depends(get_db)):
    return [
        {"id": e.id, "name": e.name, "price_map": e.price_map}
        for e in db.query(Extra).all()
    ]
