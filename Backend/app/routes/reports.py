"""
Business analytics and reporting API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import User, Order, Payment, Redemption, Tenant, Service, Reward
from sqlalchemy import func, desc, and_, text
from datetime import datetime, timedelta
import calendar

router = APIRouter()

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

@router.get("/business-summary")
async def get_business_summary(
    period: str = Query("30d", regex="^(7d|30d|90d|ytd|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get business summary metrics for the dashboard"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tenant_id = current_user.tenant_id
    start_date, end_date = get_date_range(period)
    
    # Previous period for comparison
    duration = (end_date - start_date).days
    prev_end_date = start_date
    prev_start_date = prev_end_date - timedelta(days=duration)
    
    # Calculate revenue metrics
    revenue_results = db.query(
        func.sum(Order.amount).label("total_revenue"),
        func.count(Order.id).label("order_count"),
        func.count(func.distinct(Order.user_id)).label("unique_customers")
    ).filter(
        Order.tenant_id == tenant_id,
        Order.status == "completed",
        Order.created_at.between(start_date, end_date)
    ).first()
    
    prev_revenue_results = db.query(
        func.sum(Order.amount).label("total_revenue"),
        func.count(Order.id).label("order_count")
    ).filter(
        Order.tenant_id == tenant_id,
        Order.status == "completed",
        Order.created_at.between(prev_start_date, prev_end_date)
    ).first()
    
    # Loyalty metrics
    loyalty_results = db.query(
        func.count(Redemption.id).label("redemption_count"),
        func.sum(func.coalesce(Redemption.milestone, 0)).label("points_redeemed")
    ).filter(
        Redemption.tenant_id == tenant_id,
        Redemption.status == "redeemed",
        Redemption.redeemed_at.between(start_date, end_date)
    ).first()
    
    prev_loyalty_results = db.query(
        func.count(Redemption.id).label("redemption_count")
    ).filter(
        Redemption.tenant_id == tenant_id,
        Redemption.status == "redeemed",
        Redemption.redeemed_at.between(prev_start_date, prev_end_date)
    ).first()
    
    # New customers
    new_customers = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant_id,
        User.role == "user",
        User.created_at.between(start_date, end_date)
    ).scalar()
    
    prev_new_customers = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant_id,
        User.role == "user",
        User.created_at.between(prev_start_date, prev_end_date)
    ).scalar()
    
    # Calculate percent changes
    def calc_percent_change(current, previous):
        if not previous:
            return 100 if current else 0
        return round(((current - previous) / previous) * 100, 1)
    
    # Build response
    current_revenue = revenue_results.total_revenue or 0
    prev_revenue = prev_revenue_results.total_revenue or 0
    current_orders = revenue_results.order_count or 0
    prev_orders = prev_revenue_results.order_count or 0
    current_redemptions = loyalty_results.redemption_count or 0
    prev_redemptions = prev_loyalty_results.redemption_count or 0
    
    return {
        "revenue": {
            "current": current_revenue,
            "prev_period": prev_revenue,
            "percent_change": calc_percent_change(current_revenue, prev_revenue)
        },
        "orders": {
            "current": current_orders,
            "prev_period": prev_orders,
            "percent_change": calc_percent_change(current_orders, prev_orders)
        },
        "customers": {
            "unique_count": revenue_results.unique_customers or 0,
            "new_customers": new_customers or 0,
            "new_customer_change": calc_percent_change(new_customers, prev_new_customers)
        },
        "loyalty": {
            "redemptions": current_redemptions,
            "redemption_change": calc_percent_change(current_redemptions, prev_redemptions),
            "points_redeemed": loyalty_results.points_redeemed or 0
        },
        "period": {
            "start_date": start_date,
            "end_date": end_date,
            "days": duration
        }
    }

@router.get("/revenue-chart")
async def get_revenue_chart(
    period: str = Query("30d", regex="^(7d|30d|90d|ytd|all)$"),
    group_by: str = Query("day", regex="^(day|week|month)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get revenue data for charts grouped by time period"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tenant_id = current_user.tenant_id
    start_date, end_date = get_date_range(period)
    
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
    
    results = db.execute(text(query), {
        "tenant_id": tenant_id,
        "start_date": start_date,
        "end_date": end_date
    }).fetchall()
    
    # Format results
    chart_data = []
    for row in results:
        chart_data.append({
            "date": row[0],
            "revenue": row[1] or 0,
            "orders": row[2] or 0
        })
    
    return {
        "chart_data": chart_data,
        "period": {
            "start_date": start_date,
            "end_date": end_date,
            "group_by": group_by
        }
    }

@router.get("/top-services")
async def get_top_services(
    period: str = Query("30d", regex="^(7d|30d|90d|ytd|all)$"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get top services by revenue or order count"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tenant_id = current_user.tenant_id
    start_date, end_date = get_date_range(period)
    
    # Query for top services
    top_services = db.query(
        Service.id,
        Service.name,
        Service.category,
        func.sum(Order.amount).label("revenue"),
        func.count(Order.id).label("order_count")
    ).join(
        Order, Service.id == Order.service_id
    ).filter(
        Order.tenant_id == tenant_id,
        Order.status == "completed",
        Order.created_at.between(start_date, end_date)
    ).group_by(
        Service.id
    ).order_by(
        desc("revenue")
    ).limit(limit).all()
    
    # Format results
    result = []
    for service in top_services:
        result.append({
            "id": service.id,
            "name": service.name,
            "category": service.category,
            "revenue": service.revenue or 0,
            "order_count": service.order_count or 0
        })
    
    return {
        "top_services": result,
        "period": {
            "start_date": start_date,
            "end_date": end_date
        }
    }

@router.get("/loyalty-stats")
async def get_loyalty_stats(
    period: str = Query("30d", regex="^(7d|30d|90d|ytd|all)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get loyalty program statistics"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tenant_id = current_user.tenant_id
    start_date, end_date = get_date_range(period)
    
    # Get tenant to determine loyalty type
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    loyalty_type = tenant.loyalty_type
    
    # Points issued in the period (simplified - based on orders)
    if loyalty_type == "points":
        # Assuming 1 point per dollar spent
        points_issued = db.query(func.sum(Order.amount / 100)).filter(
            Order.tenant_id == tenant_id,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date)
        ).scalar() or 0
    else:
        # For visit-based, each completed order is a visit
        points_issued = db.query(func.count(Order.id)).filter(
            Order.tenant_id == tenant_id,
            Order.status == "completed",
            Order.created_at.between(start_date, end_date)
        ).scalar() or 0
    
    # Points redeemed
    redemptions = db.query(
        func.count(Redemption.id).label("count"),
        func.sum(func.coalesce(Redemption.milestone, 0)).label("points")
    ).filter(
        Redemption.tenant_id == tenant_id,
        Redemption.status == "redeemed",
        Redemption.redeemed_at.between(start_date, end_date)
    ).first()
    
    # Top redeemed rewards
    top_rewards = db.query(
        Reward.id,
        Reward.title,
        func.count(Redemption.id).label("redemption_count")
    ).join(
        Redemption, Reward.id == Redemption.reward_id
    ).filter(
        Redemption.tenant_id == tenant_id,
        Redemption.status == "redeemed",
        Redemption.redeemed_at.between(start_date, end_date)
    ).group_by(
        Reward.id
    ).order_by(
        desc("redemption_count")
    ).limit(5).all()
    
    # Format top rewards
    top_rewards_list = []
    for reward in top_rewards:
        top_rewards_list.append({
            "id": reward.id,
            "title": reward.title,
            "redemption_count": reward.redemption_count
        })
    
    return {
        "loyalty_type": loyalty_type,
        "points_issued": int(points_issued),
        "points_redeemed": int(redemptions.points or 0),
        "redemption_count": redemptions.count or 0,
        "top_redeemed_rewards": top_rewards_list,
        "period": {
            "start_date": start_date,
            "end_date": end_date
        }
    }

@router.get("/customer-segments")
async def get_customer_segments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get customer segmentation analysis"""
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    tenant_id = current_user.tenant_id
    
    # Simple customer segmentation based on visit frequency and spend
    segments = db.execute(text("""
    SELECT 
        CASE 
            WHEN total_orders >= 10 AND total_spent >= 50000 THEN 'VIP'
            WHEN total_orders >= 5 AND total_spent >= 20000 THEN 'Regular'
            WHEN total_orders >= 2 THEN 'Occasional'
            ELSE 'New'
        END as segment,
        COUNT(*) as customer_count,
        AVG(total_spent) as avg_spent,
        AVG(total_orders) as avg_orders
    FROM (
        SELECT 
            u.id,
            COUNT(o.id) as total_orders,
            COALESCE(SUM(o.amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'completed'
        WHERE u.tenant_id = :tenant_id AND u.role = 'user'
        GROUP BY u.id
    ) customer_stats
    GROUP BY segment
    ORDER BY 
        CASE segment 
            WHEN 'VIP' THEN 1 
            WHEN 'Regular' THEN 2 
            WHEN 'Occasional' THEN 3 
            WHEN 'New' THEN 4 
        END
    """), {"tenant_id": tenant_id}).fetchall()
    
    # Format results
    segment_data = []
    total_customers = 0
    
    for segment in segments:
        segment_data.append({
            "segment": segment[0],
            "customer_count": segment[1],
            "avg_spent": float(segment[2] or 0),
            "avg_orders": float(segment[3] or 0)
        })
        total_customers += segment[1]
    
    # Add percentages
    for segment in segment_data:
        segment["percentage"] = round((segment["customer_count"] / total_customers) * 100, 1) if total_customers > 0 else 0
    
    return {
        "segments": segment_data,
        "total_customers": total_customers
    }
