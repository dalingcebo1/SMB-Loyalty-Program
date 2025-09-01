from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant, User, VerticalType, TenantBranding
from app.plugins.auth.routes import require_admin, get_current_user
from pydantic import BaseModel
from typing import List, Optional
import os, pathlib, shutil, io, hashlib
from PIL import Image
from uuid import uuid4
from datetime import datetime, timedelta
from pydantic import EmailStr
from config import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from app.models import InviteToken
from app.core.audit import record, flush

router = APIRouter(prefix="", tags=["tenants"], dependencies=[Depends(require_admin)])

# Schemas
class TenantCreate(BaseModel):
    id: str
    name: str
    loyalty_type: str
    vertical_type: VerticalType = VerticalType.carwash
    primary_domain: Optional[str] = None
    subdomain: Optional[str] = None
    logo_url: Optional[str] = None
    theme_color: Optional[str] = None
    config: Optional[dict] = None

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    loyalty_type: Optional[str] = None
    vertical_type: Optional[VerticalType] = None
    primary_domain: Optional[str] = None
    subdomain: Optional[str] = None
    logo_url: Optional[str] = None
    theme_color: Optional[str] = None
    config: Optional[dict] = None

class TenantOut(BaseModel):
    id: str
    name: str
    loyalty_type: str
    vertical_type: str
    primary_domain: Optional[str]
    subdomain: Optional[str]
    logo_url: Optional[str]
    theme_color: Optional[str]
    admin_ids: List[int]
    config: dict

class AdminAssign(BaseModel):
    user_id: int

class BrandingOut(BaseModel):
    public_name: Optional[str]
    short_name: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    accent_color: Optional[str]
    logo_light_url: Optional[str]
    logo_dark_url: Optional[str]
    favicon_url: Optional[str]
    app_icon_url: Optional[str]
    support_email: Optional[str]
    support_phone: Optional[str]
    extra: dict

class BrandingUpdate(BaseModel):
    public_name: Optional[str] = None
    short_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    logo_light_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    app_icon_url: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    extra: Optional[dict] = None

class BrandingAssetUploadOut(BaseModel):
    field: str
    url: str
    size: int
    content_type: Optional[str]
    variants: Optional[dict] = None  # size label -> url
    etag: Optional[str] = None

# CRUD Endpoints
@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if db.query(Tenant).filter_by(id=payload.id).first():
        raise HTTPException(status_code=400, detail="Tenant already exists")
    tenant = Tenant(
        id=payload.id,
        name=payload.name,
        loyalty_type=payload.loyalty_type,
        vertical_type=payload.vertical_type.value,
        primary_domain=payload.primary_domain,
        subdomain=payload.subdomain,
        logo_url=payload.logo_url,
        theme_color=payload.theme_color,
        config=payload.config or {},
        created_at=datetime.utcnow(),
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    record('tenant.create', tenant_id=tenant.id, user_id=current.id, details={'name': tenant.name})
    flush(db)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        vertical_type=tenant.vertical_type,
        primary_domain=tenant.primary_domain,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
        config=tenant.config or {},
    )

# ─── Branding Endpoints ───────────────────────────────────────────────────
@router.get('/{tenant_id}/branding', response_model=BrandingOut)
def get_branding(tenant_id: str, db: Session = Depends(get_db)):
    b = db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
    if not b:
        return BrandingOut(public_name=None, short_name=None, primary_color=None, secondary_color=None, accent_color=None,
                           logo_light_url=None, logo_dark_url=None, favicon_url=None, app_icon_url=None,
                           support_email=None, support_phone=None, extra={})
    return BrandingOut(
        public_name=b.public_name,
        short_name=b.short_name,
        primary_color=b.primary_color,
        secondary_color=b.secondary_color,
        accent_color=b.accent_color,
        logo_light_url=b.logo_light_url,
        logo_dark_url=b.logo_dark_url,
        favicon_url=b.favicon_url,
        app_icon_url=b.app_icon_url,
        support_email=b.support_email,
        support_phone=b.support_phone,
        extra=b.extra or {},
    )

