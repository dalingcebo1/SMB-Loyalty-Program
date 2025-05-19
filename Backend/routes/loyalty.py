import os
import datetime
from typing import Optional, List

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query, status, Body
from routes.auth import get_current_user
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Tenant, User, VisitCount, Reward, Redemption, Order
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
    visit_count = db.query(VisitCount).filter_by(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id
    ).first()
    visits = visit_count.count if visit_count else 0

    rewards = (
        db.query(Reward)
        .filter_by(tenant_id=current_user.tenant_id, type="milestone")
        .order_by(Reward.milestone.asc())
        .all()
    )

    # Get all redemptions for this user
    redemptions = db.query(Redemption).filter_by(user_id=current_user.id).all()
    # Only exclude "used" rewards from unlocked
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}

    # Find pending redemptions for unlocked rewards
    pending_redemptions = {r.milestone: r for r in redemptions if r.status == "pending"}

    # Unlocked rewards: milestones reached but not yet redeemed (pending or not yet issued)
    rewards_ready = []
    for r in rewards:
        if r.milestone and r.milestone <= visits and r.milestone not in redeemed_milestones:
            redemption = pending_redemptions.get(r.milestone)
            qr_code = None
            pin = None
            if redemption:
                # Generate QR code if not present
                if redemption.qr_code:
                    qr_code = redemption.qr_code
                else:
                    # Generate a JWT token for this reward
                    token = _create_jwt(
                        {
                            "user_id": current_user.id,
                            "reward_id": r.id,
                            "milestone": r.milestone,
                            "reward": r.title,
                        },
                        minutes=10,
                    )
                    qr_code = generate_qr_code(token)["qr_code_base64"]
                pin = redemption.pin or str(redemption.id)[-6:]
            rewards_ready.append({
                "milestone": r.milestone,
                "reward": r.title,
                "qr_code_base64": qr_code,
                "pin": pin,
            })

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
        db.add(vc)
    vc.count += 1
    db.commit()

    visits = vc.count
    rewards = (
        db.query(Reward)
        .filter_by(tenant_id=db_user.tenant_id, type="milestone")
        .order_by(Reward.milestone.asc())
        .all()
    )
    redemptions = db.query(Redemption).filter_by(user_id=db_user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}
    # Only create a new Redemption if there is NOT already a pending one for this milestone
    unlocked = next(
        (r for r in rewards if r.milestone and r.milestone <= visits and r.milestone not in redeemed_milestones),
        None
    )
    reward_issued = None
    if unlocked:
        existing = db.query(Redemption).filter_by(
            user_id=db_user.id, milestone=unlocked.milestone, status="pending"
        ).first()
        if not existing:
            redemption = Redemption(
                tenant_id=db_user.tenant_id,
                user_id=db_user.id,
                reward_id=unlocked.id,
                milestone=unlocked.milestone,
                reward_name=unlocked.title,
                status="pending",
                created_at=datetime.datetime.utcnow(),
                redeemed_at=None,
                order_id=None,
            )
            db.add(redemption)
            db.commit()
            reward_issued = {
                "milestone": unlocked.milestone,
                "reward": unlocked.title,
                "expiry": (redemption.created_at + datetime.timedelta(days=10)).isoformat(),
            }

    return {
        "message": "Visit logged",
        "total_visits": vc.count,
        "reward_issued": reward_issued,
    }

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
    # Only allow claim for pending (not used) rewards
    redemptions = db.query(Redemption).filter_by(user_id=db_user.id).all()
    redeemed_ids = {
        rec.reward_id
        for rec in redemptions
        if rec.status == "used"
    }
    to_issue = [r for r in rewards if r.id not in redeemed_ids]

    if not to_issue:
        return {"message": "No new rewards", "rewards": []}

    out = []
    for r in to_issue:
        # Find the pending redemption for this reward
        redemption = db.query(Redemption).filter_by(
            user_id=db_user.id, reward_id=r.id, status="pending"
        ).first()
        if redemption:
            token = _create_jwt(
                {
                    "user_id": db_user.id,
                    "reward_id": r.id,
                    "milestone": r.milestone,
                    "reward": r.title,
                },
                minutes=10,
            )
            qr = generate_qr_code(token)["qr_code_base64"]
            # Optionally store QR code in DB
            redemption.qr_code = qr
            # Generate a simple PIN if not present
            if not redemption.pin:
                redemption.pin = str(redemption.id)[-6:]
            db.commit()
            out.append(
                {
                    "milestone": r.milestone,
                    "reward": r.title,
                    "token": token,
                    "qr_code_base64": qr,
                    "pin": redemption.pin,
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
        "milestone": payload['milestone'],
        "reward": payload['reward'],
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

@router.post(
    "/reward/apply",
    summary="Apply a loyalty reward to an order (online) or issue a manual voucher (in-person)",
)
def apply_or_issue_reward(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    body: dict = Body(...),
):
    """
    If orderId is provided, apply the reward to the order and return discount.
    If not, issue a manual voucher (PIN) for in-person redemption.
    """
    import datetime

    order_id = body.get("orderId")
    phone = body.get("phone")  # fallback for manual
    # Get user
    user = current_user
    if phone:
        user = db.query(User).filter_by(phone=phone, tenant_id=current_user.tenant_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    # Get visit count
    vc = db.query(VisitCount).filter_by(user_id=user.id, tenant_id=user.tenant_id).first()
    visits = vc.count if vc else 0

    # Get all milestone rewards for this tenant
    rewards = (
        db.query(Reward)
        .filter_by(tenant_id=user.tenant_id, type="milestone")
        .order_by(Reward.milestone.asc())
        .all()
    )

    # Get all redemptions for this user
    redemptions = db.query(Redemption).filter_by(user_id=user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}

    # Find first unlocked reward
    unlocked = next(
        (r for r in rewards if r.milestone and r.milestone <= visits and r.milestone not in redeemed_milestones),
        None
    )
    if not unlocked:
        raise HTTPException(status_code=400, detail="No valid reward found.")

    # --- ONLINE FLOW: Apply to order ---
    if order_id:
        # Try to load order and its items
        order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Try to find a "Full House" or "Free Wash" in order summary or items
        discount = None
        # If you have order.items relationship:
        if hasattr(order, "items") and order.items:
            for item in order.items:
                if "full house" in item.name.lower() or "free wash" in item.name.lower():
                    discount = int(item.price * 100)
                    break
        # Fallback: try order.serviceName or summary
        if discount is None and hasattr(order, "serviceName"):
            if "full house" in order.serviceName.lower() or "free wash" in order.serviceName.lower():
                discount = int(order.amount * 100)
        if discount is None and hasattr(order, "summary") and order.summary:
            for s in order.summary:
                if "full house" in s.lower() or "free wash" in s.lower():
                    # You may need to parse price from summary if available
                    discount = 12000  # fallback to R120
                    break
        if discount is None:
            # fallback to a default value (e.g. R120)
            discount = 12000

        # Mark reward as used for this order
        redemption = Redemption(
            tenant_id=user.tenant_id,  # <-- Make sure this is set!
            user_id=user.id,
            reward_id=unlocked.id,
            milestone=unlocked.milestone,
            reward_name=unlocked.title,
            status="used",  # <-- only if actually applied to an order!
            created_at=datetime.datetime.utcnow(),
            redeemed_at=datetime.datetime.utcnow(),
            order_id=order_id,
        )
        db.add(redemption)
        db.commit()

        return {
            "success": True,
            "discount": discount,
            "reward": unlocked.title,
            "expiry": (redemption.created_at + datetime.timedelta(days=10)).isoformat(),
        }

    # --- MANUAL FLOW: Issue PIN for in-person ---
    else:
        redemption = Redemption(
            tenant_id=user.tenant_id,  # <-- Make sure this is set!
            user_id=user.id,
            reward_id=unlocked.id,
            milestone=unlocked.milestone,
            reward_name=unlocked.title,
            status="pending",  # <-- must be pending!
            created_at=datetime.datetime.utcnow(),
            redeemed_at=None,
            order_id=None,
        )
        db.add(redemption)
        db.commit()
        # Generate a simple PIN
        pin = str(redemption.id)[-6:]
        return {
            "success": True,
            "reward": unlocked.title,
            "pin": pin,
            "expiry": (redemption.created_at + datetime.timedelta(days=10)).isoformat(),
        }
