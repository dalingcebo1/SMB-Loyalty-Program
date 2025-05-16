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

@router.get(
    "/me",
    summary="Get loyalty/visit info and unlocked/upcoming rewards for the current user",
)
def loyalty_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get visit count
    visit_count = db.query(VisitCount).filter_by(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    ).first()
    visits = visit_count.count if visit_count else 0

    # Get all milestone rewards for this tenant
    rewards = (
        db.query(Reward)
        .filter_by(tenant_id=current_user.tenant_id, type="milestone")
        .order_by(Reward.milestone.asc())
        .all()
    )

    # Get all redemptions for this user
    redemptions = db.query(Redemption).filter_by(user_id=current_user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status in ("pending", "used")}

    # Unlocked rewards: milestones reached but not yet redeemed or still pending
    rewards_ready = [
        {"milestone": r.milestone, "reward": r.title}
        for r in rewards
        if r.milestone and r.milestone <= visits and r.milestone not in redeemed_milestones
    ]

    # Upcoming rewards: next milestones not yet reached
    upcoming_rewards = [
        {
            "milestone": r.milestone,
            "visits_needed": r.milestone - visits if r.milestone > visits else 0,
            "reward": r.title,
        }
        for r in rewards
        if r.milestone and r.milestone > visits
    ]

    return {
        "name": current_user.first_name,
        "phone": current_user.phone,
        "visits": visits,
        "rewards_ready": rewards_ready,
        "upcoming_rewards": upcoming_rewards,
    }

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

    rec = (
        db.query(Redemption)
        .filter_by(user_id=user_id, reward_id=reward_id, status="pending")
        .first()
    )
    if not rec:
        raise HTTPException(status_code=400, detail="No pending voucher found or already used")

    # Expiry check: 10 days (864000 seconds) after created_at
    expiry_days = 10
    if rec.created_at and (datetime.datetime.utcnow() - rec.created_at).total_seconds() > expiry_days * 86400:
        rec.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Voucher expired")

    rec.status = "used"
    rec.redeemed_at = datetime.datetime.utcnow()
    db.commit()

    return {
        "message": f"Voucher for reward '{payload['reward']}' marked as used.",
        "milestone": payload["milestone"],
        "reward": payload["reward"],
        "status": rec.status,
        "redeemed_at": rec.redeemed_at,
    }

@router.get(
    "/history",
    summary="Get redemption history for the current user",
)
def get_redemption_history(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    from datetime import timedelta
    expiry_days = 10
    history = (
        db.query(Redemption)
        .filter(Redemption.user_id == user.id)
        .order_by(Redemption.redeemed_at.desc())
        .all()
    )
    return [
        {
            "reward": r.reward_name,
            "milestone": r.milestone,
            "redeemed_at": r.redeemed_at.isoformat() if r.redeemed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "expiry_at": (r.created_at + timedelta(days=expiry_days)).isoformat() if r.created_at else None,
            "status": r.status,
            "pin": r.pin,
        }
        for r in history
    ]

@router.get(
    "/rewards",
    summary="Get all available rewards for the current tenant",
)
def get_rewards(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rewards = (
        db.query(Reward)
        .filter(Reward.tenant_id == user.tenant_id)
        .order_by(Reward.milestone.asc().nullslast())
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.title,
            "description": r.description,
            "points_required": r.cost,
            "image_url": None,  # Add r.image_url if you have this field
            "milestone": r.milestone,
        }
        for r in rewards
    ]
