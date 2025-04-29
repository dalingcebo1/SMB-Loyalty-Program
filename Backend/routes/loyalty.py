import os
import datetime
from typing import Optional, List

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Tenant, User, VisitCount, Reward, Redemption
from utils.qr import generate_qr_code  # your existing QR util

SECRET_KEY = os.getenv("SECRET_KEY", "your-very-secure-secret")
DEFAULT_TENANT = os.getenv("TENANT_ID", "default")

router = APIRouter(tags=["Loyalty"], prefix="/loyalty")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Request Schemas ───────────────────────────────────────────────────────────

class RegisterUser(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class PhoneIn(BaseModel):
    phone: str

class RedeemIn(BaseModel):
    token: str


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_tenant(db: Session):
    """Make sure our default tenant exists."""
    t = db.query(Tenant).filter_by(id=DEFAULT_TENANT).first()
    if not t:
        t = Tenant(id=DEFAULT_TENANT, name=DEFAULT_TENANT, loyalty_type="milestone")
        db.add(t)
        db.commit()
    return t


def _create_jwt(payload: dict, minutes: int):
    exp = datetime.datetime.utcnow() + datetime.timedelta(minutes=minutes)
    payload.update({"exp": exp})
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register")
def register_user(user: RegisterUser, db: Session = Depends(get_db)):
    """
    Create a new user (or re-issue token if they already exist).
    """
    tenant = _ensure_tenant(db)

    db_user = (
        db.query(User)
          .filter_by(phone=user.phone, tenant_id=tenant.id)
          .first()
    )
    if db_user:
        token = _create_jwt({"user_id": db_user.id}, minutes=60)
        return {
            "message": "User already registered",
            "token": token
        }

    # create new user
    db_user = User(
        phone=user.phone,
        name=user.name,
        email=user.email,
        tenant_id=tenant.id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    token = _create_jwt({"user_id": db_user.id}, minutes=60)
    return {
        "message": "User registered successfully",
        "token": token,
        "user": {
            "name": db_user.name,
            "phone": db_user.phone,
            "email": db_user.email,
        }
    }


@router.post("/visit")
def log_visit(body: PhoneIn, db: Session = Depends(get_db)):
    """
    Increment the visit count for a given user phone.
    """
    db_user = db.query(User).filter_by(phone=body.phone).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    vc = (
        db.query(VisitCount)
          .filter_by(user_id=db_user.id, tenant_id=db_user.tenant_id)
          .first()
    )
    if not vc:
        vc = VisitCount(
            user_id=db_user.id,
            tenant_id=db_user.tenant_id,
            count=0
        )
    vc.count += 1
    db.add(vc)
    db.commit()

    return {
        "message": "Visit logged",
        "total_visits": vc.count
    }


@router.get("/me")
def get_profile(
    phone: str = Query(..., description="User phone number"),
    db:    Session = Depends(get_db)
):
    """
    Fetch user profile, total visits, ready-to-claim & upcoming rewards,
    plus their redeemed history.
    """
    db_user = db.query(User).filter_by(phone=phone).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    # how many visits?
    vc = (
        db.query(VisitCount)
          .filter_by(user_id=db_user.id, tenant_id=db_user.tenant_id)
          .first()
    )
    visits = vc.count if vc else 0

    # all milestone rewards for this tenant
    rewards = (
        db.query(Reward)
          .filter_by(tenant_id=db_user.tenant_id, type="milestone")
          .order_by(Reward.milestone)
          .all()
    )

    # already redeemed
    redeemed = {
        r.reward_id
        for r in db.query(Redemption).filter_by(user_id=db_user.id).all()
    }

    ready = []
    upcoming = []
    for r in rewards:
        if r.id in redeemed:
            continue
        if visits >= r.milestone:
            ready.append({"milestone": r.milestone, "reward": r.title})
        else:
            upcoming.append({
                "milestone": r.milestone,
                "reward": r.title,
                "visits_needed": r.milestone - visits
            })

    # redeemed history
    history = []
    for rec in (
        db.query(Redemption)
          .filter_by(user_id=db_user.id)
          .order_by(Redemption.created_at.desc())
          .all()
    ):
        history.append({
            "milestone": rec.reward.milestone,
            "reward":    rec.reward.title,
            "timestamp": rec.created_at.isoformat()
        })

    return {
        "name": db_user.name,
        "email": db_user.email,
        "phone": db_user.phone,
        "total_visits": visits,
        "rewards_ready_to_claim": ready,
        "upcoming_rewards": upcoming,
        "redeemed_history": history
    }


@router.post("/reward")
def claim_reward(body: PhoneIn, db: Session = Depends(get_db)):
    """
    Issue JWT + QR codes for any unclaimed milestones the user has reached.
    """
    db_user = db.query(User).filter_by(phone=body.phone).first()
    if not db_user:
        raise HTTPException(404, "User not found")

    # current visits
    vc = (
        db.query(VisitCount)
          .filter_by(user_id=db_user.id, tenant_id=db_user.tenant_id)
          .first()
    )
    visits = vc.count if vc else 0

    # find eligible milestone rewards
    rewards = (
        db.query(Reward)
          .filter_by(tenant_id=db_user.tenant_id, type="milestone")
          .filter(Reward.milestone <= visits)
          .all()
    )
    # filter out already redeemed
    redeemed_ids = {
        r.reward_id for r in db.query(Redemption).filter_by(user_id=db_user.id)
    }

    to_issue = [r for r in rewards if r.id not in redeemed_ids]
    if not to_issue:
        return {"message": "No new rewards", "rewards": []}

    out = []
    for r in to_issue:
        token = _create_jwt({
            "user_id":   db_user.id,
            "reward_id": r.id,
            "milestone": r.milestone,
            "reward":    r.title
        }, minutes=10)

        qr = generate_qr_code(token)
        out.append({
            "milestone": r.milestone,
            "reward":    r.title,
            "token":     token,
            "qr_code_base64": qr
        })

    return {"message": "Rewards issued", "rewards": out}


@router.post("/redeem")
def redeem(body: RedeemIn, db: Session = Depends(get_db)):
    """
    Consume a reward‐JWT, mark it redeemed, and record in Redemption.
    """
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    user_id   = payload["user_id"]
    reward_id = payload["reward_id"]

    db_user = db.get(User, user_id)
    if not db_user:
        raise HTTPException(404, "User not found")

    # prevent double‐redeem
    exists = (
        db.query(Redemption)
          .filter_by(user_id=user_id, reward_id=reward_id)
          .first()
    )
    if exists:
        raise HTTPException(400, "Reward already redeemed")

    # record redemption
    rec = Redemption(
        tenant_id=db_user.tenant_id,
        user_id=user_id,
        reward_id=reward_id
    )
    db.add(rec)
    db.commit()

    return {
        "message": f"Redeemed reward {payload['reward']}",
        "milestone": payload["milestone"],
        "reward":    payload["reward"]
    }
