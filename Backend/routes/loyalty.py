import os
import datetime
from typing import Optional, List

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query, status
from routes.auth import get_current_user
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Tenant, User, VisitCount, Reward, Redemption
from utils.qr import generate_qr_code  # your existing QR util

SECRET_KEY = os.getenv("SECRET_KEY", "your-VERY-secure-secret")
DEFAULT_TENANT = os.getenv("TENANT_ID", "default")

router = APIRouter(
    prefix="/loyalty",
    dependencies=[Depends(get_current_user)],
    tags=["loyalty"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Schemas ────────────────────────────────────────────────────────────────────

class UserInfo(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None

class AuthResponse(BaseModel):
    message: str
    token: str
    user: Optional[UserInfo] = None

class RegisterUser(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None

class PhoneIn(BaseModel):
    phone: str

class RedeemIn(BaseModel):
    token: str

# ─── Helpers ────────────────────────────────────────────────────────────────────

def _ensure_tenant(db: Session) -> Tenant:
    t = db.query(Tenant).filter_by(id=DEFAULT_TENANT).first()
    if not t:
        t = Tenant(id=DEFAULT_TENANT, name=DEFAULT_TENANT, loyalty_type="milestone")
        db.add(t)
        db.commit()
    return t

def _create_jwt(payload: dict, minutes: int) -> str:
    exp = datetime.datetime.utcnow() + datetime.timedelta(minutes=minutes)
    payload = {**payload, "exp": exp}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# ─── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register or re-issue token for a user",
)
def register_user(user: RegisterUser, db: Session = Depends(get_db)):
    tenant = _ensure_tenant(db)

    # already exists?
    db_user = (
        db.query(User)
        .filter_by(phone=user.phone, tenant_id=tenant.id)
        .first()
    )
    if db_user:
        token = _create_jwt({"user_id": db_user.id}, minutes=60)
        return AuthResponse(
            message="User already registered, token re-issued",
            token=token,
            user=UserInfo(
                first_name=db_user.first_name,
                last_name=db_user.last_name,
                phone=db_user.phone,
                email=db_user.email,
            ),
        )

    # brand-new user
    db_user = User(
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        tenant_id=tenant.id,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    token = _create_jwt({"user_id": db_user.id}, minutes=60)
    return AuthResponse(
        message="User registered successfully",
        token=token,
        user=UserInfo(
            first_name=db_user.first_name,
            last_name=db_user.last_name,
            phone=db_user.phone,
            email=db_user.email,
        ),
    )

@router.post(
    "/visit",
    status_code=status.HTTP_200_OK,
    summary="Log a visit for a given phone number",
)
def log_visit(body: PhoneIn, db: Session = Depends(get_db)):
    db_user = (
        db.query(User)
        .filter_by(phone=body.phone, tenant_id=DEFAULT_TENANT)
        .first()
    )
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    vc = (
        db.query(VisitCount)
        .filter_by(user_id=db_user.id, tenant_id=db_user.tenant_id)
        .first()
    )
    if not vc:
        vc = VisitCount(user_id=db_user.id, tenant_id=db_user.tenant_id, count=0)
    vc.count += 1
    db.add(vc)
    db.commit()

    return {"message": "Visit logged", "total_visits": vc.count}

# Removed /me endpoint to avoid duplication with auth.py

@router.post(
    "/reward",
    summary="Issue QR-coded JWTs for any newly unlocked milestone rewards",
)
def claim_reward(body: PhoneIn, db: Session = Depends(get_db)):
    db_user = (
        db.query(User)
        .filter_by(phone=body.phone, tenant_id=DEFAULT_TENANT)
        .first()
    )
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    vc = (
        db.query(VisitCount)
        .filter_by(user_id=db_user.id, tenant_id=db_user.tenant_id)
        .first()
    )
    visits = vc.count if vc else 0

    rewards = (
        db.query(Reward)
        .filter_by(tenant_id=db_user.tenant_id, type="milestone")
        .filter(Reward.milestone <= visits)
        .all()
    )
    redeemed_ids = {
        rec.reward_id
        for rec in db.query(Redemption).filter_by(user_id=db_user.id)
    }
    to_issue = [r for r in rewards if r.id not in redeemed_ids]

    if not to_issue:
        return {"message": "No new rewards", "rewards": []}

    out = []
    for r in to_issue:
        token = _create_jwt(
            {
                "user_id": db_user.id,
                "reward_id": r.id,
                "milestone": r.milestone,
                "reward": r.title,
            },
            minutes=10,
        )
        qr = generate_qr_code(token)
        out.append(
            {
                "milestone": r.milestone,
                "reward": r.title,
                "token": token,
                "qr_code_base64": qr,
            }
        )

    return {"message": "Rewards issued", "rewards": out}

@router.post(
    "/redeem",
    summary="Redeem a QR-coded reward token",
)
def redeem(body: RedeemIn, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload["user_id"]
    reward_id = payload["reward_id"]

    db_user = db.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    already = (
        db.query(Redemption)
        .filter_by(user_id=user_id, reward_id=reward_id)
        .first()
    )
    if already:
        raise HTTPException(status_code=400, detail="Reward already redeemed")

    rec = Redemption(
        tenant_id=db_user.tenant_id,
        user_id=user_id,
        reward_id=reward_id,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(rec)
    db.commit()

    return {
        "message": f"Redeemed reward '{payload['reward']}'",
        "milestone": payload["milestone"],
        "reward": payload["reward"],
    }
