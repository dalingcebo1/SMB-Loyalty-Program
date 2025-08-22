import os
import datetime
import secrets
import string
from typing import Optional, List

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query, status, Body, BackgroundTasks
from routes.auth import get_current_user
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models import Tenant, User, VisitCount, Reward, Redemption, Order, Service, Extra, OrderItem
from utils.qr import generate_qr_code  # your existing QR util

SECRET_KEY = os.getenv("SECRET_KEY", "your-VERY-secure-secret")
DEFAULT_TENANT = os.getenv("TENANT_ID", "default")

REWARD_INTERVAL = 5  # Change this to your desired interval
EXPIRY_DAYS = 10

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

def generate_unique_pin(db, length=8):
    alphabet = string.ascii_uppercase + string.digits
    while True:
        pin = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure uniqueness in the Redemption table
        if not db.query(Redemption).filter_by(pin=pin).first():
            return pin

def get_base_reward(db: Session, tenant_id: str):
    # Get the base reward (milestone=REWARD_INTERVAL)
    return (
        db.query(Reward)
        .filter_by(tenant_id=tenant_id, type="milestone", milestone=REWARD_INTERVAL)
        .first()
    )

def ensure_pending_redemption(db, user, milestone, base_reward):
    existing = db.query(Redemption).filter_by(
        user_id=user.id, milestone=milestone, status="pending"
    ).first()
    if not existing:
        try:
            redemption = Redemption(
                tenant_id=user.tenant_id,
                user_id=user.id,
                reward_id=base_reward.id,
                milestone=milestone,
                reward_name=base_reward.title,
                status="pending",
                created_at=datetime.datetime.utcnow(),
                redeemed_at=None,
                order_id=None,
            )
            redemption.pin = generate_unique_pin(db, 8)
            db.add(redemption)
            db.commit()
            return redemption
        except IntegrityError:
            db.rollback()
            return db.query(Redemption).filter_by(
                user_id=user.id, milestone=milestone, status="pending"
            ).first()
    return existing

def expire_old_redemptions(db: Session):
    now = datetime.datetime.utcnow()
    expiry_cutoff = now - datetime.timedelta(days=EXPIRY_DAYS)
    expired = (
        db.query(Redemption)
        .filter(Redemption.status == "pending", Redemption.created_at < expiry_cutoff)
        .all()
    )
    for r in expired:
        r.status = "expired"
    if expired:
        db.commit()

def is_full_wash(db: Session, order_items: List[OrderItem]) -> bool:
    """
    Determines if the order contains a full wash (service) and no extras.
    Returns True if only a full wash is present, False if any extras are present.
    """
    if not order_items:
        return False
    has_service = False
    for item in order_items:
        # Assume Service items have a non-null service_id, extras have extra_id
        if getattr(item, "service_id", None):
            has_service = True
        if getattr(item, "extra_id", None):
            return False  # If any extra is present, not a full wash only
    return has_service

