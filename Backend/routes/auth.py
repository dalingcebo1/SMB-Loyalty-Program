# Backend/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from utils.firebase_admin import admin_auth
from database import get_db
from models import User  # your SQLAlchemy User model

router = APIRouter()


# --- Dependency to verify Firebase ID token ---
async def get_current_user(authorization: str = Header(...)):
    """
    Extract Bearer <token> from header, verify with Firebase Admin,
    and return the decoded token (including uid, email, phone_number, etc).
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )
    id_token = authorization.split(" ", 1)[1]
    try:
        decoded = admin_auth.verify_id_token(id_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth token",
        )
    return decoded


# --- Request schemas ---
class SendOTPRequest(BaseModel):
    phone: str = Field(..., example="+27731234567")


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., example="+27731234567")
    code: str = Field(..., min_length=6, max_length=6, example="123456")


class OnboardRequest(BaseModel):
    first_name: str = Field(..., example="Jane")
    last_name:  str = Field(..., example="Doe")
    subscribe:  bool


# --- Stub endpoints for frontend to hit ---
@router.post(
    "/auth/send-otp",
    status_code=status.HTTP_200_OK,
    summary="(Stub) Trigger sending an OTP",
)
async def send_otp(req: SendOTPRequest):
    """
    Frontend uses Firebase JS SDK to actually send SMS.
    This stub just returns 200 so the call no longer 404s.
    """
    return {"status": "ok"}


@router.post(
    "/auth/verify-otp",
    status_code=status.HTTP_200_OK,
    summary="(Stub) Verify an OTP code",
)
async def verify_otp(req: VerifyOTPRequest):
    """
    Frontend uses Firebase JS SDK (`confirmationRef.confirm(code)`)
    to actually verify the code. This stub returns 200.
    """
    return {"status": "ok"}


# --- Onboarding: create user in our DB after Firebase auth ---
@router.post(
    "/auth/onboard",
    status_code=status.HTTP_201_CREATED,
    summary="Create user profile after Firebase authentication",
)
async def onboard_user(
    body: OnboardRequest,
    decoded_token: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies the Firebase ID token, then creates a user record
    in our database using the Firebase UID as the primary key.
    """
    uid = decoded_token["uid"]
    # Prevent double‐onboarding
    existing = db.query(User).filter(User.firebase_uid == uid).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already onboarded.",
        )

    # Extract email/phone from the decoded token
    email = decoded_token.get("email")
    phone = decoded_token.get("phone_number")

    user = User(
        firebase_uid=uid,
        email=email,
        phone=phone,
        first_name=body.first_name,
        last_name=body.last_name,
        subscribed=body.subscribe,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"user_id": user.id}

from fastapi import Depends

#  --- Get onboarded user profile ---
@router.get(
    "/auth/me",
    status_code=status.HTTP_200_OK,
    summary="Return the onboarded user or 404 if not found",
)
async def get_my_user(
    decoded_token: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify the Firebase ID token, look up the user by firebase_uid.
    If not found, return 404.
    """
    uid = decoded_token["uid"]
    user = db.query(User).filter(User.firebase_uid == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not onboarded")
    return {
        "user_id":    user.id,
        "first_name": user.first_name,
        "last_name":  user.last_name,
        "email":      user.email,
        "phone":      user.phone,
        "subscribed": user.subscribed,
    }