from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from app.core.database import get_db
from app.models import User, Payment, PointBalance, Redemption, Reward, VisitCount
from datetime import datetime, timedelta

from .schemas import AnalyticsSummaryResponse
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/summary", response_model=AnalyticsSummaryResponse, summary="Get summary statistics for the dashboard")
def get_summary(db: Session = Depends(get_db)):
    # User count
    user_count = db.query(User).count()
    # Transaction count
    transaction_count = db.query(Payment).count()
    # Points issued (sum of all point balances)
    points_issued = db.query(func.sum(PointBalance.points)).scalar() or 0
    # Points redeemed (sum of actual reward costs for redeemed redemptions)
    points_redeemed = db.query(func.sum(Reward.cost))\
        .join(Redemption, Redemption.reward_id == Reward.id)\
        .filter(Redemption.status == 'redeemed')\
        .scalar() or 0
    # Redemptions count
    redemptions_count = db.query(func.count(Redemption.id))\
        .filter(Redemption.status == 'redeemed')\
        .scalar() or 0
    # User growth (new users per day for last 7 days)
    today = datetime.utcnow().date()
    user_growth = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        count = db.query(User).filter(cast(User.created_at, Date) == day).count()
        user_growth.append({"date": day.strftime("%Y-%m-%d"), "count": count})
    # Transaction volume (sum of payments per day for last 7 days)
    transaction_volume = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        value = db.query(func.sum(Payment.amount)).filter(func.date(Payment.created_at) == day).scalar() or 0
        transaction_volume.append({"date": day.strftime("%Y-%m-%d"), "value": value})
    # Tier distribution (if you have a role/tier field)
    tier_distribution = (
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )
    tier_distribution = [
        {"tier": role, "count": count} for role, count in tier_distribution
    ]
    # Visits total
    visits_total = db.query(func.sum(VisitCount.count)).scalar() or 0
    # Visits over time (last 7 days)
    visits_over_time = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        total = db.query(func.sum(VisitCount.count))\
            .filter(cast(VisitCount.updated_at, Date) == day)\
            .scalar() or 0
        visits_over_time.append({"date": day.strftime("%Y-%m-%d"), "count": total})
    # Top rewards redeemed
    top_rewards_data = (
        db.query(Reward.title, func.count(Redemption.id))
            .join(Redemption, Redemption.reward_id == Reward.id)
            .filter(Redemption.status == 'redeemed')
            .group_by(Reward.title)
            .order_by(func.count(Redemption.id).desc())
            .limit(5)
            .all()
    )
    top_rewards = [{"title": title, "count": cnt} for title, cnt in top_rewards_data]
    # Assemble summary
    return {
        "user_count": user_count,
        "transaction_count": transaction_count,
        "points_issued": points_issued,
        "points_redeemed": points_redeemed,
        "redemptions_count": redemptions_count,
        "user_growth": user_growth,
        "transaction_volume": transaction_volume,
        "tier_distribution": tier_distribution,
        "visits_total": visits_total,
        "visits_over_time": visits_over_time,
        "top_rewards": top_rewards,
    }
