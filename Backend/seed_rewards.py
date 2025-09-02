# seed_rewards.py
import os
import datetime
from dotenv import load_dotenv
from app.core.database import SessionLocal
from app.models import Reward

load_dotenv()    # so DATABASE_URL, etc

def main():
    db = SessionLocal()
    try:
        existing = db.query(Reward).filter_by(tenant_id="default", title="6th Full Wash FREE").first()
        if existing:
            print("Reward already exists; skipping.")
            return
        r = Reward(
            tenant_id  = "default",
            title      = "6th Full Wash FREE",
            type       = "milestone",
            milestone  = 5,
            created_at = datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(r); db.commit()
        print("✅ Seeded reward:", r)
    finally:
        db.close()

if __name__ == "__main__":
    main()
