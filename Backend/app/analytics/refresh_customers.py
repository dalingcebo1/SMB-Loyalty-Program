# Utility to refresh AggregatedCustomerMetrics snapshot
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, case
from app.models import Order, User, Redemption, Reward, PointBalance, AggregatedCustomerMetrics

# RFM scoring helper

def _score(value, boundaries):
    # boundaries ascending: return 5..1 depending on quantile position
    for i, b in enumerate(boundaries):
        if value <= b:
            return 5 - i
    return 1

def refresh_customer_metrics(db: Session, days_30: int = 30, days_90: int = 90):
    now = datetime.utcnow()
    start_30 = now - timedelta(days=days_30)
    start_90 = now - timedelta(days=days_90)

    # Base aggregates per user
    base = db.query(
        Order.user_id.label('user_id'),
        func.count(Order.id).label('lifetime_washes'),
        func.sum(Order.amount).label('lifetime_revenue'),
        func.min(Order.started_at).label('first_visit_at'),
        func.max(Order.started_at).label('last_visit_at'),
        func.sum(case((Order.type == 'loyalty', 1), else_=0)).label('loyalty_washes_total')
    ).filter(Order.status.in_(['started','ended']), Order.user_id.isnot(None)).group_by(Order.user_id).all()

    # 30 / 90 day windows
    window_30 = db.query(
        Order.user_id,
        func.count(Order.id).label('washes_30d'),
        func.sum(Order.amount).label('revenue_30d'),
        func.sum(case((Order.type == 'loyalty', 1), else_=0)).label('loyalty_washes_30d')
    ).filter(Order.started_at >= start_30, Order.status.in_(['started','ended']), Order.user_id.isnot(None))\
     .group_by(Order.user_id).all()
    window_90 = db.query(
        Order.user_id,
        func.count(Order.id).label('washes_90d'),
        func.sum(Order.amount).label('revenue_90d')
    ).filter(Order.started_at >= start_90, Order.status.in_(['started','ended']), Order.user_id.isnot(None))\
     .group_by(Order.user_id).all()

    w30_map = {r.user_id: r for r in window_30}
    w90_map = {r.user_id: r for r in window_90}

    # Points
    redeemed_totals = db.query(Redemption.user_id, func.sum(Reward.cost).label('points_redeemed_total'))\
        .join(Reward, Reward.id == Redemption.reward_id)\
        .filter(Redemption.status=='redeemed')\
        .group_by(Redemption.user_id).all()
    redeemed_map = {r.user_id: r.points_redeemed_total or 0 for r in redeemed_totals}
    outstanding_totals = db.query(PointBalance.user_id, func.sum(PointBalance.points).label('points_outstanding'))\
        .group_by(PointBalance.user_id).all()
    outstanding_map = {r.user_id: r.points_outstanding or 0 for r in outstanding_totals}

    # RFM boundaries (simple quantiles using collected lists)
    revenues = sorted([r.lifetime_revenue or 0 for r in base])
    freqs = sorted([w90_map.get(r.user_id).washes_90d if w90_map.get(r.user_id) else 0 for r in base])
    recencies = sorted([ (now - r.last_visit_at).days if r.last_visit_at else 9999 for r in base])
    def quantiles(lst):
        if not lst:
            return [0,0,0,0]
        n = len(lst)
        return [lst[int(n*q)] for q in (0.2,0.4,0.6,0.8)]
    rev_bounds = quantiles(revenues)
    freq_bounds = quantiles(freqs)
    # For recency, lower is better: invert logic (we pass negative to scorer or reverse boundaries)
    rec_bounds = quantiles(recencies)

    inserted = 0
    for r in base:
        w30 = w30_map.get(r.user_id)
        w90 = w90_map.get(r.user_id)
        rec_days = (now - r.last_visit_at).days if r.last_visit_at else 9999
        revenue = r.lifetime_revenue or 0
        freq90 = w90.washes_90d if w90 else 0

        r_score = _score(rec_days, rec_bounds)  # lower recency -> higher score
        f_score = _score(freq90, freq_bounds)
        m_score = _score(revenue, rev_bounds)

        segment = None
        if r_score >=4 and f_score >=4 and m_score >=4:
            segment = 'power_user'
        elif r_score <=2 and f_score >=4 and m_score >=4:
            segment = 'at_risk_high_value'
        elif f_score >=4 and m_score <=2:
            segment = 'frequent_low_spend'
        elif m_score >=4 and f_score <=2:
            segment = 'high_spend_infrequent'

        obj = db.get(AggregatedCustomerMetrics, r.user_id)
        if not obj:
            obj = AggregatedCustomerMetrics(user_id=r.user_id)
            db.add(obj)
        obj.last_visit_at = r.last_visit_at
        obj.first_visit_at = r.first_visit_at
        obj.lifetime_washes = r.lifetime_washes or 0
        obj.lifetime_revenue = revenue
        obj.washes_30d = w30.washes_30d if w30 else 0
        obj.washes_90d = w90.washes_90d if w90 else 0
        obj.revenue_30d = w30.revenue_30d if w30 else 0
        obj.revenue_90d = w90.revenue_90d if w90 else 0
        obj.loyalty_washes_total = r.loyalty_washes_total or 0
        obj.loyalty_washes_30d = w30.loyalty_washes_30d if w30 else 0
        obj.points_redeemed_total = redeemed_map.get(r.user_id,0)
        obj.points_outstanding = outstanding_map.get(r.user_id,0)
        obj.points_redeemed_30d = 0  # could compute with a window if needed
        obj.r_score = r_score
        obj.f_score = f_score
        obj.m_score = m_score
        obj.segment = segment
        obj.snapshot_at = now
        inserted +=1
    db.commit()
    return inserted
