from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from app.core.database import get_db
from app.models import User, Payment, PointBalance, Redemption, Reward, VisitCount, Order
from datetime import datetime, timedelta, date
from app.plugins.auth.routes import require_admin

from .schemas import AnalyticsSummaryResponse, UserDetails, TransactionDetails
router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_admin)])

@router.get(
    "/summary",
    response_model=AnalyticsSummaryResponse,
    summary="Get summary statistics for the dashboard"
)
def get_summary(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    tier: Optional[str] = Query(None, description="User role for segmentation"),
    campaign: Optional[str] = Query(None, description="Payment source filter"),
    device: Optional[str] = Query(None, description="Device type filter (not implemented)"),
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
    # User count (optionally by tier)
    user_q = db.query(User)
    if tier:
        user_q = user_q.filter(User.role == tier)
    user_count = user_q.count()
    # Transaction count within date range (with optional tier and campaign)
    trans_q = db.query(Payment)
    trans_q = trans_q.join(Order, Payment.order_id == Order.id)
    trans_q = trans_q.join(User, Order.user_id == User.id)
    trans_q = trans_q.filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    )
    if tier:
        trans_q = trans_q.filter(User.role == tier)
    if campaign:
        trans_q = trans_q.filter(Payment.source == campaign)
    transaction_count = trans_q.count()
    # Points issued within date range
    points_issued = db.query(func.sum(PointBalance.points)).filter(
        cast(PointBalance.updated_at, Date) >= start,
        cast(PointBalance.updated_at, Date) <= end
    ).scalar() or 0
    # Points redeemed within date range
    points_redeemed = db.query(func.sum(Reward.cost))\
        .join(Redemption, Redemption.reward_id == Reward.id)\
        .filter(
            Redemption.status == 'redeemed',
            cast(Redemption.created_at, Date) >= start,
            cast(Redemption.created_at, Date) <= end
        )\
        .scalar() or 0
    # Redemptions count within date range
    redemptions_count = db.query(func.count(Redemption.id))\
        .filter(
            Redemption.status == 'redeemed',
            cast(Redemption.created_at, Date) >= start,
            cast(Redemption.created_at, Date) <= end
        )\
        .scalar() or 0
    # User growth over date range (aggregate in one query)
    raw_growth = db.query(cast(User.created_at, Date).label('date'), func.count(User.id))\
        .filter(cast(User.created_at, Date) >= start, cast(User.created_at, Date) <= end)\
        .group_by('date').all()
    growth_dict = {r[0]: r[1] for r in raw_growth}
    user_growth = []
    cur = start
    while cur <= end:
        user_growth.append({"date": cur.strftime("%Y-%m-%d"), "count": growth_dict.get(cur, 0)})
        cur += timedelta(days=1)
    # Transaction volume over date range (aggregate)
    raw_volume = db.query(cast(Payment.created_at, Date).label('date'), func.sum(Payment.amount))\
        .filter(cast(Payment.created_at, Date) >= start, cast(Payment.created_at, Date) <= end)\
        .group_by('date').all()
    volume_dict = {r[0]: r[1] or 0 for r in raw_volume}
    transaction_volume = []
    cur = start
    while cur <= end:
        transaction_volume.append({"date": cur.strftime("%Y-%m-%d"), "value": volume_dict.get(cur, 0)})
        cur += timedelta(days=1)
    # Tier distribution (if you have a role/tier field)
    tier_distribution = (
        db.query(User.role, func.count(User.id)).group_by(User.role).all()
    )
    tier_distribution = [
        {"tier": role, "count": count} for role, count in tier_distribution
    ]
    # Visits total within date range
    visits_total = db.query(func.sum(VisitCount.count)).filter(
        cast(VisitCount.updated_at, Date) >= start,
        cast(VisitCount.updated_at, Date) <= end
    ).scalar() or 0
    # Visits over time (aggregate)
    raw_visits = db.query(cast(VisitCount.updated_at, Date).label('date'), func.sum(VisitCount.count))\
        .filter(cast(VisitCount.updated_at, Date) >= start, cast(VisitCount.updated_at, Date) <= end)\
        .group_by('date').all()
    visits_dict = {r[0]: r[1] or 0 for r in raw_visits}
    visits_over_time = []
    cur = start
    while cur <= end:
        visits_over_time.append({"date": cur.strftime("%Y-%m-%d"), "count": visits_dict.get(cur, 0)})
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

