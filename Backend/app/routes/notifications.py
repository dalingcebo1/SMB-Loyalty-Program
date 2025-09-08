"""
Notification system API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional, Dict, Any
from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import User, Tenant, Notification
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter()

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str
    user_ids: Optional[List[int]] = None
    all_users: bool = False
    action_url: Optional[str] = None

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    created_at: datetime
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None

async def send_notification_task(
    db: Session,
    tenant_id: str,
    title: str,
    message: str,
    notification_type: str,
    user_ids: List[int] = None,
    all_users: bool = False,
    action_url: Optional[str] = None
):
    """Send notification to specified users or all tenant users"""
    try:
        notifications = []
        
        if all_users:
            # Get all users for this tenant
            users = db.query(User).filter(
                User.tenant_id == tenant_id,
                User.role == "user"
            ).all()
            user_ids = [user.id for user in users]
        
        # Create notification records
        for user_id in user_ids or []:
            notification = Notification(
                tenant_id=tenant_id,
                user_id=user_id,
                title=title,
                message=message,
                type=notification_type,
                action_url=action_url,
                created_at=datetime.utcnow()
            )
            db.add(notification)
        
        db.commit()
        return {"status": "success", "count": len(user_ids or [])}
    except Exception as e:
        db.rollback()
        raise e

@router.post("/send", status_code=201)
async def create_notification(
    background_tasks: BackgroundTasks,
    notification: NotificationCreate = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and send a notification to users"""
    # Only admins and staff can send notifications
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate inputs
    if not notification.all_users and not notification.user_ids:
        raise HTTPException(
            status_code=400, 
            detail="Either specify user_ids or set all_users=true"
        )
    
    # If specific user_ids provided, verify they belong to this tenant
    if notification.user_ids:
        tenant_users = db.query(User.id).filter(
            User.id.in_(notification.user_ids),
            User.tenant_id == current_user.tenant_id
        ).all()
        valid_user_ids = [u.id for u in tenant_users]
        
        if len(valid_user_ids) != len(notification.user_ids):
            raise HTTPException(
                status_code=400,
                detail="Some user IDs do not belong to your tenant"
            )
    
    # Send notification in the background
    background_tasks.add_task(
        send_notification_task,
        db=db,
        tenant_id=current_user.tenant_id,
        title=notification.title,
        message=notification.message,
        notification_type=notification.type,
        user_ids=notification.user_ids,
        all_users=notification.all_users,
        action_url=notification.action_url
    )
    
    return {"status": "Notifications queued for delivery"}

@router.get("/my", response_model=List[NotificationResponse])
async def get_my_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's notifications"""
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.tenant_id == current_user.tenant_id
    )
    
    if unread_only:
        query = query.filter(Notification.read_at == None)
    
    query = query.order_by(Notification.created_at.desc())
    notifications = query.offset(offset).limit(limit).all()
    
    return notifications

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
        Notification.tenant_id == current_user.tenant_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        db.commit()
    
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all user's notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.tenant_id == current_user.tenant_id,
        Notification.read_at == None
    ).update({"read_at": datetime.utcnow()})
    
    db.commit()
    
    return {"status": "success"}

@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of unread notifications"""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.tenant_id == current_user.tenant_id,
        Notification.read_at == None
    ).count()
    
    return {"unread_count": count}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
        Notification.tenant_id == current_user.tenant_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"status": "success"}

# Admin endpoints for managing notifications
@router.get("/admin/all")
async def get_all_notifications(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    notification_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all notifications for the tenant (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = db.query(Notification).filter(
        Notification.tenant_id == current_user.tenant_id
    )
    
    if notification_type:
        query = query.filter(Notification.type == notification_type)
    
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    # Include user information
    result = []
    for notification in notifications:
        result.append({
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "created_at": notification.created_at,
            "read_at": notification.read_at,
            "action_url": notification.action_url,
            "user": {
                "id": notification.user.id,
                "email": notification.user.email,
                "name": f"{notification.user.first_name} {notification.user.last_name}".strip()
            }
        })
    
    return result

@router.get("/admin/stats")
async def get_notification_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notification statistics (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get stats by type
    stats_by_type = db.query(
        Notification.type,
        func.count(Notification.id).label("total"),
        func.sum(case([(Notification.read_at != None, 1)], else_=0)).label("read"),
        func.sum(case([(Notification.read_at == None, 1)], else_=0)).label("unread")
    ).filter(
        Notification.tenant_id == current_user.tenant_id
    ).group_by(Notification.type).all()
    
    # Get recent activity (last 7 days)
    recent_activity = db.query(
        func.date(Notification.created_at).label("date"),
        func.count(Notification.id).label("count")
    ).filter(
        Notification.tenant_id == current_user.tenant_id,
        Notification.created_at >= datetime.utcnow() - timedelta(days=7)
    ).group_by(func.date(Notification.created_at)).all()
    
    return {
        "stats_by_type": [
            {
                "type": stat.type,
                "total": stat.total,
                "read": stat.read,
                "unread": stat.unread,
                "read_rate": round((stat.read / stat.total) * 100, 1) if stat.total > 0 else 0
            }
            for stat in stats_by_type
        ],
        "recent_activity": [
            {"date": str(activity.date), "count": activity.count}
            for activity in recent_activity
        ]
    }

# Helper function to send automated notifications
async def send_automated_notification(
    db: Session,
    tenant_id: str,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    action_url: Optional[str] = None
):
    """Helper function to send automated notifications from other parts of the system"""
    notification = Notification(
        tenant_id=tenant_id,
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        action_url=action_url,
        created_at=datetime.utcnow()
    )
    db.add(notification)
    db.commit()
    return notification
