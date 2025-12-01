"""
Domain Verification Endpoints

API endpoints for domain ownership verification.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field
from typing import Optional, Dict
from sqlalchemy.orm import Session

from app.plugins.auth.routes import require_capability
from app.models import User, TenantDomain
from app.core.database import get_db
from app.core.tenant_context import get_tenant_context
from app.services.domain_verification import DomainVerificationService

router = APIRouter(prefix="/api/domains", tags=["domains"])


class DomainVerificationRequest(BaseModel):
    """Request to start domain verification"""
    domain: str = Field(..., description="Domain to verify (e.g., mybusiness.com)")


class DomainVerificationCheckRequest(BaseModel):
    """Request to verify domain"""
    domain: str = Field(..., description="Domain to verify")
    method: str = Field(..., description="Verification method (dns_txt, http_file, html_meta)")


class DomainVerificationResponse(BaseModel):
    """Domain verification response"""
    domain: str
    token: str
    methods: Dict[str, Dict[str, str]]
    expires_in_seconds: int


@router.post("/verify/start", response_model=DomainVerificationResponse)
async def start_domain_verification(
    request: DomainVerificationRequest,
    tenant_ctx = Depends(get_tenant_context),
    _user: User = Depends(require_capability("tenant.manage_domains")),
):
    """
    Start domain verification process.
    
    Generates a verification token and provides instructions for all verification methods.
    
    Requires: tenant.manage_domains capability (admin only)
    
    Returns:
        Verification token and instructions
    """
    domain = request.domain.lower().strip()
    
    # Validate domain format
    if not domain or "." not in domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain format"
        )
    
    # Generate verification token
    token = DomainVerificationService.generate_verification_token(domain)
    
    # Get verification methods
    methods = DomainVerificationService.get_verification_methods(domain, token)
    
    return DomainVerificationResponse(
        domain=domain,
        token=token,
        methods=methods,
        expires_in_seconds=DomainVerificationService.VERIFICATION_TTL
    )


@router.post("/verify/check")
async def check_domain_verification(
    request: DomainVerificationCheckRequest,
    tenant_ctx = Depends(get_tenant_context),
    _user: User = Depends(require_capability("tenant.manage_domains")),
    db: Session = Depends(get_db),
):
    """
    Verify domain ownership.
    
    Checks if domain verification is complete using the specified method.
    If successful, adds the domain to tenant_domains table.
    
    Requires: tenant.manage_domains capability (admin only)
    
    Returns:
        Verification result
    """
    domain = request.domain.lower().strip()
    method = request.method.lower()
    
    # Validate method
    if method not in ["dns_txt", "http_file", "html_meta"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification method. Must be one of: dns_txt, http_file, html_meta"
        )
    
    # Verify domain
    success, error_message = await DomainVerificationService.verify_domain(domain, method)
    
    if not success:
        return {
            "verified": False,
            "domain": domain,
            "method": method,
            "error": error_message
        }
    
    # Verification successful - add domain to tenant
    try:
        # Check if domain already exists
        existing = db.query(TenantDomain).filter_by(domain=domain).first()
        
        if existing:
            if existing.tenant_id == tenant_ctx.tenant.id:
                # Already belongs to this tenant
                return {
                    "verified": True,
                    "domain": domain,
                    "method": method,
                    "message": "Domain already verified and configured for your tenant"
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Domain is already verified by another tenant"
                )
        
        # Add new domain
        tenant_domain = TenantDomain(
            tenant_id=tenant_ctx.tenant.id,
            domain=domain,
            is_primary=False,
            is_verified=True,
            verified_at=db.func.now()
        )
        db.add(tenant_domain)
        db.commit()
        db.refresh(tenant_domain)
        
        # Clear verification token
        DomainVerificationService.clear_verification_token(domain)
        
        return {
            "verified": True,
            "domain": domain,
            "method": method,
            "message": "Domain verified successfully and added to your tenant",
            "domain_id": tenant_domain.id
        }
        
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add verified domain: {str(exc)}"
        )


@router.get("/verify/status/{domain}")
async def get_verification_status(
    domain: str,
    tenant_ctx = Depends(get_tenant_context),
    _user: User = Depends(require_capability("tenant.manage_domains")),
):
    """
    Get current verification status for a domain.
    
    Returns pending verification details if available.
    
    Requires: tenant.manage_domains capability (admin only)
    
    Returns:
        Verification status
    """
    domain = domain.lower().strip()
    
    status_info = DomainVerificationService.get_verification_status(domain)
    
    if not status_info:
        return {
            "domain": domain,
            "status": "no_pending_verification",
            "message": "No pending verification found. Start verification first."
        }
    
    return status_info


@router.delete("/verify/cancel/{domain}")
async def cancel_domain_verification(
    domain: str,
    tenant_ctx = Depends(get_tenant_context),
    _user: User = Depends(require_capability("tenant.manage_domains")),
):
    """
    Cancel pending domain verification.
    
    Clears the verification token.
    
    Requires: tenant.manage_domains capability (admin only)
    
    Returns:
        Cancellation confirmation
    """
    domain = domain.lower().strip()
    
    DomainVerificationService.clear_verification_token(domain)
    
    return {
        "domain": domain,
        "status": "cancelled",
        "message": "Verification cancelled successfully"
    }