# Detailed metric endpoints for drill-downs
@router.get(
    "/users/details",
    response_model=UserDetails,
    summary="Get detailed user metrics such as DAU, WAU, MAU, retention, and churn"
)
def get_user_details(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    tier: Optional[str] = Query(None, description="User role filter"),
    campaign: Optional[str] = Query(None, description="Payment source filter"),
    db: Session = Depends(get_db)
):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # Daily active users
    dau_q = db.query(func.count(func.distinct(Order.user_id)))
    dau_q = dau_q.select_from(Payment).join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    dau_q = dau_q.filter(cast(Payment.created_at, Date) == end)
    if tier:
        dau_q = dau_q.filter(User.role == tier)
    if campaign:
        dau_q = dau_q.filter(Payment.source == campaign)
    dau = dau_q.scalar() or 0
    # Weekly active users (distinct users with payments in range)
    # Weekly active users
    wau_q = db.query(func.count(func.distinct(Order.user_id)))
    wau_q = wau_q.select_from(Payment).join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    wau_q = wau_q.filter(cast(Payment.created_at, Date) >= start, cast(Payment.created_at, Date) <= end)
    if tier:
        wau_q = wau_q.filter(User.role == tier)
    if campaign:
        wau_q = wau_q.filter(Payment.source == campaign)
    wau = wau_q.scalar() or 0
    # Monthly active users (distinct users in last 30 days)
    mau_start = end - timedelta(days=29)
    # Monthly active users
    mau_q = db.query(func.count(func.distinct(Order.user_id)))
    mau_q = mau_q.select_from(Payment).join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    mau_q = mau_q.filter(cast(Payment.created_at, Date) >= mau_start, cast(Payment.created_at, Date) <= end)
    if tier:
        mau_q = mau_q.filter(User.role == tier)
    if campaign:
        mau_q = mau_q.filter(Payment.source == campaign)
    mau = mau_q.scalar() or 0
    # Retention and churn rates
    prev_day = end - timedelta(days=1)
    # Previous day active users for retention
    prev_q = db.query(func.count(func.distinct(Order.user_id)))
    prev_q = prev_q.select_from(Payment).join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    prev_q = prev_q.filter(cast(Payment.created_at, Date) == prev_day)
    if tier:
        prev_q = prev_q.filter(User.role == tier)
    if campaign:
        prev_q = prev_q.filter(Payment.source == campaign)
    prev_dau = prev_q.scalar() or 0
    retention_rate = dau / prev_dau if prev_dau else 0.0
    churn_rate = 1 - retention_rate
    return {
        "dau": dau,
        "wau": wau,
        "mau": mau,
        "retention_rate": round(retention_rate, 4),
        "churn_rate": round(churn_rate, 4),
    }

