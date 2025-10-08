"""
Business analytics and reporting API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import (User, Order, Payment, Redemption, Tenant, Service,
                        Reward, PointBalance)
from sqlalchemy import func, desc, and_, text
from datetime import date, datetime, timedelta
import calendar
from config import settings

router = APIRouter()

ALLOWED_ROLES = {"admin", "staff", "superadmin", "developer"}


def _ensure_reporting_access(user: User) -> None:
    if user.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Not authorized")


def _resolve_tenant_scope(user: User, tenant_override: str | None = None) -> str:
    """Resolve the tenant id to use for reporting queries."""

    tenant_id = user.tenant_id

    if tenant_override:
        if user.role not in {"superadmin", "developer"}:
            raise HTTPException(status_code=403, detail="Tenant override not permitted")
        tenant_id = tenant_override

    if not tenant_id:
        tenant_id = settings.default_tenant

    if not tenant_id:
        raise HTTPException(status_code=404, detail="Tenant not available")

    return tenant_id


def get_date_range(period: str):
    """Return start and end dates based on period"""
    today = datetime.now().date()
    end_date = datetime.combine(today, datetime.max.time())
    
    if period == "7d":
        start_date = datetime.combine(today - timedelta(days=6), datetime.min.time())
    elif period == "30d":
        start_date = datetime.combine(today - timedelta(days=29), datetime.min.time())
    elif period == "90d":
        start_date = datetime.combine(today - timedelta(days=89), datetime.min.time())
    elif period == "ytd":
        start_date = datetime.combine(datetime(today.year, 1, 1).date(), datetime.min.time())
    elif period == "all":
        start_date = datetime(2000, 1, 1)  # Effectively all time
    else:  # Default to 30 days
        start_date = datetime.combine(today - timedelta(days=29), datetime.min.time())
        
    return start_date, end_date


def resolve_date_range(days: int | None = None, period: str | None = None):
    """Resolve an absolute date range from either a days window or legacy period string."""
    if days is not None:
        clamped_days = max(1, min(days, 365))
        today = datetime.utcnow().date()
        end_date = datetime.combine(today, datetime.max.time())
        start_date = datetime.combine(today - timedelta(days=clamped_days - 1), datetime.min.time())
        return start_date, end_date

    return get_date_range(period or "30d")

@router.get("/summary")
@router.get("/business-summary")
async def get_business_summary(
    days: int = Query(30, ge=1, le=365),
    tenant_id: str | None = Query(None, description="Tenant scope override (superadmin/developer only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return consolidated business metrics for admin dashboards."""

    _ensure_reporting_access(current_user)

    tenant_scope = _resolve_tenant_scope(current_user, tenant_id)
    start_date, end_date = resolve_date_range(days=days)

    revenue_results = (
        db.query(
            func.coalesce(func.sum(Order.amount), 0).label("total_revenue"),
            func.count(Order.id).label("order_count"),
            func.count(func.distinct(Order.user_id)).label("active_customers"),
        )
        .filter(
            Order.tenant_id == tenant_scope,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date),
        )
        .first()
    )

    total_customers = (
        db.query(func.count(User.id))
        .filter(User.tenant_id == tenant_scope, User.role == "user")
        .scalar()
        or 0
    )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_scope).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if tenant.loyalty_type == "points":
        points_issued = (
            db.query(func.coalesce(func.sum(Order.amount / 100), 0))
            .filter(
                Order.tenant_id == tenant_scope,
                Order.status == "completed",
                Order.created_at.between(start_date, end_date),
            )
            .scalar()
            or 0
        )
    else:
        points_issued = revenue_results.order_count or 0

    loyalty_results = (
        db.query(
            func.count(Redemption.id).label("redemption_count"),
            func.coalesce(func.sum(func.coalesce(Redemption.milestone, 0)), 0).label(
                "points_redeemed"
            ),
        )
        .filter(
            Redemption.tenant_id == tenant_scope,
            Redemption.status == "redeemed",
            Redemption.redeemed_at.between(start_date, end_date),
        )
        .first()
    )

    top_service = (
        db.query(
            Service.name.label("name"),
            func.count(Order.id).label("order_count"),
        )
        .join(Order, Order.service_id == Service.id)
        .filter(
            Order.tenant_id == tenant_scope,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date),
        )
        .group_by(Service.id, Service.name)
        .order_by(desc("order_count"))
        .first()
    )

    total_revenue_cents = int(revenue_results.total_revenue or 0)
    total_orders = int(revenue_results.order_count or 0)
    active_customers = int(revenue_results.active_customers or 0)
    total_revenue = total_revenue_cents / 100.0
    avg_order_value = (total_revenue / total_orders) if total_orders else 0

    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "total_customers": total_customers,
        "active_customers": active_customers,
        "avg_order_value": round(avg_order_value, 2),
        "loyalty_points_issued": int(points_issued),
        "loyalty_points_redeemed": int(loyalty_results.points_redeemed or 0),
        "top_service": {
            "name": top_service.name,
            "count": int(top_service.order_count),
        }
        if top_service
        else None,
    }

