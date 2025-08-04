from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant, User
from app.plugins.auth.routes import require_admin
from pydantic import BaseModel
from typing import List, Optional
from uuid import uuid4
from datetime import datetime, timedelta
from pydantic import EmailStr
from config import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from app.models import InviteToken

router = APIRouter(prefix="", tags=["tenants"], dependencies=[Depends(require_admin)])

# Schemas
class TenantCreate(BaseModel):
    id: str
    name: str
    loyalty_type: str
    subdomain: Optional[str] = None
    logo_url: Optional[str] = None
    theme_color: Optional[str] = None

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    loyalty_type: Optional[str] = None
    subdomain: Optional[str] = None
    logo_url: Optional[str] = None
    theme_color: Optional[str] = None

class TenantOut(BaseModel):
    id: str
    name: str
    loyalty_type: str
    subdomain: Optional[str]
    logo_url: Optional[str]
    theme_color: Optional[str]
    admin_ids: List[int]

class AdminAssign(BaseModel):
    user_id: int

# CRUD Endpoints
@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    if db.query(Tenant).filter_by(id=payload.id).first():
        raise HTTPException(status_code=400, detail="Tenant already exists")
    tenant = Tenant(
        id=payload.id,
        name=payload.name,
        loyalty_type=payload.loyalty_type,
        subdomain=payload.subdomain,
        logo_url=payload.logo_url,
        theme_color=payload.theme_color,
        created_at=datetime.utcnow(),
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
    )

@router.get("", response_model=List[TenantOut])
def list_tenants(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).all()
    return [TenantOut(
        id=t.id,
        name=t.name,
        loyalty_type=t.loyalty_type,
        subdomain=t.subdomain,
        logo_url=t.logo_url,
        theme_color=t.theme_color,
        admin_ids=[u.id for u in t.admins]
    ) for t in tenants]

@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
    )

@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(tenant_id: str, payload: TenantUpdate, db: Session = Depends(get_db)):
    data = payload.dict(exclude_unset=True)
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        # Create tenant if it doesn't exist
        tenant = Tenant(
            id=tenant_id,
            name=data.get('name', tenant_id),
            loyalty_type=data.get('loyalty_type', 'standard'),
            subdomain=data.get('subdomain'),
            logo_url=data.get('logo_url'),
            theme_color=data.get('theme_color'),
            created_at=datetime.utcnow()
        )
        db.add(tenant)
    else:
        # Update existing tenant fields
        for key, val in data.items():
            setattr(tenant, key, val)
    db.commit()
    db.refresh(tenant)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
    )

@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db)):
    # Idempotent delete: remove if exists, otherwise no-op
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if tenant:
        db.delete(tenant)
        db.commit()
    return

# Admin assignment
@router.post("/{tenant_id}/admins", response_model=TenantOut)
def assign_admin(tenant_id: str, payload: AdminAssign, db: Session = Depends(get_db)):
    # create tenant if not exists
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        tenant = Tenant(
            id=tenant_id,
            name=tenant_id,
            loyalty_type="standard",
            created_at=datetime.utcnow()
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    # find user
    user = db.query(User).filter_by(id=payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user in tenant.admins:
        raise HTTPException(status_code=400, detail="User is already an admin for this tenant")
    tenant.admins.append(user)
    db.commit()
    db.refresh(tenant)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
    )

@router.delete("/{tenant_id}/admins/{user_id}", response_model=TenantOut)
def remove_admin(tenant_id: str, user_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    user = db.query(User).filter_by(id=user_id).first()
    if not tenant or not user:
        raise HTTPException(status_code=404, detail="Tenant or user not found")
    if user not in tenant.admins:
        raise HTTPException(status_code=400, detail="User is not an admin for this tenant")
    tenant.admins.remove(user)
    db.commit()
    db.refresh(tenant)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
    )
 
# --- Invite a client-admin to a newly provisioned tenant
class TenantInvite(BaseModel):
    email: EmailStr

class InviteOut(BaseModel):
    token: str
    expires_at: datetime

@router.post("/{tenant_id}/invite", response_model=InviteOut)
def invite_tenant_admin(tenant_id: str, payload: TenantInvite, db: Session = Depends(get_db)):
    """Generate a one-time invite token and email it to the client-admin"""
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    token = uuid4().hex
    expires = datetime.utcnow() + timedelta(seconds=settings.reset_token_expire_seconds)
    invite = InviteToken(
        token=token,
        tenant_id=tenant_id,
        email=payload.email,
        created_at=datetime.utcnow(),
        expires_at=expires,
    )
    db.add(invite)
    db.commit()
    # send invitation email
    # Send invitation email if configured
    if settings.sendgrid_api_key:
        client = SendGridAPIClient(settings.sendgrid_api_key)
        link = f"{settings.frontend_url}/onboarding/invite?token={token}"
        mail = Mail(
            from_email=settings.reset_email_from,
            to_emails=payload.email,
            subject="Your onboarding invite",
            html_content=f"<p>Please <a href='{link}'>click here</a> to set up your admin account.</p>",
        )
        try:
            client.send(mail)
        except Exception:
            pass
    # Return the invite token and expiry
    return InviteOut(token=invite.token, expires_at=invite.expires_at)