@router.get(
    "/transactions/details",
    response_model=TransactionDetails,
    summary="Get transaction metrics like average value, per-user rate, conversion, and peak times"
)
def get_transaction_details(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    tier: Optional[str] = Query(None, description="User role filter"),
    campaign: Optional[str] = Query(None, description="Payment source filter"),
    db: Session = Depends(get_db)
):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # Transactions count and total value
    # Transactions count with filters
    trans_q = db.query(Payment)
    trans_q = trans_q.join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    trans_q = trans_q.filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    )
    if tier:
        trans_q = trans_q.filter(User.role == tier)
    if campaign:
        trans_q = trans_q.filter(Payment.source == campaign)
    trans_count = trans_q.count()
    total_value = trans_q.with_entities(func.sum(Payment.amount)).scalar() or 0
    # Compute average transaction value (from cents to rands)
    average_value = round((total_value / trans_count) / 100, 2) if trans_count else 0.0
    # Transactions per user (distinct users who made transactions)
    # Transactions per user
    user_q = db.query(func.count(func.distinct(Order.user_id)))
    user_q = user_q.select_from(Payment).join(Order, Payment.order_id == Order.id).join(User, Order.user_id == User.id)
    user_q = user_q.filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    )
    if tier:
        user_q = user_q.filter(User.role == tier)
    if campaign:
        user_q = user_q.filter(Payment.source == campaign)
    user_count = user_q.scalar() or 0
    per_user = trans_count / user_count if user_count else 0.0
    # Conversion rate: transactions vs visits
    visit_sum = db.query(func.sum(VisitCount.count)).filter(
        cast(VisitCount.updated_at, Date) >= start,
        cast(VisitCount.updated_at, Date) <= end
    ).scalar() or 0
    conversion_rate = trans_count / visit_sum if visit_sum else 0.0
    # Peak hours/day extraction with fallback and string coercion
    try:
        dialect = db.bind.dialect.name if db.bind else 'default'
        if dialect == 'sqlite':
            hour_expr = func.strftime('%H', Payment.created_at).label('hour')
            day_expr = func.strftime('%w', Payment.created_at).label('day')  # 0=Sunday
        else:
            hour_expr = func.date_part('hour', Payment.created_at).label('hour')
            day_expr = func.date_part('dow', Payment.created_at).label('day')
        peak_hours_data = db.query(hour_expr, func.count(Payment.id)).filter(
            cast(Payment.created_at, Date) >= start,
            cast(Payment.created_at, Date) <= end
        ).group_by('hour').order_by(func.count(Payment.id).desc()).limit(3).all()
        peak_hours = [{"hour": str(int(hr)) if isinstance(hr, (int, float)) else str(hr), "count": cnt}
                      for hr, cnt in peak_hours_data]
        peak_days_data = db.query(day_expr, func.count(Payment.id)).filter(
            cast(Payment.created_at, Date) >= start,
            cast(Payment.created_at, Date) <= end
        ).group_by('day').order_by(func.count(Payment.id).desc()).limit(3).all()
        peak_days = [{"day": str(int(day)) if isinstance(day, (int, float)) else str(day), "count": cnt}
                     for day, cnt in peak_days_data]
    except Exception:
        peak_hours = []
        peak_days = []
    return {
        "average_value": round(average_value, 2),
        "per_user": round(per_user, 2),
        "conversion_rate": round(conversion_rate, 4),
        "peak_hours": peak_hours,
        "peak_days": peak_days,
    }

