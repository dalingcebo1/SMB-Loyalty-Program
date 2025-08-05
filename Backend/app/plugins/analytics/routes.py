from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from app.core.database import get_db
from app.models import User, Payment, PointBalance, Redemption, Reward, VisitCount
from datetime import datetime, timedelta, date
from app.plugins.auth.routes import require_admin

from .schemas import AnalyticsSummaryResponse
router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_admin)])

@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    summary="Get summary statistics for the dashboard"
)
def get_summary(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # date range for time series (default: last 7 days)
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # User count (all users)
    user_count = db.query(User).count()
    # Transaction count (all transactions)
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
    # User growth over date range
    user_growth = []
    cur = start
    while cur <= end:
        cnt = db.query(User).filter(cast(User.created_at, Date) == cur).count()
        user_growth.append({"date": cur.strftime("%Y-%m-%d"), "count": cnt})
        cur += timedelta(days=1)
    # Transaction volume over date range
    transaction_volume = []
    cur = start
    while cur <= end:
        val = db.query(func.sum(Payment.amount)).filter(func.date(Payment.created_at) == cur).scalar() or 0
        transaction_volume.append({"date": cur.strftime("%Y-%m-%d"), "value": val})
        cur += timedelta(days=1)
    # Tier distribution (if you have a role/tier field)
    tier_distribution = (
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )
    tier_distribution = [
        {"tier": role, "count": count} for role, count in tier_distribution
    ]
    # Visits total
    visits_total = db.query(func.sum(VisitCount.count)).scalar() or 0
    # Visits over time over date range
    visits_over_time = []
    cur = start
    while cur <= end:
        tot = db.query(func.sum(VisitCount.count)).filter(cast(VisitCount.updated_at, Date) == cur).scalar() or 0
        visits_over_time.append({"date": cur.strftime("%Y-%m-%d"), "count": tot})
        cur += timedelta(days=1)
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
