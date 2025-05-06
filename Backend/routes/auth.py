import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from database import get_db
from models import User
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# ─── CONFIG ────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

RESET_SECRET = os.getenv("RESET_SECRET", "CHANGE_THIS_TO_A_DIFFERENT_SECRET")
RESET_TOKEN_EXPIRE_SECONDS = 60 * 30  # 30 minutes

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
RESET_EMAIL_FROM = os.getenv("RESET_EMAIL_FROM", "no-reply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

reset_serializer = URLSafeTimedSerializer(RESET_SECRET)

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── SCHEMAS ────────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class ConfirmOtpRequest(BaseModel):
    session_id: str
    code: str
    first_name: str
    last_name: str
    phone: str
    email: EmailStr
    tenant_id: str

class Token(BaseModel):
    access_token: str

class UserOut(BaseModel):
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    onboarded: Optional[bool]
    tenant_id: str

class PasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str

class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class PasswordResetEmailRequest(BaseModel):
    email: EmailStr

class PasswordResetTokenRequest(BaseModel):
    token: str
    new_password: str

# ─── UTILS ────────────────────────────────────────────────────────────────
def get_password_hash(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(email: str):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
        user = db.query(User).filter_by(email=email).first()
        if not user:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception

# ─── ENDPOINTS ─────────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        hashed_password=get_password_hash(req.password),
        onboarded=False,
        created_at=datetime.utcnow(),
        tenant_id="default",  # Set appropriately for your app
    )
    db.add(user)
    db.commit()
    return {"message": "Signup successful. Please complete onboarding to verify your phone."}

@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.onboarded:
        raise HTTPException(status_code=403, detail="Complete onboarding to login")
    token = create_access_token(user.email)
    return {"access_token": token}

@router.post("/confirm-otp", response_model=Token)
async def confirm_otp(req: ConfirmOtpRequest, db: Session = Depends(get_db)):
    # TODO: Verify OTP with Firebase using req.session_id and req.code

    user = db.query(User).filter_by(email=req.email).first()
    if not user:
        user = User(
            email=req.email,
            phone=req.phone,
            first_name=req.first_name,
            last_name=req.last_name,
            onboarded=True,
            created_at=datetime.utcnow(),
            tenant_id="default",
        )
        db.add(user)
    else:
        user.phone = req.phone
        user.first_name = req.first_name
        user.last_name = req.last_name
        user.onboarded = True
        user.tenant_id = "default"  # Always force default for now
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="User creation failed. Please try again.") from e

    token = create_access_token(req.email)
    return {"access_token": token}

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    if not current.onboarded:
        raise HTTPException(status_code=403, detail="User not onboarded")
    return UserOut(
        email=current.email,
        first_name=current.first_name,
        last_name=current.last_name,
        phone=current.phone,
        onboarded=current.onboarded,
        tenant_id=current.tenant_id,
    )

@router.put("/me", response_model=UserOut)
def update_me(
    req: UserUpdateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.first_name is not None:
        current.first_name = req.first_name
    if req.last_name is not None:
        current.last_name = req.last_name
    if req.phone is not None:
        current.phone = req.phone
    db.commit()
    return UserOut(
        email=current.email,
        first_name=current.first_name,
        last_name=current.last_name,
        phone=current.phone,
        onboarded=current.onboarded,
        tenant_id=current.tenant_id,
    )

@router.post("/reset-password", status_code=200)
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/request-password-reset")
def request_password_reset(req: PasswordResetEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if not user:
        # Do not reveal if user exists
        return {"message": "If the email exists, a reset link will be sent."}
    token = reset_serializer.dumps(user.email)
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    # Send email
    if SENDGRID_API_KEY:
        message = Mail(
            from_email=RESET_EMAIL_FROM,
            to_emails=user.email,
            subject="Password Reset Request",
            html_content=f"""
                <p>Hello,</p>
                <p>Click the link below to reset your password:</p>
                <p><a href="{reset_link}">{reset_link}</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            """
        )
        try:
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            print("SendGrid error:", e)
            # Optionally: log error, but do not reveal to user

    return {"message": "If the email exists, a reset link will be sent."}

@router.post("/reset-password-confirm")
def reset_password_confirm(req: PasswordResetTokenRequest, db: Session = Depends(get_db)):
    try:
        email = reset_serializer.loads(req.token, max_age=RESET_TOKEN_EXPIRE_SECONDS)
    except SignatureExpired:
        raise HTTPException(status_code=400, detail="Reset token expired")
    except BadSignature:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password reset successful"}