@router.get("/revenue-chart")
async def get_revenue_chart(
    days: int = Query(30, ge=1, le=365),
    group_by: str = Query("day", regex="^(day|week|month)$"),
    tenant_id: str | None = Query(None, description="Tenant scope override (superadmin/developer only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get revenue data for charts grouped by time period."""

    _ensure_reporting_access(current_user)

    tenant_scope = _resolve_tenant_scope(current_user, tenant_id)
    start_date, end_date = resolve_date_range(days=days)

    # SQL date format and grouping based on group_by parameter
    if group_by == "day":
        date_format = "DATE(created_at)"
    elif group_by == "week":
        date_format = "strftime('%Y-%W', created_at)"  # SQLite format
    elif group_by == "month":
        date_format = "strftime('%Y-%m', created_at)"  # SQLite format
    
    # Get revenue by time period
    query = f"""
    SELECT 
        {date_format} as date_group,
        SUM(amount) as revenue,
        COUNT(*) as order_count
    FROM orders
    WHERE 
    tenant_id = :tenant_id
        AND status = 'completed'
        AND created_at BETWEEN :start_date AND :end_date
    GROUP BY date_group
    ORDER BY date_group
    """
    
    results = db.execute(
        text(query),
        {
            "tenant_id": tenant_scope,
            "start_date": start_date,
            "end_date": end_date,
        },
    ).fetchall()

    # Format results
    chart_data = []
    for row in results:
        bucket = row[0]
        if isinstance(bucket, (datetime, date)):
            date_str = bucket.isoformat()
        else:
            date_str = str(bucket)

        chart_data.append(
            {
                "date": date_str,
                "revenue": (row[1] or 0) / 100.0,
                "orders": int(row[2] or 0),
            }
        )

    return chart_data

@router.get("/top-services")
async def get_top_services(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    tenant_id: str | None = Query(None, description="Tenant scope override (superadmin/developer only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top performing services within the requested window."""

    _ensure_reporting_access(current_user)

    tenant_scope = _resolve_tenant_scope(current_user, tenant_id)
    start_date, end_date = resolve_date_range(days=days)

    top_services = (
        db.query(
            Service.id,
            Service.name,
            func.sum(Order.amount).label("revenue"),
            func.count(Order.id).label("order_count"),
        )
        .join(Order, Service.id == Order.service_id)
        .filter(
            Order.tenant_id == tenant_scope,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date),
        )
        .group_by(Service.id, Service.name)
        .order_by(desc("revenue"))
        .limit(limit)
        .all()
    )

    return [
        {
            "service_name": service.name or "Unknown Service",
            "order_count": int(service.order_count or 0),
            "total_revenue": (service.revenue or 0) / 100.0,
            "avg_rating": None,
        }
        for service in top_services
    ]

@router.get("/loyalty-stats")
async def get_loyalty_stats(
    days: int = Query(30, ge=1, le=365),
    tenant_id: str | None = Query(None, description="Tenant scope override (superadmin/developer only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return loyalty program KPIs for the dashboard."""

    _ensure_reporting_access(current_user)

    tenant_scope = _resolve_tenant_scope(current_user, tenant_id)
    start_date, end_date = resolve_date_range(days=days)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_scope).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    total_members = (
        db.query(func.count(User.id))
        .filter(User.tenant_id == tenant_scope, User.role == "user")
        .scalar()
        or 0
    )

    active_members = (
        db.query(func.count(func.distinct(Order.user_id)))
        .filter(
            Order.tenant_id == tenant_scope,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date),
        )
        .scalar()
        or 0
    )

    if tenant.loyalty_type == "points":
        points_issued = (
            db.query(func.coalesce(func.sum(Order.amount / 100), 0))
            .filter(
                Order.tenant_id == tenant_scope,
                Order.status == "completed",
                Order.created_at.between(start_date, end_date),
            )
            .scalar()
            or 0
        )
    else:
        points_issued = (
            db.query(func.count(Order.id))
            .filter(
                Order.tenant_id == tenant_scope,
                Order.status == "completed",
                Order.created_at.between(start_date, end_date),
            )
            .scalar()
            or 0
        )

    redemptions = (
        db.query(
            func.count(Redemption.id).label("count"),
            func.coalesce(func.sum(func.coalesce(Redemption.milestone, 0)), 0).label(
                "points"
            ),
        )
        .filter(
            Redemption.tenant_id == tenant_scope,
            Redemption.status == "redeemed",
            Redemption.redeemed_at.between(start_date, end_date),
        )
        .first()
    )

    redemption_count = int(redemptions.count or 0)
    points_redeemed = int(redemptions.points or 0)

    average_points_per_customer = (
        points_issued / total_members if total_members else 0
    )
    redemption_rate = (
        redemption_count / active_members if active_members else 0
    )

    return {
        "total_members": total_members,
        "active_members": active_members,
        "points_issued_this_month": int(points_issued),
        "points_redeemed_this_month": points_redeemed,
        "average_points_per_customer": round(average_points_per_customer, 2),
        "redemption_rate": round(redemption_rate, 4),
    }

@router.get("/customer-segmentation")
@router.get("/customer-segments")
async def get_customer_segments(
    days: int = Query(180, ge=1, le=365),
    tenant_id: str | None = Query(None, description="Tenant scope override (superadmin/developer only)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return customer segmentation buckets for the dashboard."""

    _ensure_reporting_access(current_user)

    tenant_scope = _resolve_tenant_scope(current_user, tenant_id)
    start_date, end_date = resolve_date_range(days=days)

    segments = db.execute(
        text(
            """
        WITH customer_stats AS (
            SELECT 
                u.id,
                COUNT(CASE WHEN o.status = 'completed' AND o.created_at BETWEEN :start_date AND :end_date THEN 1 END) AS total_orders,
                COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.created_at BETWEEN :start_date AND :end_date THEN o.amount ELSE 0 END), 0) AS total_spent
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.tenant_id = :tenant_id AND u.role = 'user'
            GROUP BY u.id
        )
        SELECT 
            CASE 
                WHEN total_orders >= 10 AND total_spent >= 50000 THEN 'VIP'
                WHEN total_orders >= 5 AND total_spent >= 20000 THEN 'Regular'
                WHEN total_orders >= 2 THEN 'Occasional'
                ELSE 'New'
            END AS segment,
            COUNT(*) AS customer_count,
            SUM(total_spent) AS segment_spent,
            SUM(total_orders) AS segment_orders,
            CASE 
                WHEN total_orders >= 10 AND total_spent >= 50000 THEN 1
                WHEN total_orders >= 5 AND total_spent >= 20000 THEN 2
                WHEN total_orders >= 2 THEN 3
                ELSE 4
            END AS segment_priority
        FROM customer_stats
        GROUP BY segment, segment_priority
        ORDER BY segment_priority
        """
        ),
        {
            "tenant_id": tenant_scope,
            "start_date": start_date,
            "end_date": end_date,
        },
    ).fetchall()

    total_customers = sum(row[1] for row in segments)

    response: List[Dict[str, Any]] = []
    for segment, customer_count, segment_spent, segment_orders, _priority in segments:
        total_revenue = (segment_spent or 0) / 100.0
        avg_order_value = (
            (segment_spent or 0) / segment_orders / 100.0 if segment_orders else 0
        )
        percentage = (
            round((customer_count / total_customers) * 100, 1)
            if total_customers
            else 0
        )

        response.append(
            {
                "segment": segment,
                "count": int(customer_count),
                "percentage": percentage,
                "avg_order_value": round(avg_order_value, 2),
                "total_revenue": round(total_revenue, 2),
            }
        )

    return response
