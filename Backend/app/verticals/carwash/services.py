"""
Carwash Vertical Services

Business logic for carwash operations.
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.verticals.carwash.models import (
    Vehicle,
    WashPackage,
    CarwashMembership,
    WashHistory
)
from app.models import Tenant, User, Order


class VehicleService:
    """Service for managing customer vehicles"""
    
    @staticmethod
    def create_vehicle(
        db: Session,
        tenant_id: str,
        user_id: int,
        license_plate: str,
        **kwargs
    ) -> Vehicle:
        """Create a new vehicle"""
        vehicle = Vehicle(
            tenant_id=tenant_id,
            user_id=user_id,
            license_plate=license_plate.upper(),
            **kwargs
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle
    
    @staticmethod
    def get_user_vehicles(
        db: Session,
        tenant_id: str,
        user_id: int,
        active_only: bool = True
    ) -> List[Vehicle]:
        """Get all vehicles for a user"""
        query = db.query(Vehicle).filter_by(
            tenant_id=tenant_id,
            user_id=user_id
        )
        
        if active_only:
            query = query.filter_by(is_active=True)
        
        return query.order_by(Vehicle.created_at.desc()).all()
    
    @staticmethod
    def get_vehicle_history(
        db: Session,
        vehicle_id: int,
        limit: int = 50
    ) -> List[WashHistory]:
        """Get wash history for a vehicle"""
        return db.query(WashHistory).filter_by(
            vehicle_id=vehicle_id
        ).order_by(
            WashHistory.service_date.desc()
        ).limit(limit).all()


class WashPackageService:
    """Service for managing wash packages"""
    
    @staticmethod
    def get_active_packages(
        db: Session,
        tenant_id: str
    ) -> List[WashPackage]:
        """Get all active wash packages"""
        return db.query(WashPackage).filter_by(
            tenant_id=tenant_id,
            is_active=True
        ).order_by(WashPackage.sort_order, WashPackage.price_cents).all()
    
    @staticmethod
    def create_default_packages(
        db: Session,
        tenant_id: str
    ) -> List[WashPackage]:
        """Create default wash packages for new tenant"""
        default_packages = [
            {
                "name": "Basic Wash",
                "description": "Exterior wash and tire shine",
                "price_cents": 5000,  # R50
                "duration_minutes": 15,
                "features": {"exterior": True, "interior": False, "wax": False},
                "points_awarded": 50,
                "sort_order": 1
            },
            {
                "name": "Premium Wash",
                "description": "Exterior + interior clean",
                "price_cents": 10000,  # R100
                "duration_minutes": 30,
                "features": {"exterior": True, "interior": True, "wax": False},
                "points_awarded": 100,
                "sort_order": 2
            },
            {
                "name": "Deluxe Wash",
                "description": "Full service with wax",
                "price_cents": 15000,  # R150
                "duration_minutes": 45,
                "features": {"exterior": True, "interior": True, "wax": True},
                "points_awarded": 150,
                "sort_order": 3
            }
        ]
        
        packages = []
        for pkg_data in default_packages:
            package = WashPackage(
                tenant_id=tenant_id,
                **pkg_data
            )
            db.add(package)
            packages.append(package)
        
        db.commit()
        return packages


class MembershipService:
    """Service for managing carwash memberships"""
    
    @staticmethod
    def create_membership(
        db: Session,
        tenant_id: str,
        user_id: int,
        tier: str,
        monthly_price_cents: int,
        **kwargs
    ) -> CarwashMembership:
        """Create a new membership"""
        membership = CarwashMembership(
            tenant_id=tenant_id,
            user_id=user_id,
            tier=tier,
            monthly_price_cents=monthly_price_cents,
            next_billing_date=datetime.utcnow() + timedelta(days=30),
            **kwargs
        )
        db.add(membership)
        db.commit()
        db.refresh(membership)
        return membership
    
    @staticmethod
    def use_membership_wash(
        db: Session,
        membership_id: int
    ) -> bool:
        """Use one wash from membership"""
        membership = db.get(CarwashMembership, membership_id)
        
        if not membership or membership.status != "active":
            return False
        
        if membership.washes_used_this_month >= membership.washes_per_month:
            return False  # No washes remaining
        
        membership.washes_used_this_month += 1
        membership.updated_at = datetime.utcnow()
        db.commit()
        return True
    
    @staticmethod
    def reset_monthly_usage(
        db: Session,
        membership_id: int
    ):
        """Reset monthly wash usage counter"""
        membership = db.get(CarwashMembership, membership_id)
        if membership:
            membership.washes_used_this_month = 0
            membership.last_reset_date = datetime.utcnow()
            membership.next_billing_date = datetime.utcnow() + timedelta(days=30)
            db.commit()


class WashHistoryService:
    """Service for tracking wash history"""
    
    @staticmethod
    def create_wash_record(
        db: Session,
        tenant_id: str,
        user_id: int,
        service_type: str,
        **kwargs
    ) -> WashHistory:
        """Create a wash history record"""
        record = WashHistory(
            tenant_id=tenant_id,
            user_id=user_id,
            service_type=service_type,
            **kwargs
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    
    @staticmethod
    def complete_wash(
        db: Session,
        wash_id: int,
        quality_rating: Optional[int] = None,
        staff_notes: Optional[str] = None
    ):
        """Mark wash as completed"""
        record = db.get(WashHistory, wash_id)
        if record:
            record.status = "completed"
            record.completed_at = datetime.utcnow()
            if quality_rating:
                record.quality_rating = quality_rating
            if staff_notes:
                record.staff_notes = staff_notes
            db.commit()
    
    @staticmethod
    def get_user_wash_stats(
        db: Session,
        tenant_id: str,
        user_id: int
    ) -> Dict[str, Any]:
        """Get wash statistics for a user"""
        # Total washes
        total_washes = db.query(func.count(WashHistory.id)).filter_by(
            tenant_id=tenant_id,
            user_id=user_id,
            status="completed"
        ).scalar()
        
        # Last wash date
        last_wash = db.query(WashHistory).filter_by(
            tenant_id=tenant_id,
            user_id=user_id,
            status="completed"
        ).order_by(WashHistory.completed_at.desc()).first()
        
        # Average rating
        avg_rating = db.query(func.avg(WashHistory.quality_rating)).filter_by(
            tenant_id=tenant_id,
            user_id=user_id,
            status="completed"
        ).scalar()
        
        return {
            "total_washes": total_washes or 0,
            "last_wash_date": last_wash.completed_at if last_wash else None,
            "average_rating": round(float(avg_rating), 1) if avg_rating else None
        }
