from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Service, Extra

router = APIRouter(tags=["Catalog"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    """
    Returns all services, grouped by category:
    {
      "car/bike": [ {id,name,base_price}, … ],
      "suv/4x4":  [ … ],
      …
    }
    """
    out: dict[str, list] = {}
    for s in db.query(Service).all():
        out.setdefault(s.category, []).append({
            "id":         s.id,
            "name":       s.name,
            "base_price": s.base_price,
        })
    return out

@router.get("/extras")
def list_extras(db: Session = Depends(get_db)):
    """
    Returns list of extras with price_map:
    [
      {id, name, price_map},
      …
    ]
    """
    return [
        {"id": e.id, "name": e.name, "price_map": e.price_map}
        for e in db.query(Extra).all()
    ]