@router.put('/{tenant_id}/branding', response_model=BrandingOut)
def update_branding(tenant_id: str, payload: BrandingUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    b = db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
    created = False
    if not b:
        b = TenantBranding(tenant_id=tenant_id)
        db.add(b)
        created = True
    data = payload.dict(exclude_unset=True)
    for k,v in data.items():
        setattr(b, k, v)
    db.commit(); db.refresh(b)
    record('tenant.branding.create' if created else 'tenant.branding.update', tenant_id=tenant_id, user_id=current.id, details={'fields': list(data.keys())})
    flush(db)
    return BrandingOut(
        public_name=b.public_name,
        short_name=b.short_name,
        primary_color=b.primary_color,
        secondary_color=b.secondary_color,
        accent_color=b.accent_color,
        logo_light_url=b.logo_light_url,
        logo_dark_url=b.logo_dark_url,
        favicon_url=b.favicon_url,
        app_icon_url=b.app_icon_url,
        support_email=b.support_email,
        support_phone=b.support_phone,
        extra=b.extra or {},
    )


# ─── Asset Upload (Phase 3) ────────────────────────────────────────────────
ALLOWED_BRANDING_FIELDS = {
    'logo_light': 'logo_light_url',
    'logo_dark': 'logo_dark_url',
    'favicon': 'favicon_url',
    'app_icon': 'app_icon_url',
}

MAX_UPLOAD_BYTES = 512 * 1024  # 512 KB per asset (initial conservative cap)
ALLOWED_CONTENT_TYPES = {'image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon'}

def _branding_asset_dir(tenant_id: str) -> pathlib.Path:
    base = pathlib.Path(settings.static_dir or 'static') / 'branding' / tenant_id
    base.mkdir(parents=True, exist_ok=True)
    return base

@router.post('/{tenant_id}/branding/assets/{field}', response_model=BrandingAssetUploadOut)
def upload_branding_asset(tenant_id: str, field: str, file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if field not in ALLOWED_BRANDING_FIELDS:
        raise HTTPException(status_code=400, detail='Unsupported branding asset field')
    raw = file.file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='File too large')
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Unsupported content type')
    # Basic extension mapping
    ext = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/svg+xml': '.svg',
        'image/x-icon': '.ico'
    }.get(file.content_type, '')
    # Deterministic filename for cache busting using content hash
    digest = hashlib.sha256(raw).hexdigest()[:16]
    dest_dir = _branding_asset_dir(tenant_id)
    base_name = f"{field}-{digest}"
    primary_fname = f"{base_name}{ext}"
    dest_path = dest_dir / primary_fname
    with open(dest_path, 'wb') as out:
        out.write(raw)

    variants = {}
    # Generate responsive sizes for logos (png/jpeg) excluding svg/ico
    if file.content_type in {'image/png', 'image/jpeg'} and field in {'logo_light','logo_dark','app_icon'}:
        try:
            img = Image.open(io.BytesIO(raw))
            for size in [64, 128, 256]:
                resized = img.copy()
                resized.thumbnail((size, size))
                variant_name = f"{base_name}-{size}{ext}"
                variant_path = dest_dir / variant_name
                resized.save(variant_path)
                variants[str(size)] = f"/static/branding/{tenant_id}/{variant_name}"
        except Exception:
            pass  # non-fatal

    # Favicon conversions (derive .ico if uploading png larger than 32x32 and field favicon or app_icon)
    if field in {'favicon','app_icon'} and file.content_type in {'image/png','image/jpeg'}:
        try:
            img = Image.open(io.BytesIO(raw))
            favicon_sizes = [(16,16),(32,32),(48,48)]
            ico_name = f"{base_name}.ico"
            ico_path = dest_dir / ico_name
            img.save(ico_path, sizes=favicon_sizes)
            variants['ico'] = f"/static/branding/{tenant_id}/{ico_name}"
        except Exception:
            pass

    rel_url = f"/static/branding/{tenant_id}/{primary_fname}"
    etag = digest
    # Upsert branding record + set appropriate URL field
    b = db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
    created = False
    if not b:
        b = TenantBranding(tenant_id=tenant_id)
        db.add(b)
        created = True
    setattr(b, ALLOWED_BRANDING_FIELDS[field], rel_url)
    db.commit(); db.refresh(b)
    record('tenant.branding.asset_upload', tenant_id=tenant_id, user_id=current.id, details={'field': field, 'size': len(raw), 'created': created, 'variants': list(variants.keys())})
    flush(db)
    return BrandingAssetUploadOut(field=field, url=rel_url, size=len(raw), content_type=file.content_type, variants=variants or None, etag=etag)

