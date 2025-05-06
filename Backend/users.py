from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    uid:        str
    firstName:  str
    lastName:   str
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
        "firstName": payload.firstName,
        "lastName":  payload.lastName,
        "phone":     payload.phone,
        "subscribe": payload.subscribe,
    }