def calculate_extras_total(db: Session, order_items: List[OrderItem]) -> int:
    """
    Sums the price of all extras in the order.
    """
    total = 0
    for item in order_items:
        if getattr(item, "extra_id", None):
            extra = db.query(Extra).filter_by(id=item.extra_id).first()
            if extra:
                # Assume price_map is a dict with a default price
                price_map = extra.price_map or {}
                price = price_map.get("default") or price_map.get("price") or 0
                total += int(price)
    return total

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

    base_reward = get_base_reward(db, current_user.tenant_id)
    if not base_reward:
        return {
            "name": current_user.first_name,
            "phone": current_user.phone,
            "visits": visits,
            "rewards_ready": [],
            "upcoming_rewards": [],
        }

    num_rewards_earned = visits // REWARD_INTERVAL

    redemptions = db.query(Redemption).filter_by(user_id=current_user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}
    pending_redemptions = {}
    for r in redemptions:
        if r.status == "pending" and r.milestone not in pending_redemptions:
            pending_redemptions[r.milestone] = r

    rewards_ready = []
    for i in range(1, num_rewards_earned + 1):
        milestone = i * REWARD_INTERVAL
        if milestone in redeemed_milestones:
            continue
        redemption = ensure_pending_redemption(db, current_user, milestone, base_reward)
        token = _create_jwt(
            {
                "user_id": current_user.id,
                "reward_id": base_reward.id,
                "milestone": milestone,
                "reward": base_reward.title,
            },
            minutes=10,
        )
        expiry_at = (redemption.created_at + datetime.timedelta(days=EXPIRY_DAYS)) if redemption.created_at else None
        if not redemption.pin or len(redemption.pin) < 8:
            redemption.pin = generate_unique_pin(db, 8)
            db.commit()
        rewards_ready.append({
            "milestone": milestone,
            "reward": base_reward.title,
            "qr_reference": token,
            "pin": redemption.pin,
            "status": redemption.status,
            "expiry_at": expiry_at.isoformat() if expiry_at else None,
        })

    next_milestone = ((visits // REWARD_INTERVAL) + 1) * REWARD_INTERVAL
    upcoming_rewards = [
        {
            "milestone": next_milestone,
            "visits_needed": next_milestone - visits if next_milestone > visits else 0,
            "reward": base_reward.title,
        }
    ] if next_milestone > visits else []

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
    base_reward = get_base_reward(db, db_user.tenant_id)
    if not base_reward:
        return {
            "message": "Visit logged",
            "total_visits": vc.count,
            "reward_issued": None,
        }

    milestone = (visits // REWARD_INTERVAL) * REWARD_INTERVAL
    if milestone == 0:
        milestone = REWARD_INTERVAL

    redemptions = db.query(Redemption).filter_by(user_id=db_user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}
    reward_issued = None
    if milestone not in redeemed_milestones and visits % REWARD_INTERVAL == 0:
        redemption = ensure_pending_redemption(db, db_user, milestone, base_reward)
        reward_issued = {
            "milestone": milestone,
            "reward": base_reward.title,
            "expiry": (redemption.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat(),
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

    base_reward = get_base_reward(db, db_user.tenant_id)
    if not base_reward:
        return {"message": "No new rewards", "rewards": []}

    num_rewards_earned = visits // REWARD_INTERVAL

    redemptions = db.query(Redemption).filter_by(user_id=db_user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}

    out = []
    for i in range(1, num_rewards_earned + 1):
        milestone = i * REWARD_INTERVAL
        if milestone in redeemed_milestones:
            continue

        redemption = ensure_pending_redemption(db, db_user, milestone, base_reward)
        token = _create_jwt(
            {
                "user_id": db_user.id,
                "reward_id": base_reward.id,
                "milestone": milestone,
                "reward": base_reward.title,
            },
            minutes=10,
        )
        out.append(
            {
                "milestone": milestone,
                "reward": base_reward.title,
                "qr_reference": token,
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
    milestone = payload["milestone"]

    db_user = db.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    rec = (
        db.query(Redemption)
        .filter_by(user_id=user_id, milestone=milestone, status="pending")
        .first()
    )
    if not rec:
        raise HTTPException(status_code=400, detail="No pending voucher found or already used")

    if rec.created_at and (datetime.datetime.utcnow() - rec.created_at).total_seconds() > EXPIRY_DAYS * 86400:
        rec.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Voucher expired")

    # --- Create an order if needed ---
    if not rec.order_id:
        # Fetch order items from request or context if available
        order_items = []  # You should populate this from the request or context
        # Example: order_items = body.order_items if hasattr(body, "order_items") else []
        # For demo, assume full wash if no extras are present

        # If you have a way to get the intended order items, use that here.
        # Otherwise, fallback to full wash.
        full_wash = is_full_wash(db, order_items)
        extras_total = calculate_extras_total(db, order_items) if not full_wash else 0

        order = Order(
            user_id=user_id,
            tenant_id=db_user.tenant_id,
            status="pending",
            created_at=datetime.datetime.utcnow(),
            redeemed=True,
            type="loyalty",
            amount=0 if full_wash else extras_total,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        rec.order_id = order.id

    rec.status = "used"
    rec.redeemed_at = datetime.datetime.utcnow()
    db.commit()

    return {
        "message": f"Voucher for reward '{payload['reward']}' marked as used.",
        "milestone": payload['milestone'],
        "reward": payload['reward'],
        "status": rec.status,
        "redeemed_at": rec.redeemed_at,
        "order_id": rec.order_id,
    }

@router.get(
    "/history",
    summary="Get redemption history for the current user",
)
def get_redemption_history(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
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
            "expiry_at": (r.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat() if r.created_at else None,
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
    base_reward = get_base_reward(db, user.tenant_id)
    if not base_reward:
        return []
    milestones = [i * REWARD_INTERVAL for i in range(1, 21)]
    return [
        {
            "id": base_reward.id,
            "name": base_reward.title,
            "description": base_reward.description,
            "points_required": base_reward.cost,
            "image_url": None,
            "milestone": milestone,
        }
        for milestone in milestones
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
    order_id = body.get("orderId")
    phone = body.get("phone")
    user = current_user
    if phone:
        user = db.query(User).filter_by(phone=phone, tenant_id=current_user.tenant_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    vc = db.query(VisitCount).filter_by(user_id=user.id, tenant_id=user.tenant_id).first()
    visits = vc.count if vc else 0

    base_reward = get_base_reward(db, user.tenant_id)
    if not base_reward:
        raise HTTPException(status_code=400, detail="No valid reward found.")

    milestone = (visits // REWARD_INTERVAL) * REWARD_INTERVAL
    if milestone == 0:
        milestone = REWARD_INTERVAL

    redemptions = db.query(Redemption).filter_by(user_id=user.id).all()
    redeemed_milestones = {r.milestone for r in redemptions if r.status == "used"}

    if milestone in redeemed_milestones:
        raise HTTPException(status_code=400, detail="No valid reward found.")

    # --- ONLINE FLOW: Apply to order ---
    if order_id:
        order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        discount = 12000  # fallback to a default value (e.g. R120)

        # Find existing pending redemption for this milestone
        redemption = db.query(Redemption).filter_by(
            user_id=user.id,
            milestone=milestone,
            status="pending"
        ).first()
        if redemption:
            redemption.status = "used"
            redemption.redeemed_at = datetime.datetime.utcnow()
            redemption.order_id = order_id
        else:
            # fallback: create new if not found (should be rare)
            redemption = Redemption(
                tenant_id=user.tenant_id,
                user_id=user.id,
                reward_id=base_reward.id,
                milestone=milestone,
                reward_name=base_reward.title,
                status="used",
                created_at=datetime.datetime.utcnow(),
                redeemed_at=datetime.datetime.utcnow(),
                order_id=order_id,
            )
            db.add(redemption)
        db.commit()

        return {
            "success": True,
            "discount": discount,
            "reward": base_reward.title,
            "expiry": (redemption.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat(),
        }

    # --- MANUAL FLOW: Issue PIN for in-person ---
    else:
        redemption = ensure_pending_redemption(db, user, milestone, base_reward)
        pin = redemption.pin
        return {
            "success": True,
            "reward": base_reward.title,
            "pin": pin,
            "expiry": (redemption.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat(),
        }

@router.post("/expire-redemptions", include_in_schema=False)
def expire_redemptions_endpoint(
    db: Session = Depends(get_db),
):
    expire_old_redemptions(db)
    return {"expired": True}
