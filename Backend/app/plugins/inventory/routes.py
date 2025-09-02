from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, Any

from app.core.database import get_db
from app.models import Service, Extra, User
from app.plugins.auth.routes import require_capability

router = APIRouter(tags=["inventory"])


# ─── SCHEMAS ──────────────────────────────────────────────────────────────
class ServiceCreate(BaseModel):
    category: str
    name: str
    base_price: int = Field(ge=0)
    loyalty_eligible: bool = False


class ServiceUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    base_price: Optional[int] = Field(default=None, ge=0)
    loyalty_eligible: Optional[bool] = None


class ExtraCreate(BaseModel):
    name: str
    price_map: dict[str, Any]


class ExtraUpdate(BaseModel):
    name: Optional[str] = None
    price_map: Optional[dict[str, Any]] = None


# ─── SERVICE CRUD ─────────────────────────────────────────────────────────
@router.get("/services", dependencies=[Depends(require_capability("services.manage"))])
def list_services(db: Session = Depends(get_db)):
    out = []
    for s in db.query(Service).order_by(Service.category, Service.name).all():
        out.append({
            "id": s.id,
            "category": s.category,
            "name": s.name,
            "base_price": s.base_price,
            "loyalty_eligible": s.loyalty_eligible,
        })
    return {"services": out}


@router.post("/services", dependencies=[Depends(require_capability("services.manage"))], status_code=201)
def create_service(req: ServiceCreate, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    svc = Service(category=req.category.strip(), name=req.name.strip(), base_price=req.base_price, loyalty_eligible=req.loyalty_eligible)
    db.add(svc)
    db.commit(); db.refresh(svc)
    return {"id": svc.id}


@router.put("/services/{service_id}", dependencies=[Depends(require_capability("services.manage"))])
def update_service(service_id: int, req: ServiceUpdate, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    svc = db.query(Service).filter_by(id=service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    data = req.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(svc, k, v)
    db.commit(); db.refresh(svc)
    return {"ok": True}


@router.delete("/services/{service_id}", dependencies=[Depends(require_capability("services.manage"))])
def delete_service(service_id: int, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    svc = db.query(Service).filter_by(id=service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(svc)
    db.commit()
    return {"ok": True}


# ─── EXTRAS CRUD ──────────────────────────────────────────────────────────
@router.get("/extras", dependencies=[Depends(require_capability("services.manage"))])
def list_extras(db: Session = Depends(get_db)):
    return {"extras": [
        {"id": e.id, "name": e.name, "price_map": e.price_map}
        for e in db.query(Extra).order_by(Extra.name).all()
    ]}


@router.post("/extras", dependencies=[Depends(require_capability("services.manage"))], status_code=201)
def create_extra(req: ExtraCreate, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    extra = Extra(name=req.name.strip(), price_map=req.price_map)
    db.add(extra)
    db.commit(); db.refresh(extra)
    return {"id": extra.id}


@router.put("/extras/{extra_id}", dependencies=[Depends(require_capability("services.manage"))])
def update_extra(extra_id: int, req: ExtraUpdate, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    extra = db.query(Extra).filter_by(id=extra_id).first()
    if not extra:
        raise HTTPException(status_code=404, detail="Extra not found")
    data = req.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(extra, k, v)
    db.commit(); db.refresh(extra)
    return {"ok": True}


@router.delete("/extras/{extra_id}", dependencies=[Depends(require_capability("services.manage"))])
def delete_extra(extra_id: int, db: Session = Depends(get_db), user: User = Depends(require_capability("services.manage"))):
    extra = db.query(Extra).filter_by(id=extra_id).first()
    if not extra:
        raise HTTPException(status_code=404, detail="Extra not found")
    db.delete(extra)
    db.commit()
    return {"ok": True}
