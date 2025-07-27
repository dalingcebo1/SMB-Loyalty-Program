from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from sqlalchemy import or_
from uuid import uuid4
from datetime import datetime
from app.models import InviteToken, Tenant
from config import settings

from app.core.database import get_db
from app.models import User, VisitCount, Vehicle

# ─── CONFIG ────────────────────────────────────────────────────────────────
from config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
reset_serializer = URLSafeTimedSerializer(settings.reset_secret)

router = APIRouter(prefix="", tags=["auth"])

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
    id: int
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    onboarded: Optional[bool]
    tenant_id: str
    role: str

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

class StaffRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str
    tenant_id: str

class VehicleIn(BaseModel):
    plate: str
    make: str
    model: str

class VehicleOut(BaseModel):
    id: int
    plate: str
    make: str
    model: str

# ─── UTILS ────────────────────────────────────────────────────────────────
def get_password_hash(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_access_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.algorithm)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    from jose.exceptions import ExpiredSignatureError
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if not email:
            raise credentials_exception
        user = db.query(User).filter_by(email=email).first()
        if not user:
            raise credentials_exception
        return user
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise credentials_exception


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required",
        )
    return current_user
    
def require_developer(current_user: User = Depends(get_current_user)) -> User:
    """Guard for developer-only pages"""
    if current_user.role not in ("developer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer privileges required",
        )
    return current_user

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
        tenant_id="default",
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
    # TODO: Verify OTP with Firebase if implemented
    existing_by_email = db.query(User).filter_by(email=req.email).first()
    existing_by_phone = db.query(User).filter_by(phone=req.phone).first()
    if existing_by_email and existing_by_email.phone and existing_by_email.phone != req.phone:
        raise HTTPException(status_code=400, detail="Email registered with different phone.")
    if existing_by_phone and existing_by_phone.email and existing_by_phone.email != req.email:
        raise HTTPException(status_code=400, detail="Phone registered with different email.")
    if not existing_by_email and not existing_by_phone:
        user = User(email=req.email, phone=req.phone, first_name=req.first_name, last_name=req.last_name, onboarded=True, created_at=datetime.utcnow(), tenant_id="default")
        db.add(user)
    else:
        user = existing_by_email or existing_by_phone
        user.phone = req.phone
        user.first_name = req.first_name
        user.last_name = req.last_name
        user.onboarded = True
        user.tenant_id = "default"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="User creation failed.")
    token = create_access_token(req.email)
    return {"access_token": token}

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    if not current.onboarded:
        raise HTTPException(status_code=403, detail="User not onboarded")
    return UserOut(
        id=current.id, email=current.email, first_name=current.first_name, last_name=current.last_name,
        phone=current.phone, onboarded=current.onboarded, tenant_id=current.tenant_id, role=current.role
    )

@router.put("/me", response_model=UserOut)
def update_me(req: UserUpdateRequest, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.first_name is not None: current.first_name = req.first_name
    if req.last_name is not None: current.last_name = req.last_name
    if req.phone is not None: current.phone = req.phone
    db.commit()
    return UserOut(id=current.id, email=current.email, first_name=current.first_name, last_name=current.last_name, phone=current.phone, onboarded=current.onboarded, tenant_id=current.tenant_id, role=current.role)

@router.post("/reset-password", status_code=200)
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/request-password-reset")
def request_password_reset(req: PasswordResetEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=req.email).first()
    if user:
        token = reset_serializer.dumps(user.email)
        reset_link = f"{settings.frontend_url}/reset-password?token={token}"
        if settings.sendgrid_api_key:
            msg = Mail(
                from_email=settings.reset_email_from,
                to_emails=user.email,
                subject="Password Reset Request",
                html_content=f"<p>Click to reset: <a href='{reset_link}'>{reset_link}</a></p>",
            )
            try:
                SendGridAPIClient(settings.sendgrid_api_key).send(msg)
            except:
                pass
    return {"message": "If the email exists, a reset link will be sent."}

@router.post("/reset-password-confirm")
def reset_password_confirm(req: PasswordResetTokenRequest, db: Session = Depends(get_db)):
    try:
        email = reset_serializer.loads(req.token, max_age=settings.reset_token_expire_seconds)
    except SignatureExpired: raise HTTPException(status_code=400, detail="Reset token expired")
    except BadSignature: raise HTTPException(status_code=400, detail="Invalid reset token")
    user = db.query(User).filter_by(email=email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password reset successful"}

@router.post("/register-staff", status_code=201)
def register_staff(req: StaffRegisterRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(User).filter_by(email=req.email).first(): raise HTTPException(status_code=400, detail="Email already registered")
    u = User(email=req.email, hashed_password=get_password_hash(req.password), first_name=req.first_name, last_name=req.last_name, phone=req.phone, onboarded=True, created_at=datetime.utcnow(), tenant_id=req.tenant_id, role="staff")
    db.add(u); db.commit()
    return {"message": "Staff registered successfully"}
 
# --- White-Glove Invite & Onboard Flow ---
class InviteValidationOut(BaseModel):
    tenant_id: str
    name: str
    loyalty_type: str
    subdomain: Optional[str]
    logo_url: Optional[str]
    theme_color: Optional[str]

@router.get("/validate-invite", response_model=InviteValidationOut)
def validate_invite(token: str, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter_by(token=token, used=False).first()
    if not invite or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")
    t = db.query(Tenant).filter_by(id=invite.tenant_id).first()
    return InviteValidationOut(
        tenant_id=t.id,
        name=t.name,
        loyalty_type=t.loyalty_type,
        subdomain=t.subdomain,
        logo_url=t.logo_url,
        theme_color=t.theme_color,
    )

class CompleteInviteRequest(BaseModel):
    token: str
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str

@router.post("/complete-invite", status_code=201)
def complete_invite(req: CompleteInviteRequest, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter_by(token=req.token, used=False).first()
    if not invite or invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")
    # create user as tenant-admin
    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(
        email=req.email,
        hashed_password=get_password_hash(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        onboarded=True,
        created_at=datetime.utcnow(),
        tenant_id=invite.tenant_id,
        role="admin",
    )
    db.add(u)
    # mark invite used
    invite.used = True
    db.commit()
    token = create_access_token(req.email)
    return {"access_token": token}

@router.patch("/users/{user_id}/role", status_code=200)
def update_user_role(user_id: int, new_role: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter_by(id=user_id).first();
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if new_role not in ("user","staff","admin"): raise HTTPException(status_code=400, detail="Invalid role")
    user.role = new_role; db.commit()
    return {"message": f"User role updated to {new_role}"}

@router.get("/payments/verify/{ref}")
def verify_payment_ref(ref: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if ref == "valid": return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Invalid or unpaid reference")






