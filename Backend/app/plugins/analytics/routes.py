from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from app.core.database import get_db
from app.models import User, Payment, PointBalance, Redemption, Reward, VisitCount, Order
from datetime import datetime, timedelta, date
from app.plugins.auth.routes import require_admin, require_staff

from .schemas import (
    AnalyticsSummaryResponse,
    UserDetails,
    TransactionDetails,
    TopCustomersResponse,
    LoyaltyAnalyticsResponse,
    TopCustomerItem,
    LoyaltyOverview,
    ChurnCandidate
)
from app.models import AggregatedCustomerMetrics
from app.analytics.refresh_customers import refresh_customer_metrics
"""Analytics router.

All read-only analytics endpoints should be accessible to staff (and admins).
The snapshot refresh endpoint remains admin-only.
"""
router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_staff)])

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


@router.get("/customers/top", response_model=TopCustomersResponse, summary="Top customers by revenue/visits within range")
def get_top_customers(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort: str = Query("revenue", pattern="^(revenue|washes|loyalty_share)$"),
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=30)
    else:
        start, end = start_date, end_date
    # Base subquery: washes + revenue + loyalty counts per user
    from sqlalchemy import case
    base_q = db.query(
        Order.user_id.label('user_id'),
        func.count(Order.id).label('total_washes'),
        func.sum(Order.amount).label('revenue_cents'),
        func.sum(case((Order.type == 'loyalty', 1), else_=0)).label('loyalty_wash_count'),
        func.max(Order.started_at).label('last_visit')
    ).filter(
        cast(Order.started_at, Date) >= start,
        cast(Order.started_at, Date) <= end,
        Order.status.in_(['started','ended'])
    ).group_by(Order.user_id).subquery()
    # Points redeemed & outstanding (simple aggregates)
    points_q = db.query(
        Redemption.user_id.label('user_id'),
        func.sum(Reward.cost).label('points_redeemed')
    ).join(Reward, Reward.id == Redemption.reward_id).filter(
        Redemption.status == 'redeemed'
    ).group_by(Redemption.user_id).subquery()
    outstanding_q = db.query(
        PointBalance.user_id.label('user_id'),
        func.sum(PointBalance.points).label('points_outstanding')
    ).group_by(PointBalance.user_id).subquery()
    joined = db.query(
        User.id.label('user_id'),
        (User.first_name + ' ' + User.last_name).label('name'),
        base_q.c.total_washes,
        base_q.c.revenue_cents,
        base_q.c.loyalty_wash_count,
        base_q.c.last_visit,
        func.coalesce(points_q.c.points_redeemed, 0).label('points_redeemed'),
        func.coalesce(outstanding_q.c.points_outstanding, 0).label('points_outstanding'),
        (func.coalesce(base_q.c.loyalty_wash_count,0) * 1.0 / func.nullif(base_q.c.total_washes,0)).label('loyalty_share')
    ).join(base_q, base_q.c.user_id == User.id)
    joined = joined.outerjoin(points_q, points_q.c.user_id == User.id)
    joined = joined.outerjoin(outstanding_q, outstanding_q.c.user_id == User.id)
    if sort == 'revenue':
        joined = joined.order_by(base_q.c.revenue_cents.desc())
    elif sort == 'washes':
        joined = joined.order_by(base_q.c.total_washes.desc())
    else:
        joined = joined.order_by(func.coalesce(base_q.c.loyalty_wash_count,0).desc())
    total = joined.count()
    rows = joined.offset(offset).limit(limit).all()
    items: List[TopCustomerItem] = []
    for r in rows:
        avg_spend = int((r.revenue_cents or 0) / r.total_washes) if r.total_washes else 0
        items.append(TopCustomerItem(
            user_id=r.user_id,
            name=r.name or 'Unknown',
            total_washes=r.total_washes or 0,
            completed_washes=r.total_washes or 0,  # refine if needed
            revenue_cents=r.revenue_cents or 0,
            avg_spend_cents=avg_spend,
            last_visit=r.last_visit.isoformat() if r.last_visit else None,
            loyalty_wash_count=r.loyalty_wash_count or 0,
            loyalty_share=float(r.loyalty_share or 0.0),
            points_redeemed=r.points_redeemed or 0,
            points_outstanding=r.points_outstanding or 0
        ))
    return {"items": items, "total": total}


