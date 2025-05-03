# backend/routes/auth.py

import random
import uuid
from datetime import datetime, timedelta
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# ─── CONFIG ────────────────────────────────────────────────────────────────
SECRET_KEY = "CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ─── IN‐MEMORY DB (POC) ─────────────────────────────────────────────────────
fake_users: Dict[str, Dict] = {}
otp_sessions: Dict[str, Dict] = {}

# ─── SCHEMAS ────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class SendOTPRequest(BaseModel):
    email: EmailStr
    phone: str

class SendOTPResponse(BaseModel):
    session_id: str

class ConfirmOTPRequest(BaseModel):
    session_id: str
    code: str
    first_name: str
    last_name: str

# ─── HELPERS ────────────────────────────────────────────────────────────────
def get_password_hash(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email or email not in fake_users:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        user = fake_users[email]
        if not user["onboarded"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not onboarded"
            )
        return user
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


# ─── ROUTER ─────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=201)
def signup(req: SignupRequest):
    if req.email in fake_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    fake_users[req.email] = {
        "email": req.email,
        "hashed_password": get_password_hash(req.password),
        "onboarded": False,
        "first_name": "",
        "last_name": "",
        "phone": "",
    }
    return {"message": "Signup successful; please complete onboarding via OTP"}


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    # <<— DEBUG LOGGING
    print(f"🔥 [LOGIN REQUEST] username={form.username!r}, password={form.password!r}")

    user = fake_users.get(form.username)
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    if not user["onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not onboarded"
        )

    token = create_access_token(form.username)
    return {"access_token": token}


@router.get("/me", response_model=UserOut)
def me(current: Dict = Depends(get_current_user)):
    return {
        "email": current["email"],
        "first_name": current["first_name"],
        "last_name": current["last_name"],
        "phone": current["phone"],
    }


@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(req: SendOTPRequest):
    if req.email not in fake_users:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    session_id = str(uuid.uuid4())
    code = f"{random.randint(0, 999999):06d}"
    otp_sessions[session_id] = {
        "email": req.email,
        "phone": req.phone,
        "code": code,
        "expires": datetime.utcnow() + timedelta(minutes=10),
    }
    print(f"[DEBUG] OTP for {req.phone}: {code} (session {session_id})")
    return {"session_id": session_id}


@router.post("/confirm-otp", response_model=Token)
def confirm_otp(req: ConfirmOTPRequest):
    sess = otp_sessions.get(req.session_id)
    if (
        not sess
        or sess["code"] != req.code
        or sess["expires"] < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )

    user = fake_users[sess["email"]]
    user.update({
        "onboarded": True,
        "first_name": req.first_name,
        "last_name": req.last_name,
        "phone": sess["phone"],
    })
    del otp_sessions[req.session_id]

    token = create_access_token(sess["email"])
    return {"access_token": token}