@router.get("", response_model=List[TenantOut])
def list_tenants(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).all()
    return [TenantOut(
        id=t.id,
        name=t.name,
        loyalty_type=t.loyalty_type,
        vertical_type=t.vertical_type,
        primary_domain=t.primary_domain,
        subdomain=t.subdomain,
        logo_url=t.logo_url,
        theme_color=t.theme_color,
        admin_ids=[u.id for u in t.admins],
        config=t.config or {},
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
        vertical_type=tenant.vertical_type,
        primary_domain=tenant.primary_domain,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
        config=tenant.config or {},
    )

@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(tenant_id: str, payload: TenantUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    data = payload.dict(exclude_unset=True)
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        # Create tenant if it doesn't exist
        tenant = Tenant(
            id=tenant_id,
            name=data.get('name', tenant_id),
            loyalty_type=data.get('loyalty_type', 'standard'),
            vertical_type=data.get('vertical_type', VerticalType.carwash).value,
            primary_domain=data.get('primary_domain'),
            subdomain=data.get('subdomain'),
            logo_url=data.get('logo_url'),
            theme_color=data.get('theme_color'),
            config=data.get('config') or {},
            created_at=datetime.utcnow()
        )
        db.add(tenant)
    else:
        # Update existing tenant fields
        for key, val in data.items():
            setattr(tenant, key, val)
    db.commit()
    db.refresh(tenant)
    record('tenant.update', tenant_id=tenant.id, user_id=current.id, details={'fields': list(data.keys())})
    flush(db)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        vertical_type=tenant.vertical_type,
        primary_domain=tenant.primary_domain,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
        config=tenant.config or {},
    )

@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Idempotent delete: remove if exists, otherwise no-op
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if tenant:
        db.delete(tenant)
        db.commit()
    record('tenant.delete', tenant_id=tenant_id, user_id=current.id)
    flush(db)
    return

# Admin assignment
@router.post("/{tenant_id}/admins", response_model=TenantOut)
def assign_admin(tenant_id: str, payload: AdminAssign, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
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
    record('tenant.assign_admin', tenant_id=tenant.id, user_id=current.id, details={'assigned_user_id': payload.user_id})
    flush(db)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        vertical_type=tenant.vertical_type,
        primary_domain=tenant.primary_domain,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
        config=tenant.config or {},
    )

@router.delete("/{tenant_id}/admins/{user_id}", response_model=TenantOut)
def remove_admin(tenant_id: str, user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    user = db.query(User).filter_by(id=user_id).first()
    if not tenant or not user:
        raise HTTPException(status_code=404, detail="Tenant or user not found")
    if user not in tenant.admins:
        raise HTTPException(status_code=400, detail="User is not an admin for this tenant")
    tenant.admins.remove(user)
    db.commit()
    db.refresh(tenant)
    record('tenant.remove_admin', tenant_id=tenant.id, user_id=current.id, details={'removed_user_id': user_id})
    flush(db)
    return TenantOut(
        id=tenant.id,
        name=tenant.name,
        loyalty_type=tenant.loyalty_type,
        vertical_type=tenant.vertical_type,
        primary_domain=tenant.primary_domain,
        subdomain=tenant.subdomain,
        logo_url=tenant.logo_url,
        theme_color=tenant.theme_color,
        admin_ids=[u.id for u in tenant.admins],
        config=tenant.config or {},
    )
 
# --- Invite a client-admin to a newly provisioned tenant
class TenantInvite(BaseModel):
    email: EmailStr

class InviteOut(BaseModel):
    token: str
    expires_at: datetime

@router.post("/{tenant_id}/invite", response_model=InviteOut)
def invite_tenant_admin(tenant_id: str, payload: TenantInvite, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
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
    record('tenant.invite_admin', tenant_id=tenant_id, user_id=current.id, details={'email': payload.email})
    flush(db)
    return InviteOut(token=invite.token, expires_at=invite.expires_at)
