from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    uid:        str
    first_name: str
    last_name:  Optional[str] = None
    phone:      str
    subscribe:  bool

@router.post("", status_code=201)
def create_user(payload: UserCreate):
    """
    Called after Firebase OTP is confirmed.
    Persist the new user record (here we just echo back).
    """
    # TODO: replace with real DB persistence
    return {
        "id":        payload.uid,
        "first_name": payload.first_name,
        "last_name":  payload.last_name,
        "phone":      payload.phone,
        "subscribe":  payload.subscribe,
    }
