from config import settings
import datetime
import secrets
import string
from typing import Optional, List

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query, status, Body, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import Tenant, User, VisitCount, Reward, Redemption, Order, Service, Extra, OrderItem
from app.utils.qr import generate_qr_code
from app.plugins.auth.routes import get_current_user

SECRET_KEY = settings.loyalty_secret
DEFAULT_TENANT = settings.default_tenant

REWARD_INTERVAL = 5  # visits per reward
EXPIRY_DAYS = 10     # days until voucher expiry

router = APIRouter(prefix="", dependencies=[Depends(get_current_user)], tags=["loyalty"])

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
    return jwt.encode({**payload, "exp": exp}, SECRET_KEY, algorithm=settings.algorithm)


def generate_unique_pin(db: Session, length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        pin = ''.join(secrets.choice(alphabet) for _ in range(length))
        if not db.query(Redemption).filter_by(pin=pin).first():
            return pin


def get_base_reward(db: Session, tenant_id: str) -> Optional[Reward]:
    return (
        db.query(Reward)
          .filter_by(tenant_id=tenant_id, type="milestone", milestone=REWARD_INTERVAL)
          .first()
    )


def ensure_pending_redemption(db: Session, user: User, milestone: int, base_reward: Reward) -> Redemption:
    existing = db.query(Redemption).filter_by(
        user_id=user.id, milestone=milestone, status="pending"
    ).first()
    if existing:
        return existing
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
            order_id=None
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


def expire_old_redemptions(db: Session) -> None:
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=EXPIRY_DAYS)
    old = (
        db.query(Redemption)
          .filter(Redemption.status == "pending", Redemption.created_at < cutoff)
          .all()
    )
    for r in old:
        r.status = "expired"
    if old:
        db.commit()


def is_full_wash(db: Session, order_items: List[OrderItem]) -> bool:
    if not order_items:
        return False
    extras_present = any(item.extras for item in order_items)
    return not extras_present


def calculate_extras_total(db: Session, order_items: List[OrderItem]) -> int:
    total = 0
    for item in order_items:
        # extras JSON contains list of {id, quantity}
        for ex in item.extras or []:
            extra = db.query(Extra).filter_by(id=ex.get("id")).first()
            if extra:
                price_map = extra.price_map or {}
                price = price_map.get(ex.get("category"), 0)
                total += price * ex.get("quantity", 1)
    return total

