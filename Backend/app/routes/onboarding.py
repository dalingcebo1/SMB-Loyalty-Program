"""
Business onboarding API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.plugins.auth.routes import get_current_user
from app.models import User
from app.services.business_onboarding import onboarding_service

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class CreateBusinessRequest(BaseModel):
    business_name: str
    vertical_type: str
    owner_email: EmailStr
    owner_first_name: str
    owner_last_name: str
    owner_phone: str
    primary_domain: Optional[str] = None


class CompleteStepRequest(BaseModel):
    step: str
    data: Dict[str, Any]


@router.post("/create-business")
async def create_business(
    request: CreateBusinessRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new business tenant and start onboarding."""
    try:
        result = onboarding_service.create_business(
            business_name=request.business_name,
            vertical_type=request.vertical_type,
            owner_email=request.owner_email,
            owner_first_name=request.owner_first_name,
            owner_last_name=request.owner_last_name,
            owner_phone=request.owner_phone,
            primary_domain=request.primary_domain,
            db=db
        )
        
        return {
            "success": True,
            "message": "Business account created successfully",
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create business: {str(e)}"
        )


@router.get("/status")
async def get_onboarding_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get onboarding status for the current tenant."""
    try:
        result = onboarding_service.get_onboarding_status(
            tenant_id=current_user.tenant_id,
            db=db
        )
        
        return {
            "success": True,
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get onboarding status: {str(e)}"
        )


@router.post("/complete-step")
async def complete_onboarding_step(
    request: CompleteStepRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Complete an onboarding step."""
    # Only admins can complete onboarding steps
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can complete onboarding steps"
        )
    
    try:
        result = onboarding_service.complete_onboarding_step(
            tenant_id=current_user.tenant_id,
            step=request.step,
            data=request.data,
            db=db
        )
        
        return {
            "success": True,
            "message": f"Onboarding step '{request.step}' completed",
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete onboarding step: {str(e)}"
        )
