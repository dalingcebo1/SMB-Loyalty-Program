import os
import uuid
from datetime import datetime, timedelta
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# ─── CONFIG ────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ─── IN‐MEMORY “DB” ───────────────────────────────────────────────────────────
fake_users: Dict[str, Dict] = {}

# ─── SCHEMAS ────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    email:     EmailStr
    first_name: str
    last_name:  str
    phone:      str

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
        return fake_users[email]
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
        "email":           req.email,
        "hashed_password": get_password_hash(req.password),
        "first_name":      "",
        "last_name":       "",
        "phone":           "",
    }
    return {"message": "Signup successful. Please complete onboarding to verify your phone."}


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = fake_users.get(form.username)
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    token = create_access_token(form.username)
    return {"access_token": token}


@router.get("/me", response_model=UserOut)
def me(current: Dict = Depends(get_current_user)):
    return UserOut(
        email=current["email"],
        first_name=current.get("first_name", ""),
        last_name=current.get("last_name", ""),
        phone=current.get("phone", ""),
    )