@router.get(
    "/points/details",
    summary="Get points metrics including issued/redeemed over time and redemption rate"
)
def get_points_details(
     start_date: Optional[date] = Query(None),
     end_date: Optional[date] = Query(None),
     tier: Optional[str] = Query(None, description="User role filter"),
     campaign: Optional[str] = Query(None, description="Payment source filter (not applied)"),
     db: Session = Depends(get_db)
 ):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # Choose grouping: daily or monthly for large ranges
    days_range = (end - start).days
    use_monthly = days_range > 365

    # Points issued series
    if use_monthly:
        # Group by month
        dialect = db.bind.dialect.name if db.bind else 'default'
        month_expr = (
            func.strftime('%Y-%m-01', PointBalance.updated_at)
            if dialect == 'sqlite'
            else func.date_trunc('month', PointBalance.updated_at)
        ).label('month')
        issued_q = db.query(month_expr, func.sum(PointBalance.points).label('value'))
        issued_q = issued_q.filter(
            cast(PointBalance.updated_at, Date) >= start,
            cast(PointBalance.updated_at, Date) <= end
        )
        if tier:
            issued_q = issued_q.join(User, PointBalance.user_id == User.id).filter(User.role == tier)
        issued_data = issued_q.group_by(month_expr).order_by(month_expr).all()
        points_issued_series = [
            {
                'date': row.month.strftime('%Y-%m-%d') if hasattr(row.month, 'strftime') else str(row.month),
                'value': row.value or 0
            }
            for row in issued_data
        ]
    else:
        daily_issued_q = db.query(
            cast(PointBalance.updated_at, Date).label('date'),
            func.sum(PointBalance.points).label('value')
        ).filter(
            cast(PointBalance.updated_at, Date) >= start,
            cast(PointBalance.updated_at, Date) <= end
        )
        if tier:
            daily_issued_q = daily_issued_q.join(User, PointBalance.user_id == User.id).filter(User.role == tier)
        daily_issued = daily_issued_q.group_by('date').order_by('date').all()
        issued_dict = {row.date: row.value or 0 for row in daily_issued}
        points_issued_series = []
        cur = start
        while cur <= end:
            points_issued_series.append({
                'date': cur.strftime('%Y-%m-%d'),
                'value': issued_dict.get(cur, 0)
            })
            cur += timedelta(days=1)

    # Points redeemed series (daily or monthly)
    if use_monthly:
        dialect = db.bind.dialect.name if db.bind else 'default'
        month_expr = (func.strftime('%Y-%m-01', Redemption.created_at)
                      if dialect == 'sqlite'
                      else func.date_trunc('month', Redemption.created_at)).label('month')
        redeemed_data = (
            db.query(month_expr, func.sum(Reward.cost).label('value'))
            .join(Reward, Redemption.reward_id == Reward.id)
            .filter(
                cast(Redemption.created_at, Date) >= start,
                cast(Redemption.created_at, Date) <= end,
                Redemption.status == 'redeemed'
            )
            .group_by(month_expr)
            .order_by(month_expr)
            .all()
        )
        points_redeemed_series = [
            {
                'date': row.month.strftime('%Y-%m-%d') if hasattr(row.month, 'strftime') else str(row.month),
                'value': row.value or 0
            }
            for row in redeemed_data
        ]
    else:
        daily_redeemed_q = (
            db.query(cast(Redemption.created_at, Date).label('date'),
                     func.sum(Reward.cost).label('value'))
            .join(Reward, Redemption.reward_id == Reward.id)
            .filter(
                cast(Redemption.created_at, Date) >= start,
                cast(Redemption.created_at, Date) <= end,
                Redemption.status == 'redeemed'
            )
        )
        if tier:
            daily_redeemed_q = daily_redeemed_q.join(User, Redemption.user_id == User.id).filter(User.role == tier)
        daily_redeemed = daily_redeemed_q.group_by('date').order_by('date').all()
        redeemed_dict = {row.date: row.value or 0 for row in daily_redeemed}
        points_redeemed_series = []
        cur = start
        while cur <= end:
            points_redeemed_series.append({'date': cur.strftime('%Y-%m-%d'),
                                           'value': redeemed_dict.get(cur, 0)})
            cur += timedelta(days=1)
    # Overall rates and averages
    total_issued = sum(item["value"] for item in points_issued_series)
    total_redeemed = sum(item["value"] for item in points_redeemed_series)
    redemption_rate = total_redeemed / total_issued if total_issued else 0.0
    trans_count = db.query(Payment).filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    ).count()
    avg_points_per_transaction = total_issued / trans_count if trans_count else 0.0
    return {
        "points_issued_over_time": points_issued_series,
        "points_redeemed_over_time": points_redeemed_series,
        "redemption_rate": round(redemption_rate, 4),
        "avg_points_per_transaction": round(avg_points_per_transaction, 2),
    }

@router.get(
    "/redemptions/details",
    summary="Get redemption metrics such as total redemptions, avg cost, and reward conversion"
)
def get_redemptions_details(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    tier: Optional[str] = Query(None, description="User role filter"),
    campaign: Optional[str] = Query(None, description="Payment source filter (not applied)"),
    db: Session = Depends(get_db)
):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # Total redemptions and cost
    total_redemptions = db.query(func.count(Redemption.id))\
        .filter(cast(Redemption.created_at, Date) >= start, cast(Redemption.created_at, Date) <= end, Redemption.status == 'redeemed')\
        .scalar() or 0
    total_cost = db.query(func.sum(Reward.cost))\
        .join(Redemption, Redemption.reward_id == Reward.id)\
        .filter(cast(Redemption.created_at, Date) >= start, cast(Redemption.created_at, Date) <= end, Redemption.status == 'redeemed')\
        .scalar() or 0
    avg_redemption_cost = total_cost / total_redemptions if total_redemptions else 0.0
    # Conversion: redemptions vs transactions
    trans_count = db.query(Payment).filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    ).count()
    conversion_rate = total_redemptions / trans_count if trans_count else 0.0
    return {
        "total_redemptions": total_redemptions,
        "avg_redemption_cost": round(avg_redemption_cost, 2),
        "reward_conversion_rate": round(conversion_rate, 4),
    }

