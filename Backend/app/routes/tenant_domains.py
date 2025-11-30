"""Admin routes for managing tenant domain mappings."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.tenant_context import require_capabilities
from app.models import TenantDomain, Tenant

router = APIRouter(prefix="/admin/tenant-domains", tags=["Admin - Tenant Domains"])


class TenantDomainCreate(BaseModel):
    """Schema for creating a tenant domain mapping."""
    tenant_id: str = Field(..., description="Tenant ID to map the domain to")
    domain: str = Field(..., description="Domain name (e.g., 'example.com' or 'subdomain.example.com')")
    is_primary: bool = Field(default=False, description="Whether this is the primary domain for the tenant")
    environment: Optional[str] = Field(None, description="Environment label (e.g., 'production', 'dev', 'staging')")


class TenantDomainUpdate(BaseModel):
    """Schema for updating a tenant domain mapping."""
    is_primary: Optional[bool] = Field(None, description="Whether this is the primary domain for the tenant")
    environment: Optional[str] = Field(None, description="Environment label (e.g., 'production', 'dev', 'staging')")


class TenantDomainResponse(BaseModel):
    """Schema for tenant domain response."""
    id: int
    tenant_id: str
    domain: str
    is_primary: bool
    environment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TenantDomainResponse])
def list_tenant_domains(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _auth=Depends(require_capabilities("view_admin_panel"))
):
    """List all tenant domain mappings, optionally filtered by tenant_id."""
    query = db.query(TenantDomain)
    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)
    return query.order_by(TenantDomain.tenant_id, TenantDomain.domain).all()


@router.post("/", response_model=TenantDomainResponse, status_code=status.HTTP_201_CREATED)
def create_tenant_domain(
    data: TenantDomainCreate,
    db: Session = Depends(get_db),
    _auth=Depends(require_capabilities("manage_tenants"))
):
    """Create a new tenant domain mapping."""
    # Verify tenant exists
    tenant = db.query(Tenant).filter_by(id=data.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{data.tenant_id}' not found"
        )
    
    # Check if domain already exists
    existing = db.query(TenantDomain).filter_by(domain=data.domain).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain '{data.domain}' is already mapped to tenant '{existing.tenant_id}'"
        )
    
    # Create domain mapping
    domain_mapping = TenantDomain(
        tenant_id=data.tenant_id,
        domain=data.domain,
        is_primary=data.is_primary,
        environment=data.environment,
        created_at=datetime.utcnow()
    )
    db.add(domain_mapping)
    db.commit()
    db.refresh(domain_mapping)
    
    return domain_mapping


@router.patch("/{domain_id}", response_model=TenantDomainResponse)
def update_tenant_domain(
    domain_id: int,
    data: TenantDomainUpdate,
    db: Session = Depends(get_db),
    _auth=Depends(require_capabilities("manage_tenants"))
):
    """Update a tenant domain mapping."""
    domain_mapping = db.query(TenantDomain).filter_by(id=domain_id).first()
    if not domain_mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain mapping ID {domain_id} not found"
        )
    
    # Update fields
    if data.is_primary is not None:
        domain_mapping.is_primary = data.is_primary
    if data.environment is not None:
        domain_mapping.environment = data.environment
    
    db.commit()
    db.refresh(domain_mapping)
    
    return domain_mapping


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    _auth=Depends(require_capabilities("manage_tenants"))
):
    """Delete a tenant domain mapping."""
    domain_mapping = db.query(TenantDomain).filter_by(id=domain_id).first()
    if not domain_mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain mapping ID {domain_id} not found"
        )
    
    db.delete(domain_mapping)
    db.commit()
    
    return None


@router.get("/lookup/{domain}", response_model=TenantDomainResponse)
def lookup_domain(
    domain: str,
    db: Session = Depends(get_db),
    _auth=Depends(require_capabilities("view_admin_panel"))
):
    """Look up which tenant a specific domain maps to."""
    domain_mapping = db.query(TenantDomain).filter_by(domain=domain).first()
    if not domain_mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain '{domain}' not found in mappings"
        )
    
    return domain_mapping
