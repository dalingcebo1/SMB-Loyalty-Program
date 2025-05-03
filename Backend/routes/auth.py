

    # Backend/auth.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime
import random

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str


class SendOTPRequest(BaseModel):
    email: str
    phone: str


class SendOTPResponse(BaseModel):
    session_id: str


class ConfirmOTPRequest(BaseModel):
    session_id: str
    code: str
    firstName: str
    lastName: str


# Shape of the in-memory user record:
# {
#   email: str,
#   password: str,
#   onboarded: bool,
#   firstName: str,
#   lastName: str,
#   phone: Optional[str],
#   id: int
# }
users_db: Dict[str, dict] = {}

# OTP store: session_id → { code, email, phone }
otp_db: Dict[str, dict] = {}


@router.post("/signup", status_code=201)
def signup(req: SignupRequest):
    if req.email in users_db:
        raise HTTPException(400, "Email already registered")
    users_db[req.email] = {
        "email": req.email,
        "password": req.password,
        "onboarded": False,
        "firstName": "",
        "lastName": "",
        "phone": None,
        "id": len(users_db) + 1,
    }
    return {"message": "Signup successful"}


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = users_db.get(req.email)
    if not user:
        # not even signed up yet
        raise HTTPException(404, "User not found")
    if not user["onboarded"]:
        # prompt frontend to send them back to onboarding
        raise HTTPException(404, "Not onboarded")
    if user["password"] != req.password:
        raise HTTPException(401, "Incorrect credentials")
    # stub “token” is just the email
    return {"token": req.email}


@router.get("/me")
def me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    token = authorization.split(" ", 1)[1]
    user = users_db.get(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    if not user["onboarded"]:
        raise HTTPException(404, "Not onboarded")
    return {
        "id": user["id"],
        "firstName": user["firstName"],
        "lastName": user["lastName"],
        "email": user["email"],
        "phone": user["phone"],
    }


@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(req: SendOTPRequest):
    user = users_db.get(req.email)
    if not user:
        raise HTTPException(404, "User not found")
    # generate a unique session ID + a 6-digit code
    session_id = f"{req.email}-{int(datetime.utcnow().timestamp())}"
    code = f"{random.randint(100000, 999999)}"
    otp_db[session_id] = {"code": code, "email": req.email, "phone": req.phone}
    # in real life you'd SMS the code; here we just log it
    print(f"[OTP] → {req.phone}: code={code}, session={session_id}")
    return {"session_id": session_id}


@router.post("/confirm-otp", response_model=LoginResponse)
def confirm_otp(req: ConfirmOTPRequest):
    rec = otp_db.get(req.session_id)
    if not rec or rec["code"] != req.code:
        raise HTTPException(401, "Invalid session or code")
    # mark the user onboarded
    user = users_db[rec["email"]]
    user["onboarded"] = True
    user["firstName"] = req.firstName
    user["lastName"] = req.lastName
    user["phone"] = rec["phone"]
    # return the same “token” we use elsewhere
    return {"token": user["email"]}