@router.get(
    "/visits/details",
    summary="Get visit metrics like total visits per user and peak visit times"
)
def get_visits_details(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # Total visits in range
    visits_total_period = db.query(func.sum(VisitCount.count))\
        .filter(cast(VisitCount.updated_at, Date) >= start, cast(VisitCount.updated_at, Date) <= end)\
        .scalar() or 0
    user_total = db.query(User).count() or 1
    visits_per_user = visits_total_period / user_total
    # Peak visit hours/day extraction with fallback and string coercion
    try:
        dialect = db.bind.dialect.name if db.bind else 'default'
        if dialect == 'sqlite':
            v_hour_expr = func.strftime('%H', VisitCount.updated_at).label('hour')
            v_day_expr = func.strftime('%w', VisitCount.updated_at).label('day')
        else:
            v_hour_expr = func.date_part('hour', VisitCount.updated_at).label('hour')
            v_day_expr = func.date_part('dow', VisitCount.updated_at).label('day')
        peak_visit_hours_data = db.query(v_hour_expr, func.sum(VisitCount.count)).filter(
            cast(VisitCount.updated_at, Date) >= start,
            cast(VisitCount.updated_at, Date) <= end
        ).group_by('hour').order_by(func.sum(VisitCount.count).desc()).limit(3).all()
        peak_visit_hours = [{"hour": str(int(hr)) if isinstance(hr, (int, float)) else str(hr), "count": cnt}
                            for hr, cnt in peak_visit_hours_data]
        peak_visit_days_data = db.query(v_day_expr, func.sum(VisitCount.count)).filter(
            cast(VisitCount.updated_at, Date) >= start,
            cast(VisitCount.updated_at, Date) <= end
        ).group_by('day').order_by(func.sum(VisitCount.count).desc()).limit(3).all()
        peak_visit_days = [{"day": str(int(day)) if isinstance(day, (int, float)) else str(day), "count": cnt}
                           for day, cnt in peak_visit_days_data]
    except Exception:
        peak_visit_hours = []
        peak_visit_days = []
    return {
        "visits_per_user": round(visits_per_user, 2),
        "peak_visit_hours": peak_visit_hours,
        "peak_visit_days": peak_visit_days,
    }

@router.get(
    "/loyalty/details",
    summary="Get loyalty tier metrics like progression rates and avg time in tier"
)
def get_loyalty_details(
    db: Session = Depends(get_db)
):
    # compute current tier distribution
    tiers = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    tier_progression = [{"tier": role, "count": cnt} for role, cnt in tiers]
    # average time in tier (days) based on user.created_at
    users = db.query(User.role, User.created_at).all()
    today = datetime.utcnow().date()
    time_data: dict[str, list[int]] = {}
    for role, created in users:
        days = (today - created.date()).days
        time_data.setdefault(role, []).append(days)
    avg_time_in_tier = [
        {"tier": role, "avg_days": round(sum(days_list) / len(days_list), 1)}
        for role, days_list in time_data.items()
    ]
    return {
        "tier_progression": tier_progression,
        "avg_time_in_tier": avg_time_in_tier,
    }

@router.get(
    "/top-clients",
    summary="Get top clients by count, value, points, and visits"
)
def get_top_clients(
    limit: int = Query(5, ge=1, le=50),  # clamp between 1 and 50
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    # aggregate transaction counts and values per user in one query
    # apply date range default: last 7 days if not provided
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    trans_query = (
        db.query(
            User,
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('value')
        )
        .join(Order, Order.user_id == User.id)
        .join(Payment, Payment.order_id == Order.id)
        .filter(
            cast(Payment.created_at, Date) >= start,
            cast(Payment.created_at, Date) <= end,
        )
        .group_by(User.id)
    )
    trans_data = trans_query.all()
    # top by count and value
    sorted_by_count = sorted(trans_data, key=lambda x: x.count, reverse=True)[:limit]
    by_count = [
        {"user_id": u.id, "name": f"{u.first_name} {u.last_name}".strip(), "count": c}
        for u, c, v in sorted_by_count
    ]
    sorted_by_value = sorted(trans_data, key=lambda x: x.value or 0, reverse=True)[:limit]
    by_value = [
        {"user_id": u.id, "name": f"{u.first_name} {u.last_name}".strip(),
         # divide cents by 100 to get rands, rounded to 2dp
         "value": round((v or 0) / 100, 2)}
        for u, c, v in sorted_by_value
    ]
    # top by points earned
    # points earned per user
    pts_data = (
        db.query(User, func.sum(PointBalance.points).label('points'))
            .join(PointBalance, PointBalance.user_id == User.id)
            .filter(
                cast(PointBalance.updated_at, Date) >= start,
                cast(PointBalance.updated_at, Date) <= end,
            )
            .group_by(User.id)
            .order_by(func.sum(PointBalance.points).desc())
            .limit(limit)
            .all()
    )
    by_points = [{"user_id": u.id, "name": f"{u.first_name} {u.last_name}".strip(), "points": p} for u, p in pts_data]
    # top by visits
    # visits per user
    visit_data = (
        db.query(User, func.sum(VisitCount.count).label('visits'))
            .join(VisitCount, VisitCount.user_id == User.id)
            .filter(
                cast(VisitCount.updated_at, Date) >= start,
                cast(VisitCount.updated_at, Date) <= end,
            )
            .group_by(User.id)
            .order_by(func.sum(VisitCount.count).desc())
            .limit(limit)
            .all()
    )
    by_visits = [{"user_id": u.id, "name": f"{u.first_name} {u.last_name}".strip(), "visits": v} for u, v in visit_data]
    return {
        "by_transaction_count": by_count,
        "by_transaction_value": by_value,
        "by_points_earned": by_points,
        "by_visits": by_visits,
    }

@router.get(
    "/engagement/details",
    summary="Get engagement metrics like banner clicks and feature usage"
)
def get_engagement_details(
    db: Session = Depends(get_db)
):
    # engagement events not tracked—return zeros
    return {
        "banner_click_rate": 0.0,
        "feature_usage": {}
    }

@router.get(
    "/financial/details",
    summary="Get financial KPIs like revenue, ARPU, and LTV"
)
def get_financial_details(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    # date range defaults to last 7 days
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date
    # revenue in period
    revenue = db.query(func.sum(Payment.amount)).filter(
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    ).scalar() or 0
    # distinct users who made transactions in period
    users_period = db.query(func.count(func.distinct(Order.user_id)))\
        .select_from(Payment)\
        .join(Order, Payment.order_id == Order.id)\
        .filter(
            cast(Payment.created_at, Date) >= start,
            cast(Payment.created_at, Date) <= end
        )\
        .scalar() or 1
    arpu = revenue / users_period
    # lifetime value (average total spend per user)
    total_revenue_all = db.query(func.sum(Payment.amount)).scalar() or 0
    user_total = db.query(User).count() or 1
    ltv = total_revenue_all / user_total
    return {
        "revenue": round(revenue, 2),
        "arpu": round(arpu, 2),
        "ltv": round(ltv, 2)
    }
 
@router.get(
    "/insights",
    response_model=List[str],
    summary="AI-generated insights comparing current vs prior period"
)
def get_insights(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    tier: Optional[str] = Query(None, description="User role filter"),
    campaign: Optional[str] = Query(None, description="Payment source filter"),
    device: Optional[str] = Query(None, description="Device type filter"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Determine date range
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        start, end = start_date, end_date

    # Fetch current summary
    current = get_summary(start, end, tier, campaign, device, current_user, db)

    # Previous period
    delta = end - start
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - delta
    previous = get_summary(prev_start, prev_end, tier, campaign, device, current_user, db)

    # Build prompt
    prompt = f"""
Compare metrics for {start}–{end} vs {prev_start}–{prev_end}.
Provide 3–5 concise, actionable insights.

Current: {current}
Previous: {previous}

Insights:
"""
    try:
        import os
        import openai
        openai.api_key = os.getenv("OPENAI_API_KEY")
        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an analytics assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300,
        )
        text = resp.choices[0].message.content.strip()
        bullets = [line.lstrip("- ").strip() for line in text.splitlines() if line.strip()]
        return bullets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")
