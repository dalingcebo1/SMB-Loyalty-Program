import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query  # type: ignore
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from jose import JWTError, jwt  # type: ignore
from passlib.context import CryptContext  # type: ignore
from pydantic import BaseModel, EmailStr  # type: ignore
from app.core.database import get_db
from app.models import User, VisitCount, Vehicle
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired  # type: ignore
from sendgrid import SendGridAPIClient  # type: ignore
from sendgrid.helpers.mail import Mail  # type: ignore
from sqlalchemy import or_  # type: ignore
from app.plugins.loyalty.routes import REWARD_INTERVAL
import logging

logger = logging.getLogger("vehicle_manager")
logging.basicConfig(level=logging.INFO)

# ─── CONFIG ────────────────────────────────────────────────────────────────
from config import settings

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

reset_serializer = URLSafeTimedSerializer(settings.reset_secret)

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

def create_access_token(email: str):
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": email, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.algorithm)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    from jose.exceptions import ExpiredSignatureError  # type: ignore
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

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user

def require_staff(current_user: User = Depends(get_current_user)):
    if current_user.role not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required",
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

    existing_by_email = db.query(User).filter_by(email=req.email).first()
    existing_by_phone = db.query(User).filter_by(phone=req.phone).first()
    if existing_by_email and existing_by_email.phone and existing_by_email.phone != req.phone:
        raise HTTPException(status_code=400, detail="Email already registered with a different phone.")
    if existing_by_phone and existing_by_phone.email and existing_by_phone.email != req.email:
        raise HTTPException(status_code=400, detail="Phone already registered with a different email.")
    if not existing_by_email and not existing_by_phone:
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
        user = existing_by_email or existing_by_phone
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
        id=current.id,
        email=current.email,
        first_name=current.first_name,
        last_name=current.last_name,
        phone=current.phone,
        onboarded=current.onboarded,
        tenant_id=current.tenant_id,
        role=current.role,
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
        id=current.id,
        email=current.email,
        first_name=current.first_name,
        last_name=current.last_name,
        phone=current.phone,
        onboarded=current.onboarded,
        tenant_id=current.tenant_id,
        role=current.role,
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
    reset_link = f"{settings.frontend_url}/reset-password?token={token}"

    # Send email
    if settings.sendgrid_api_key:
        message = Mail(
            from_email=settings.reset_email_from,
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
            sg = SendGridAPIClient(settings.sendgrid_api_key)
            sg.send(message)
        except Exception as e:
            print("SendGrid error:", e)
            # Optionally: log error, but do not reveal to user

    return {"message": "If the email exists, a reset link will be sent."}

@router.post("/reset-password-confirm")
def reset_password_confirm(req: PasswordResetTokenRequest, db: Session = Depends(get_db)):
    try:
        email = reset_serializer.loads(req.token, max_age=settings.reset_token_expire_seconds)
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

@router.post("/register-staff", status_code=201)
def register_staff(
    req: StaffRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if db.query(User).filter_by(email=req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        hashed_password=get_password_hash(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        onboarded=True,
        created_at=datetime.utcnow(),
        tenant_id=req.tenant_id,
        role="staff",
    )
    db.add(user)
    db.commit()
    return {"message": "Staff registered successfully"}

@router.patch("/users/{user_id}/role", status_code=200)
def update_user_role(
    user_id: int,
    new_role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if new_role not in ["user", "staff", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    user.role = new_role
    db.commit()
    return {"message": f"User role updated to {new_role}"}

@router.get("/payments/verify/{ref}")
def verify_payment(
    ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Implement your payment verification logic here
    # For now, just simulate:
    if ref == "valid":
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Invalid or unpaid reference")

@router.post("/visits/manual")
def log_manual_visit(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),  # <-- restrict to staff
):
    cellphone = data.get("cellphone")
    if not cellphone or not cellphone.isdigit() or len(cellphone) != 10:
        raise HTTPException(status_code=400, detail="Invalid cellphone number")

    norm_cell = "+27" + cellphone[1:] if cellphone.startswith("0") else cellphone

    user = db.query(User).filter(
        or_(
            User.phone == cellphone,
            User.phone == norm_cell,
        )
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    visit_count = db.query(VisitCount).filter_by(user_id=user.id, tenant_id=user.tenant_id).first()
    if visit_count:
        visit_count.count += 1
        visit_count.updated_at = datetime.utcnow()
    else:
        visit_count = VisitCount(
            user_id=user.id,
            tenant_id=user.tenant_id,
            count=1,
            updated_at=datetime.utcnow()
        )
        db.add(visit_count)
    db.commit()

    # compute next loyalty milestone
    next_ms = ((visit_count.count // REWARD_INTERVAL) + 1) * REWARD_INTERVAL
    return {
        "message": f"Visit logged for {user.first_name} {user.last_name} ({user.phone})",
        "phone": user.phone,
        "name": f"{user.first_name} {user.last_name}".strip(),
        "count": visit_count.count,
        # return camelCase nextMilestone for frontend consistency
        "nextMilestone": next_ms,
    }

@router.get("/users/search")
def search_users(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),  # <-- restricts to staff/admin
):
    norm_query = "+27" + query[1:] if query.startswith("0") and len(query) == 10 else query
    users = db.query(User).filter(
        or_(
            User.first_name.ilike(f"%{query}%"),
            User.last_name.ilike(f"%{query}%"),
            User.phone.ilike(f"%{query}%"),
            User.phone.ilike(f"%{norm_query}%"),
        )
    ).all()
    logger.info(f"User search by staff/admin {current_user.email} (id={current_user.id}): query='{query}', found={len(users)}")
    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "phone": u.phone,
            "email": u.email,
            "role": u.role,
        }
        for u in users
    ]

@router.get("/users/{user_id}/vehicles", response_model=list[VehicleOut])
def get_user_vehicles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    vehicles = db.query(Vehicle).filter_by(user_id=user_id).all()
    return vehicles

@router.post("/users/{user_id}/vehicles", status_code=201)
def add_vehicle(
    user_id: int,
    vehicle: VehicleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    v = Vehicle(user_id=user_id, plate=vehicle.plate, make=vehicle.make, model=vehicle.model)
    db.add(v)
    db.commit()
    db.refresh(v)
    logger.info(f"Vehicle added by {current_user.email} (id={current_user.id}) for user_id={user_id}: {vehicle.plate}, {vehicle.make}, {vehicle.model}")
    return {"message": "Vehicle added", "id": v.id}

@router.patch("/users/{user_id}/vehicles/{vehicle_id}")
def update_vehicle(
    user_id: int,
    vehicle_id: int,
    vehicle: VehicleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    v.plate = vehicle.plate
    v.make = vehicle.make
    v.model = vehicle.model
    db.commit()
    logger.info(f"Vehicle updated by {current_user.email} (id={current_user.id}) for user_id={user_id}, vehicle_id={vehicle_id}: {vehicle.plate}, {vehicle.make}, {vehicle.model}")
    return {"message": "Vehicle updated"}

@router.delete("/users/{user_id}/vehicles/{vehicle_id}")
def delete_vehicle(
    user_id: int,
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(v)
    db.commit()
    logger.info(f"Vehicle deleted by {current_user.email} (id={current_user.id}) for user_id={user_id}, vehicle_id={vehicle_id}")
    return {"message": "Vehicle deleted"}

