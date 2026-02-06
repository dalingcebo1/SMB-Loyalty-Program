"""
Celery Background Tasks

All async background tasks for the platform.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from celery import Task
from sqlalchemy.orm import Session

from app.workers.celery_app import celery_app
from app.models import User, Tenant, Order, Subscription, AuditLog
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService
from app.core.tenant_cache import invalidate_tenant_cache, warm_tenant_cache
from database import SessionLocal

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task with database session handling"""
    _db: Optional[Session] = None
    
    @property
    def db(self) -> Session:
        if self._db is None:
            self._db = SessionLocal()
        return self._db
    
    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


# ============================================================================
# NOTIFICATION TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True, max_retries=3)
def send_loyalty_notification(
    self,
    tenant_id: str,
    user_id: int,
    notification_type: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send loyalty notification to user.
    
    Args:
        tenant_id: Tenant ID
        user_id: User ID
        notification_type: Type of notification (order_complete, points_earned, etc.)
        data: Notification data
    
    Returns:
        Result with status
    """
    try:
        user = self.db.query(User).filter_by(
            id=user_id,
            tenant_id=tenant_id
        ).first()
        
        if not user:
            logger.warning(f"User {user_id} not found in tenant {tenant_id}")
            return {"status": "user_not_found"}
        
        # Send notification based on type
        notification_service = NotificationService(self.db)
        result = notification_service.send_notification(
            user=user,
            notification_type=notification_type,
            data=data
        )
        
        logger.info(
            f"Notification sent: {notification_type} to user {user_id} "
            f"in tenant {tenant_id}"
        )
        
        return {
            "status": "success",
            "user_id": user_id,
            "notification_type": notification_type,
            "result": result
        }
        
    except Exception as exc:
        logger.error(
            f"Failed to send notification: {exc}",
            exc_info=True
        )
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(base=DatabaseTask, bind=True, max_retries=3)
def send_bulk_notifications(
    self,
    tenant_id: str,
    user_ids: list[int],
    notification_type: str,
    data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Send bulk notifications to multiple users.
    
    Args:
        tenant_id: Tenant ID
        user_ids: List of user IDs
        notification_type: Type of notification
        data: Notification data
    
    Returns:
        Result with success/failure counts
    """
    success_count = 0
    failure_count = 0
    
    for user_id in user_ids:
        try:
            send_loyalty_notification.delay(
                tenant_id=tenant_id,
                user_id=user_id,
                notification_type=notification_type,
                data=data
            )
            success_count += 1
        except Exception as exc:
            logger.error(f"Failed to queue notification for user {user_id}: {exc}")
            failure_count += 1
    
    return {
        "status": "completed",
        "total": len(user_ids),
        "success": success_count,
        "failed": failure_count
    }


@celery_app.task(base=DatabaseTask, bind=True)
def send_welcome_email(
    self,
    email: str,
    tenant_id: str,
    user_name: str
) -> Dict[str, Any]:
    """
    Send welcome email to new user.
    
    Args:
        email: User email
        tenant_id: Tenant ID
        user_name: User name
    
    Returns:
        Result with status
    """
    try:
        tenant = self.db.query(Tenant).filter_by(id=tenant_id).first()
        if not tenant:
            return {"status": "tenant_not_found"}
        
        email_service = EmailService()
        email_service.send_welcome_email(
            to_email=email,
            user_name=user_name,
            tenant_name=tenant.name
        )
        
        logger.info(f"Welcome email sent to {email} for tenant {tenant_id}")
        
        return {"status": "success", "email": email}
        
    except Exception as exc:
        logger.error(f"Failed to send welcome email: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


# ============================================================================
# REPORT GENERATION TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True)
def generate_monthly_report(
    self,
    tenant_id: str,
    month: str,
    report_type: str = "full"
) -> Dict[str, Any]:
    """
    Generate monthly report for tenant.
    
    Args:
        tenant_id: Tenant ID
        month: Month in YYYY-MM format
        report_type: Type of report (full, summary, financial)
    
    Returns:
        Report data
    """
    try:
        from app.services.report_service import ReportService
        
        report_service = ReportService(self.db)
        report = report_service.generate_monthly_report(
            tenant_id=tenant_id,
            month=month,
            report_type=report_type
        )
        
        logger.info(
            f"Monthly report generated for tenant {tenant_id}, month {month}"
        )
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "month": month,
            "report": report
        }
        
    except Exception as exc:
        logger.error(f"Failed to generate monthly report: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(base=DatabaseTask, bind=True)
def generate_daily_analytics(self) -> Dict[str, Any]:
    """
    Generate daily analytics for all active tenants.
    
    Returns:
        Summary of processing
    """
    try:
        from app.services.analytics_service import AnalyticsService
        
        # Get all active tenants
        tenants = self.db.query(Tenant).filter_by(subscription_status="active").all()
        
        analytics_service = AnalyticsService(self.db)
        processed = 0
        failed = 0
        
        for tenant in tenants:
            try:
                analytics_service.generate_daily_summary(tenant.id)
                processed += 1
            except Exception as exc:
                logger.error(
                    f"Failed to generate analytics for tenant {tenant.id}: {exc}"
                )
                failed += 1
        
        logger.info(
            f"Daily analytics generated: {processed} succeeded, {failed} failed"
        )
        
        return {
            "status": "completed",
            "processed": processed,
            "failed": failed,
            "total_tenants": len(tenants)
        }
        
    except Exception as exc:
        logger.error(f"Failed to generate daily analytics: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


# ============================================================================
# DATA SYNC TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True)
def sync_tenant_data_to_analytics(
    self,
    tenant_id: str,
    sync_type: str = "incremental"
) -> Dict[str, Any]:
    """
    Sync tenant data to analytics warehouse.
    
    Args:
        tenant_id: Tenant ID
        sync_type: Type of sync (incremental, full)
    
    Returns:
        Sync result
    """
    try:
        from app.services.analytics_service import AnalyticsService
        
        analytics_service = AnalyticsService(self.db)
        result = analytics_service.sync_to_warehouse(
            tenant_id=tenant_id,
            sync_type=sync_type
        )
        
        logger.info(
            f"Analytics sync completed for tenant {tenant_id}: {result}"
        )
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "sync_type": sync_type,
            "result": result
        }
        
    except Exception as exc:
        logger.error(f"Failed to sync analytics data: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(base=DatabaseTask, bind=True)
def sync_tenant_caches(self) -> Dict[str, Any]:
    """
    Warm caches for all active tenants.
    
    Returns:
        Summary of cache warming
    """
    try:
        tenants = self.db.query(Tenant).filter_by(subscription_status="active").all()
        
        warmed = 0
        failed = 0
        
        for tenant in tenants:
            try:
                warm_tenant_cache(tenant.id, self.db)
                warmed += 1
            except Exception as exc:
                logger.error(
                    f"Failed to warm cache for tenant {tenant.id}: {exc}"
                )
                failed += 1
        
        logger.info(
            f"Cache warming completed: {warmed} succeeded, {failed} failed"
        )
        
        return {
            "status": "completed",
            "warmed": warmed,
            "failed": failed,
            "total_tenants": len(tenants)
        }
        
    except Exception as exc:
        logger.error(f"Failed to sync tenant caches: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


# ============================================================================
# MAINTENANCE TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True)
def cleanup_expired_sessions(self) -> Dict[str, Any]:
    """
    Clean up expired user sessions.
    
    Returns:
        Cleanup summary
    """
    try:
        from app.models import UserSession
        
        # Delete sessions older than 30 days
        cutoff = datetime.utcnow() - timedelta(days=30)
        deleted = self.db.query(UserSession).filter(
            UserSession.last_activity < cutoff
        ).delete()
        
        self.db.commit()
        
        logger.info(f"Cleaned up {deleted} expired sessions")
        
        return {
            "status": "success",
            "deleted": deleted,
            "cutoff": cutoff.isoformat()
        }
        
    except Exception as exc:
        self.db.rollback()
        logger.error(f"Failed to cleanup expired sessions: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(base=DatabaseTask, bind=True)
def cleanup_old_audit_logs(self, days: int = 90) -> Dict[str, Any]:
    """
    Archive or delete old audit logs.
    
    Args:
        days: Number of days to keep
    
    Returns:
        Cleanup summary
    """
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        deleted = self.db.query(AuditLog).filter(
            AuditLog.created_at < cutoff
        ).delete()
        
        self.db.commit()
        
        logger.info(f"Cleaned up {deleted} old audit logs (>{days} days)")
        
        return {
            "status": "success",
            "deleted": deleted,
            "cutoff": cutoff.isoformat()
        }
        
    except Exception as exc:
        self.db.rollback()
        logger.error(f"Failed to cleanup audit logs: {exc}", exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(base=DatabaseTask, bind=True)
def process_scheduled_subscriptions(self) -> Dict[str, Any]:
    """
    Process subscription renewals and expirations.
    
    Returns:
        Processing summary
    """
    try:
        from app.services.subscription_service import SubscriptionService
        
        subscription_service = SubscriptionService(self.db)
        result = subscription_service.process_scheduled_renewals()
        
        logger.info(f"Subscription processing completed: {result}")
        
        return {
            "status": "success",
            "result": result
        }
        
    except Exception as exc:
        logger.error(
            f"Failed to process scheduled subscriptions: {exc}",
            exc_info=True
        )
        return {"status": "error", "error": str(exc)}


# ============================================================================
# ORDER PROCESSING TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True, max_retries=5)
def process_order_completion(
    self,
    tenant_id: str,
    order_id: int
) -> Dict[str, Any]:
    """
    Process order completion (points, notifications, etc).
    
    Args:
        tenant_id: Tenant ID
        order_id: Order ID
    
    Returns:
        Processing result
    """
    try:
        order = self.db.query(Order).filter_by(
            id=order_id,
            tenant_id=tenant_id
        ).first()
        
        if not order:
            logger.warning(f"Order {order_id} not found in tenant {tenant_id}")
            return {"status": "order_not_found"}
        
        # Award loyalty points
        from app.services.loyalty_service import LoyaltyService
        loyalty_service = LoyaltyService(self.db)
        points_awarded = loyalty_service.award_points_for_order(order)
        
        # Send notification
        send_loyalty_notification.delay(
            tenant_id=tenant_id,
            user_id=order.user_id,
            notification_type="order_complete",
            data={
                "order_id": order_id,
                "points_awarded": points_awarded,
                "total": order.total_amount
            }
        )
        
        # Invalidate user's order cache
        invalidate_tenant_cache(tenant_id)
        
        logger.info(
            f"Order {order_id} processed: {points_awarded} points awarded"
        )
        
        return {
            "status": "success",
            "order_id": order_id,
            "points_awarded": points_awarded
        }
        
    except Exception as exc:
        logger.error(
            f"Failed to process order completion: {exc}",
            exc_info=True
        )
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


# ============================================================================
# TENANT INITIALIZATION TASKS
# ============================================================================

@celery_app.task(base=DatabaseTask, bind=True)
def initialize_tenant_schema(
    self,
    tenant_id: str
) -> Dict[str, Any]:
    """
    Initialize database schema for new tenant.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        Initialization result
    """
    try:
        from app.services.tenant_service import TenantService
        
        tenant_service = TenantService(self.db)
        tenant_service.initialize_schema(tenant_id)
        
        logger.info(f"Schema initialized for tenant {tenant_id}")
        
        return {"status": "success", "tenant_id": tenant_id}
        
    except Exception as exc:
        logger.error(
            f"Failed to initialize tenant schema: {exc}",
            exc_info=True
        )
        return {"status": "error", "error": str(exc)}


@celery_app.task(base=DatabaseTask, bind=True)
def seed_tenant_defaults(
    self,
    tenant_id: str,
    vertical_type: str
) -> Dict[str, Any]:
    """
    Seed default data for new tenant.
    
    Args:
        tenant_id: Tenant ID
        vertical_type: Vertical type
    
    Returns:
        Seeding result
    """
    try:
        from app.verticals.registry import VerticalRegistry
        
        vertical = VerticalRegistry.get(vertical_type)
        if not vertical:
            return {"status": "vertical_not_found"}
        
        tenant = self.db.query(Tenant).filter_by(id=tenant_id).first()
        if not tenant:
            return {"status": "tenant_not_found"}
        
        # Call vertical-specific seeding hook
        vertical.on_tenant_created(tenant, self.db)
        
        logger.info(
            f"Default data seeded for tenant {tenant_id}, "
            f"vertical {vertical_type}"
        )
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "vertical_type": vertical_type
        }
        
    except Exception as exc:
        logger.error(
            f"Failed to seed tenant defaults: {exc}",
            exc_info=True
        )
        return {"status": "error", "error": str(exc)}
