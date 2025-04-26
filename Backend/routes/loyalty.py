import os
import datetime
import jwt

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.qr import generate_qr_code  # adjust path if needed

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")

router = APIRouter(
    tags=["loyalty"],
    # mounted in main.py under prefix="/api"
)

# --- request schemas ---
class RegisterUser(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class PhoneIn(BaseModel):
    phone: str

class RedeemIn(BaseModel):
    token: str

# --- in-memory store (swap out for real DB later) ---
users_db: dict[str, dict] = {}

# --- endpoints ---
@router.post("/register")
def register_user(user: RegisterUser):
    """Create a new user or return existing token."""
    if user.phone in users_db:
        return {
            "message": "User already registered",
            "token": users_db[user.phone]["token"]
        }

    token = jwt.encode({
        "user_id": user.phone,
        "name": user.name,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
    }, SECRET_KEY, algorithm="HS256")

    users_db[user.phone] = {
        "name": user.name,
        "email": user.email,
        "token": token,
        "visits": 0,
        "claimed_rewards": [],
        "redeemed_history": []
    }

    return {
        "message": "User registered successfully",
        "token": token,
        "user": {
            "name": user.name,
            "phone": user.phone,
            "email": user.email
        }
    }


@router.post("/visit")
def log_visit(body: PhoneIn):
    """Increment visit count."""
    phone = body.phone
    if phone not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    users_db[phone]["visits"] += 1
    return {"message": "Visit logged", "total_visits": users_db[phone]["visits"]}


@router.get("/me")
def get_profile(phone: str):
    """Fetch user profile, visits & reward status."""
    if phone not in users_db:
        raise HTTPException(status_code=404, detail="User not found")

    user = users_db[phone]
    visits = user["visits"]
    claimed = set(user["claimed_rewards"])
    cycle = visits % 10

    ready = []
    upcoming = []

    # cycle rewards
    if 5 <= cycle < 10 and "5" not in claimed:
        ready.append({"milestone": 5, "reward": "Interior Wash"})
    if cycle == 0 and visits > 0 and "10" not in claimed:
        ready.append({"milestone": 10, "reward": "Full Wash + Coffee"})

    # upcoming
    if cycle < 5:
        upcoming.append({
            "milestone": 5,
            "reward": "Interior Wash",
            "visits_needed": 5 - cycle
        })
    else:
        upcoming.append({
            "milestone": 10,
            "reward": "Full Wash + Coffee",
            "visits_needed": 10 - cycle
        })

    # valet every 15 visits
    if visits % 15 == 0 and visits > 0 and f"valet-{visits}" not in claimed:
        ready.append({"milestone": visits, "reward": "Valet Service"})
    next_valet = ((visits // 15) + 1) * 15
    upcoming.append({
        "milestone": next_valet,
        "reward": "Valet Service",
        "visits_needed": next_valet - visits
    })

    return {
        "name": user["name"],
        "email": user["email"],
        "phone": phone,
        "total_visits": visits,
        "rewards_ready_to_claim": ready,
        "upcoming_rewards": sorted(upcoming, key=lambda x: x["milestone"]),
        "redeemed_history": user["redeemed_history"]
    }


@router.post("/reward")
def claim_reward(body: PhoneIn):
    """Issue JWT + QR for any new milestones."""
    phone = body.phone
    if phone not in users_db:
        raise HTTPException(status_code=404, detail="User not found")

    user = users_db[phone]
    visits = user["visits"]
    claimed = user["claimed_rewards"]
    cycle = visits % 10

    new_rewards: list[tuple[str,str]] = []
    if 5 <= cycle < 10 and "5" not in claimed:
        new_rewards.append(("5", "Interior Wash"))
    if cycle == 0 and visits > 0 and "10" not in claimed:
        new_rewards.append(("10", "Full Wash + Coffee"))
    if visits % 15 == 0 and visits > 0:
        key = f"valet-{visits}"
        if key not in claimed:
            new_rewards.append((key, "Valet Service"))

    if not new_rewards:
        return {"message": "No new rewards", "rewards": []}

    out = []
    for key, reward in new_rewards:
        claimed.append(key)
        token = jwt.encode({
            "user_id": phone,
            "milestone": key,
            "reward": reward,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        }, SECRET_KEY, algorithm="HS256")

        qr = generate_qr_code(token)
        out.append({
            "milestone": key,
            "reward": reward,
            "token": token,
            "qr_code_base64": qr
        })

    return {"message": "Rewards issued", "rewards": out}


@router.post("/redeem")
def redeem(body: RedeemIn):
    """Consume a JWT, mark as redeemed, add to history."""
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    phone = payload["user_id"]
    key = payload["milestone"]
    reward = payload["reward"]

    if phone not in users_db:
        raise HTTPException(status_code=404, detail="User not found")

    user = users_db[phone]
    if key not in user["claimed_rewards"]:
        raise HTTPException(status_code=400, detail="Already redeemed")

    # move from claimed to history
    user["claimed_rewards"].remove(key)
    user["redeemed_history"].append({
        "milestone": key,
        "reward": reward,
        "timestamp": datetime.datetime.utcnow().isoformat()
    })

    return {
        "message": f"Redeemed {reward}",
        "phone": phone,
        "reward": reward,
        "milestone": key
    }
