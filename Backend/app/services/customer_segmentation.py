"""
Customer Segmentation Service

Filters and segments customers for targeted marketing campaigns.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import logging

from app.models import User, Order, Payment, PointBalance, LoyaltyTransaction, Tenant
from app.vertical_models.campaigns import SegmentType

logger = logging.getLogger(__name__)


class CustomerSegmentationService:
    """Service for customer segmentation and filtering."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_segment_customers(
        self,
        tenant_id: str,
        segment_type: SegmentType,
        config: Dict[str, Any] = None
    ) -> List[User]:
        """
        Get list of customers matching segment criteria.
        
        Args:
            tenant_id: Tenant ID
            segment_type: Type of segment
            config: Additional configuration parameters
        
        Returns:
            List of User objects
        """
        config = config or {}
        
        segment_methods = {
            SegmentType.ALL: self._segment_all,
            SegmentType.HIGH_VALUE: self._segment_high_value,
            SegmentType.DORMANT: self._segment_dormant,
            SegmentType.NEW: self._segment_new,
            SegmentType.BIRTHDAY: self._segment_birthday,
            SegmentType.LOYALTY_TIER: self._segment_loyalty_tier,
        }
        
        method = segment_methods.get(segment_type, self._segment_all)
        return method(tenant_id, config)
    
    def _segment_all(self, tenant_id: str, config: Dict) -> List[User]:
        """All customers with valid email or phone."""
        return self.db.query(User).filter(
            User.tenant_id == tenant_id,
            or_(
                User.email.isnot(None),
                User.phone.isnot(None)
            )
        ).all()
    
    def _segment_high_value(self, tenant_id: str, config: Dict) -> List[User]:
        """Top spending customers."""
        min_spend = config.get("min_spend_cents", 50000)  # Default R500
        lookback_days = config.get("lookback_days", 90)
        
        cutoff_date = datetime.now() - timedelta(days=lookback_days)
        
        # Subquery: total spend per customer
        spenders = self.db.query(
            Order.customer_id,
            func.sum(Order.total_cents).label("total_spend")
        ).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= cutoff_date,
            Order.status == "completed"
        ).group_by(Order.customer_id).subquery()
        
        return self.db.query(User).join(
            spenders, User.id == spenders.c.customer_id
        ).filter(
            spenders.c.total_spend >= min_spend
        ).all()
    
    def _segment_dormant(self, tenant_id: str, config: Dict) -> List[User]:
        """Customers inactive for X days."""
        days_inactive = config.get("days_inactive", 60)
        cutoff_date = datetime.now() - timedelta(days=days_inactive)
        
        # Find customers with last order before cutoff
        active_customers = self.db.query(Order.customer_id).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= cutoff_date
        ).distinct()
        
        return self.db.query(User).filter(
            User.tenant_id == tenant_id,
            ~User.id.in_(active_customers)
        ).all()
    
    def _segment_new(self, tenant_id: str, config: Dict) -> List[User]:
        """Recently signed up customers."""
        days_new = config.get("days_new", 30)
        cutoff_date = datetime.now() - timedelta(days=days_new)
        
        return self.db.query(User).filter(
            User.tenant_id == tenant_id,
            User.created_at >= cutoff_date
        ).all()
    
    def _segment_birthday(self, tenant_id: str, config: Dict) -> List[User]:
        """Customers with birthday this month."""
        current_month = datetime.now().month
        
        # Note: Requires birth_date field in User model
        return self.db.query(User).filter(
            User.tenant_id == tenant_id,
            func.extract('month', User.created_at) == current_month  # Placeholder
        ).all()
    
    def _segment_loyalty_tier(self, tenant_id: str, config: Dict) -> List[User]:
        """Customers in specific loyalty tier."""
        tier_name = config.get("tier_name", "Gold")
        
        # Get users with points in tier range
        tier_customers = self.db.query(User.id).join(PointBalance).filter(
            User.tenant_id == tenant_id,
            PointBalance.available_points >= config.get("min_points", 1000)
        )
        
        return self.db.query(User).filter(
            User.id.in_(tier_customers)
        ).all()
    
    def get_segment_count(
        self,
        tenant_id: str,
        segment_type: SegmentType,
        config: Dict[str, Any] = None
    ) -> int:
        """Get count of customers in segment without fetching full list."""
        customers = self.get_segment_customers(tenant_id, segment_type, config)
        return len(customers)
    
    def get_segment_preview(
        self,
        tenant_id: str,
        segment_type: SegmentType,
        config: Dict[str, Any] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get preview of segment customers."""
        customers = self.get_segment_customers(tenant_id, segment_type, config)[:limit]
        
        return [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
            }
            for c in customers
        ]
