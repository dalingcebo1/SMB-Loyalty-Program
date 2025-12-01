"""
Carwash Vertical Routes

Vertical-specific endpoints for car wash and detailing operations.
Includes vehicle management, wash packages, and bay operations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.plugins.auth.routes import get_current_user, require_capability
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import User, Vehicle, Service
from pydantic import BaseModel, Field

# Create vertical-specific router
router = APIRouter(prefix="/vertical/carwash", tags=["Carwash Vertical"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class VehicleCreate(BaseModel):
    """Schema for creating a vehicle."""
    registration: str = Field(..., description="Vehicle registration number")
    make: Optional[str] = Field(None, description="Vehicle make/manufacturer")
    model: Optional[str] = Field(None, description="Vehicle model")
    color: Optional[str] = Field(None, description="Vehicle color")
    notes: Optional[str] = Field(None, description="Additional notes")


class VehicleResponse(BaseModel):
    """Schema for vehicle response."""
    id: int
    user_id: int
    registration: str
    make: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True


class WashPackageResponse(BaseModel):
    """Schema for wash package response."""
    id: int
    name: str
    category: str
    base_price: int
    loyalty_eligible: bool
    
    class Config:
        from_attributes = True


# ============================================================================
# Vehicle Management Endpoints
# ============================================================================

@router.get("/vehicles", response_model=List[VehicleResponse])
async def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> List[Vehicle]:
    """
    List all vehicles for the current user.
    
    Returns vehicles owned by the authenticated user in the current tenant.
    """
    vehicles = (
        db.query(Vehicle)
        .filter(
            Vehicle.user_id == current_user.id,
            Vehicle.tenant_id == tenant_ctx.id,
        )
        .all()
    )
    return vehicles


@router.post("/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> Vehicle:
    """
    Create a new vehicle for the current user.
    
    Allows users to register their vehicles for faster check-in and service tracking.
    """
    # Check if vehicle already exists for this user/tenant
    existing = (
        db.query(Vehicle)
        .filter(
            Vehicle.registration == vehicle_data.registration,
            Vehicle.user_id == current_user.id,
            Vehicle.tenant_id == tenant_ctx.id,
        )
        .first()
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle with this registration already exists",
        )
    
    # Create new vehicle
    vehicle = Vehicle(
        user_id=current_user.id,
        tenant_id=tenant_ctx.id,
        registration=vehicle_data.registration,
        make=vehicle_data.make,
        model=vehicle_data.model,
        color=vehicle_data.color,
        notes=vehicle_data.notes,
    )
    
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    
    return vehicle


@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> Vehicle:
    """
    Get a specific vehicle by ID.
    
    Only returns the vehicle if it belongs to the current user and tenant.
    """
    vehicle = (
        db.query(Vehicle)
        .filter(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == current_user.id,
            Vehicle.tenant_id == tenant_ctx.id,
        )
        .first()
    )
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Delete a vehicle.
    
    Only allows deletion of vehicles owned by the current user.
    """
    vehicle = (
        db.query(Vehicle)
        .filter(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == current_user.id,
            Vehicle.tenant_id == tenant_ctx.id,
        )
        .first()
    )
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    
    db.delete(vehicle)
    db.commit()


# ============================================================================
# Wash Package Endpoints
# ============================================================================

@router.get("/packages", response_model=List[WashPackageResponse])
async def list_wash_packages(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    category: Optional[str] = Query(None, description="Filter by category"),
) -> List[Service]:
    """
    List available wash packages for the current tenant.
    
    Returns all service packages (wash types) available at this car wash location.
    """
    query = db.query(Service).filter(Service.tenant_id == tenant_ctx.id)
    
    if category:
        query = query.filter(Service.category == category)
    
    packages = query.all()
    return packages


@router.get("/packages/{package_id}", response_model=WashPackageResponse)
async def get_wash_package(
    package_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> Service:
    """
    Get details of a specific wash package.
    
    Returns pricing, description, and loyalty eligibility information.
    """
    package = (
        db.query(Service)
        .filter(
            Service.id == package_id,
            Service.tenant_id == tenant_ctx.id,
        )
        .first()
    )
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wash package not found",
        )
    
    return package


# ============================================================================
# Staff/Admin Endpoints
# ============================================================================

@router.get("/stats/vehicle-count")
async def get_vehicle_count(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("reports.view")),
) -> dict:
    """
    Get total count of registered vehicles.
    
    Requires reports.view capability (staff/admin only).
    """
    count = db.query(Vehicle).filter(Vehicle.tenant_id == tenant_ctx.id).count()
    
    return {
        "tenant_id": tenant_ctx.id,
        "vehicle_count": count,
        "vertical": "carwash",
    }


@router.get("/stats/package-popularity")
async def get_package_popularity(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("reports.view")),
) -> dict:
    """
    Get popularity statistics for wash packages.
    
    Returns usage count per package (requires order history integration).
    Requires reports.view capability (staff/admin only).
    """
    # This would query OrderLine joins to Service to count usage
    # For now, return package list with placeholder counts
    packages = db.query(Service).filter(Service.tenant_id == tenant_ctx.id).all()
    
    package_stats = [
        {
            "package_id": pkg.id,
            "package_name": pkg.name,
            "category": pkg.category,
            "base_price": pkg.base_price,
            "order_count": 0,  # TODO: Implement actual count from OrderLine
        }
        for pkg in packages
    ]
    
    return {
        "tenant_id": tenant_ctx.id,
        "packages": package_stats,
        "vertical": "carwash",
    }
