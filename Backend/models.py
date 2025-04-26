import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    phone = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    token = Column(String, nullable=False)
    visits = Column(Integer, default=0, nullable=False)

    pending_rewards = relationship(
        "PendingReward",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    redeemed_rewards = relationship(
        "RedeemedReward",
        back_populates="user",
        cascade="all, delete-orphan"
    )

class PendingReward(Base):
    __tablename__ = "pending_rewards"
    id = Column(Integer, primary_key=True, index=True)
    user_phone = Column(String, ForeignKey("users.phone"), nullable=False)
    milestone = Column(String, nullable=False)
    reward = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="pending_rewards")

class RedeemedReward(Base):
    __tablename__ = "redeemed_rewards"
    id = Column(Integer, primary_key=True, index=True)
    user_phone = Column(String, ForeignKey("users.phone"), nullable=False)
    milestone = Column(String, nullable=False)
    reward = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="redeemed_rewards")