@router.get("/loyalty/overview", response_model=LoyaltyAnalyticsResponse, summary="Loyalty penetration & churn candidates")
def get_loyalty_overview(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=30)
    else:
        start, end = start_date, end_date
    # Basic aggregates
    total_washes = db.query(func.count(Order.id)).filter(
        cast(Order.started_at, Date) >= start,
        cast(Order.started_at, Date) <= end,
        Order.status.in_(['started','ended'])
    ).scalar() or 0
    loyalty_washes = db.query(func.count(Order.id)).filter(
        cast(Order.started_at, Date) >= start,
        cast(Order.started_at, Date) <= end,
        Order.type == 'loyalty'
    ).scalar() or 0
    loyalty_penetration = (loyalty_washes / total_washes) if total_washes else 0.0
    points_redeemed_total = db.query(func.sum(Reward.cost)).join(Redemption, Redemption.reward_id == Reward.id).filter(
        Redemption.status=='redeemed'
    ).scalar() or 0
    outstanding_points = db.query(func.sum(PointBalance.points)).scalar() or 0
    # Points earned approximation: outstanding + redeemed (ignoring expired/breakage for now)
    total_points_earned = points_redeemed_total + outstanding_points
    avg_points_redeemed_per_wash = (points_redeemed_total / loyalty_washes) if loyalty_washes else 0.0
    overview = LoyaltyOverview(
        loyalty_penetration=round(loyalty_penetration,4),
        avg_points_redeemed_per_wash=round(avg_points_redeemed_per_wash,2),
        total_points_redeemed=points_redeemed_total,
        total_points_earned=total_points_earned,
        outstanding_points=outstanding_points
    )
    # Reuse top customers subset (by loyalty usage)
    top_customers_resp = get_top_customers(start_date, end_date, limit=10, offset=0, sort='loyalty_share', db=db)
    # Churn candidates: users whose last_visit > 30 days and had >=2 washes in prior window
    inactive_threshold = today - timedelta(days=30)
    candidates_q = db.query(
        AggregatedCustomerMetrics.user_id,
        AggregatedCustomerMetrics.last_visit_at,
        AggregatedCustomerMetrics.washes_90d,
        AggregatedCustomerMetrics.lifetime_washes,
        AggregatedCustomerMetrics.lifetime_revenue
    ).filter(
        AggregatedCustomerMetrics.last_visit_at < inactive_threshold,
        AggregatedCustomerMetrics.washes_90d >= 2
    )
    rows = candidates_q.all()
    # Compute percentile by lifetime_revenue (simple rank)
    sorted_by_rev = sorted(rows, key=lambda r: r.lifetime_revenue or 0, reverse=True)
    rev_index = {r.user_id: i for i, r in enumerate(sorted_by_rev)}
    total_rows = len(rows) or 1
    churn_candidates: List[ChurnCandidate] = []
    for r in rows:
        days_since_last = (today - r.last_visit_at.date()).days if r.last_visit_at else 999
        percentile = 1 - (rev_index[r.user_id] / total_rows)  # higher revenue -> higher percentile
        churn_candidates.append(ChurnCandidate(
            user_id=r.user_id,
            name='User '+str(r.user_id),  # refine with real name join if needed
            days_since_last=days_since_last,
            percentile=round(percentile,4),
            churn_risk_flag=days_since_last > 45
        ))
    return {
        "overview": overview,
        "top_customers": top_customers_resp["items"],
        "churn_candidates": churn_candidates
    }

@router.post("/customers/refresh", summary="Trigger refresh of aggregated customer metrics", dependencies=[Depends(require_admin)])
def refresh_customers(db: Session = Depends(get_db)):
    count = refresh_customer_metrics(db)
    return {"refreshed": count}

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
        # AI integration removed for now to avoid external dependency; placeholder heuristic insights
        dummy = [
            "User growth stable vs prior period.",
            "Transaction volume change minimal; monitor campaign impact.",
            "Loyalty redemption steady; consider promo to boost penetration."
        ]
        return dummy
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")
