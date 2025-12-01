"""
Vertical Registry API Routes

Provides endpoints to query available verticals, their features, and configurations.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import logging

from app.verticals import registry
from app.core.tenant_context import get_tenant_context, TenantContext

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/verticals", tags=["verticals"])


class VerticalInfo(BaseModel):
    """Information about a vertical module."""
    vertical_key: str
    display_name: str
    description: str
    icon: str | None
    requires_compliance: bool
    features: List[str]
    admin_capabilities: List[str]
    staff_capabilities: List[str]


class VerticalListResponse(BaseModel):
    """Response containing list of all verticals."""
    verticals: List[VerticalInfo]
    total: int


@router.get("", response_model=VerticalListResponse)
async def list_verticals():
    """
    Get list of all available vertical modules.
    
    Returns information about all registered verticals including their
    features, capabilities, and configuration options.
    """
    all_verticals = registry.list_all()
    
    vertical_info_list = []
    for v in all_verticals:
        vertical_info_list.append(VerticalInfo(
            vertical_key=v.vertical_key,
            display_name=v.display_name,
            description=v.description,
            icon=v.icon,
            requires_compliance=v.requires_compliance,
            features=v.get_features(),
            admin_capabilities=v.get_admin_capabilities(),
            staff_capabilities=v.get_staff_capabilities(),
        ))
    
    return VerticalListResponse(
        verticals=vertical_info_list,
        total=len(vertical_info_list)
    )


@router.get("/{vertical_key}", response_model=VerticalInfo)
async def get_vertical(vertical_key: str):
    """
    Get detailed information about a specific vertical.
    
    Args:
        vertical_key: The unique identifier for the vertical (e.g., 'carwash')
        
    Returns:
        Detailed vertical information
        
    Raises:
        HTTPException: 404 if vertical not found
    """
    vertical = registry.get(vertical_key)
    
    if not vertical:
        raise HTTPException(
            status_code=404,
            detail=f"Vertical '{vertical_key}' not found"
        )
    
    return VerticalInfo(
        vertical_key=vertical.vertical_key,
        display_name=vertical.display_name,
        description=vertical.description,
        icon=vertical.icon,
        requires_compliance=vertical.requires_compliance,
        features=vertical.get_features(),
        admin_capabilities=vertical.get_admin_capabilities(),
        staff_capabilities=vertical.get_staff_capabilities(),
    )


@router.get("/{vertical_key}/default-config")
async def get_vertical_default_config(vertical_key: str) -> Dict[str, Any]:
    """
    Get default configuration for a vertical.
    
    Useful when enabling a vertical for a tenant to see what the
    default settings will be.
    
    Args:
        vertical_key: The unique identifier for the vertical
        
    Returns:
        Default configuration dictionary
        
    Raises:
        HTTPException: 404 if vertical not found
    """
    vertical = registry.get(vertical_key)
    
    if not vertical:
        raise HTTPException(
            status_code=404,
            detail=f"Vertical '{vertical_key}' not found"
        )
    
    return vertical.get_default_config()


@router.get("/features/search")
async def search_by_feature(feature: str) -> List[str]:
    """
    Find all verticals that provide a specific feature.
    
    Args:
        feature: The feature identifier to search for
        
    Returns:
        List of vertical keys that provide this feature
    """
    verticals = registry.get_by_features(feature)
    return [v.vertical_key for v in verticals]