# ─── Endpoints ──────────────────────────────────────────────────────────────────
@router.get(
    "/me",
    summary="Get loyalty status and unlocked/upcoming rewards for current user"
)
def loyalty_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vc = db.query(VisitCount).filter_by(
        user_id=current_user.id, tenant_id=current_user.tenant_id
    ).first()
    visits = vc.count if vc else 0

    base = get_base_reward(db, current_user.tenant_id)
    if not base:
        return {"name": current_user.first_name, "phone": current_user.phone,
                "visits": visits, "rewards_ready": [], "upcoming_rewards": []}

    num_earned = visits // REWARD_INTERVAL
    redemptions = db.query(Redemption).filter_by(user_id=current_user.id).all()
    used = {r.milestone for r in redemptions if r.status == "used"}

    rewards_ready = []
    for i in range(1, num_earned + 1):
        milestone = i * REWARD_INTERVAL
        if milestone in used:
            continue
        rem = ensure_pending_redemption(db, current_user, milestone, base)
        token = _create_jwt({
            "user_id": current_user.id,
            "reward_id": base.id,
            "milestone": milestone,
            "reward": base.title
        }, minutes=10)
        expiry = (rem.created_at + datetime.timedelta(days=EXPIRY_DAYS)) if rem.created_at else None
        if not rem.pin or len(rem.pin) < 8:
            rem.pin = generate_unique_pin(db, 8)
            db.commit()
        rewards_ready.append({
            "milestone": milestone,
            "reward": base.title,
            "qr_reference": token,
            "pin": rem.pin,
            "status": rem.status,
            "expiry_at": expiry.isoformat() if expiry else None
        })

    next_ms = ((visits // REWARD_INTERVAL) + 1) * REWARD_INTERVAL
    upcoming = []
    if next_ms > visits:
        upcoming.append({
            "milestone": next_ms,
            "visits_needed": next_ms - visits,
            "reward": base.title
        })

    return {"name": current_user.first_name, "phone": current_user.phone,
            "visits": visits, "rewards_ready": rewards_ready,
            "upcoming_rewards": upcoming}

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register or re-issue token for a user"
)
def register_user(
    user: RegisterUser,
    db: Session = Depends(get_db)
):
    tenant = _ensure_tenant(db)

    dbu = (
        db.query(User)
          .filter_by(phone=user.phone, tenant_id=tenant.id)
          .first()
    )
    if dbu:
        token = _create_jwt({"user_id": dbu.id}, minutes=60)
        return AuthResponse(
            message="User already registered, token re-issued",
            token=token,
            user=UserInfo(
                first_name=dbu.first_name,
                last_name=dbu.last_name,
                phone=dbu.phone,
                email=dbu.email
            )
        )

    newu = User(
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        tenant_id=tenant.id,
        created_at=datetime.datetime.utcnow()
    )
    db.add(newu)
    db.commit()
    db.refresh(newu)

    token = _create_jwt({"user_id": newu.id}, minutes=60)
    return AuthResponse(
        message="User registered successfully",
        token=token,
        user=UserInfo(
            first_name=newu.first_name,
            last_name=newu.last_name,
            phone=newu.phone,
            email=newu.email
        )
    )

@router.post(
    "/visit",
    status_code=status.HTTP_200_OK,
    summary="Log a visit for a given phone number"
)
def log_visit(
    body: PhoneIn,
    db: Session = Depends(get_db)
):
    usr = (
        db.query(User)
          .filter_by(phone=body.phone, tenant_id=DEFAULT_TENANT)
          .first()
    )
    if not usr:
        raise HTTPException(status_code=404, detail="User not found")
    vc = db.query(VisitCount).filter_by(
        user_id=usr.id, tenant_id=usr.tenant_id
    ).first()
    if not vc:
        vc = VisitCount(user_id=usr.id, tenant_id=usr.tenant_id, count=0)
        db.add(vc)
    vc.count += 1
    db.commit()

    visits = vc.count
    base = get_base_reward(db, usr.tenant_id)
    if not base:
        return {"message": "Visit logged", "total_visits": visits, "reward_issued": None}

    milestone = (visits // REWARD_INTERVAL) * REWARD_INTERVAL or REWARD_INTERVAL
    used = {r.milestone for r in db.query(Redemption).filter_by(user_id=usr.id).all() if r.status=="used"}
    reward_issued = None
    if (visits % REWARD_INTERVAL == 0) and (milestone not in used):
        rem = ensure_pending_redemption(db, usr, milestone, base)
        reward_issued = {
            "milestone": milestone,
            "reward": base.title,
            "expiry": (rem.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat()
        }
    return {"message": "Visit logged", "total_visits": visits, "reward_issued": reward_issued}

@router.post(
    "/reward",
    summary="Issue QR-coded JWTs for new rewards"
)
def claim_reward(
    body: PhoneIn,
    db: Session = Depends(get_db)
):
    usr = (
        db.query(User)
          .filter_by(phone=body.phone, tenant_id=DEFAULT_TENANT)
          .first()
    )
    if not usr:
        raise HTTPException(status_code=404, detail="User not found")

    base = get_base_reward(db, usr.tenant_id)
    if not base:
        raise HTTPException(status_code=400, detail="No reward program found")

    vc = db.query(VisitCount).filter_by(
        user_id=usr.id, tenant_id=usr.tenant_id
    ).first()
    visits = vc.count if vc else 0

    milestone = (visits // REWARD_INTERVAL) * REWARD_INTERVAL or REWARD_INTERVAL
    used = {r.milestone for r in db.query(Redemption).filter_by(user_id=usr.id).all() if r.status=="used"}
    if milestone in used:
        raise HTTPException(status_code=400, detail="Reward already claimed for this milestone")

    rem = ensure_pending_redemption(db, usr, milestone, base)
    token = _create_jwt({
        "user_id": usr.id,
        "reward_id": base.id,
        "milestone": milestone,
        "reward": base.title
    }, minutes=10)

    return {
        "milestone": milestone,
        "reward": base.title,
        "qr_reference": token,
        "pin": rem.pin,
        "status": rem.status,
        "expiry_at": (rem.created_at + datetime.timedelta(days=EXPIRY_DAYS)).isoformat()
    }

@router.post(
    "/redeem",
    summary="Redeem a reward token"
)
def redeem(
    body: RedeemIn,
    db: Session = Depends(get_db)
):
    payload = jwt.decode(body.token, SECRET_KEY, algorithms=["HS256"])
    redemption = db.query(Redemption).filter_by(
        user_id=payload["user_id"],
        reward_id=payload["reward_id"],
        milestone=payload["milestone"],
        status="pending"
    ).first()
    if not redemption:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    redemption.status = "used"
    redemption.redeemed_at = datetime.datetime.utcnow()
    db.commit()

    return {"message": "Reward redeemed successfully", "milestone": redemption.milestone}

@router.post(
    "/expire-redemptions",
    include_in_schema=False
)
def expire_redemptions_endpoint(
    db: Session = Depends(get_db)
):
    expire_old_redemptions(db)
    return {"expired": True}


@router.get("/rewards", summary="List rewards for current tenant")
def list_rewards(
    ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = (
        db.query(Reward)
          .filter(Reward.tenant_id == ctx.id)
          .order_by(Reward.created_at.desc().nullslast())
          .limit(limit)
          .offset(offset)
    )
    rows = q.all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "type": r.type,
            "milestone": r.milestone,
            "tenant_id": r.tenant_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
