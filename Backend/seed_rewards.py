# seed_rewards.py
import os
import datetime
from dotenv import load_dotenv
from app.core.database import SessionLocal
from models import Reward

load_dotenv()    # so DATABASE_URL, etc

def main():
    db = SessionLocal()
    try:
        r = Reward(
            tenant_id  = "default",
            title      = "6th Full Wash FREE",
            type       = "milestone",
            milestone  = 5,
            created_at = datetime.datetime.utcnow(),
        )
        db.add(r)
        db.commit()
        print("✅ Seeded reward:", r)
    finally:
        db.close()

if __name__ == "__main__":
    main()
