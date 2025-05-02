# Backend/users.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from schemas import ExistsResponse

router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get(
    "/{uid}/exists",
    response_model=ExistsResponse,
    summary="Check whether a user record already exists",
)
def user_exists(uid: str, db: Session = Depends(get_db)):
    """
    Return {"exists": true} if there is already a User row
    whose Firebase UID matches `uid`, otherwise false.
    """
    # ⚠️ Make sure your SQLAlchemy User model has a `uid = Column(String, unique=True, index=True)`  
    # to store the Firebase Auth UID. If you haven't added that column yet, add it now.
    record = db.query(models.User).filter(models.User.uid == uid).first()
    return ExistsResponse(exists=(record is not None))


# (Optional) existing create-user endpoint, if you have one:
# from pydantic import BaseModel
# class UserCreate(BaseModel):
#     uid: str
#     name: str
#     phone: str
#     email: Optional[str]
#
# @router.post("/", response_model=UserCreate)
# def create_user(user: UserCreate, db: Session = Depends(get_db)):
#     if db.query(models.User).filter(models.User.uid == user.uid).first():
#         raise HTTPException(400, "User already exists")
#     db_user = models.User(
#         uid=user.uid,
#         name=user.name,
#         phone=user.phone,
#         email=user.email,
#         tenant_id=user.tenant_id  # adjust as needed
#     )
#     db.add(db_user)
#     db.commit()
#     db.refresh(db_user)
#     return db_user
