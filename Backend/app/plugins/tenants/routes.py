from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant, User, VerticalType, TenantBranding, SubscriptionPlan, LoyaltyProgram, Service
from app.plugins.auth.routes import require_admin, get_current_user
from app.services.tenant_settings import get_tenant_settings
from app.core.modules import VERTICAL_EXTRA_MODULES
from app.utils.request_origin import get_request_origin
from pydantic import BaseModel
from typing import List, Optional
import os, pathlib, shutil, io, hashlib
from PIL import Image
from app.core import jobs
from time import time
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

class TenantFeatures(BaseModel):
    plan_features: List[str]
    vertical_features: List[str]
    addon_features: List[str]
    all_features: List[str]

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
    onboarding_completed: bool
    features: TenantFeatures

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

def _calculate_tenant_features(tenant: Tenant, db: Session) -> dict:
    # 1. Get Plan Modules
    config = tenant.config or {}
    sub = config.get("subscription", {})
    plan_id = sub.get("plan_id")
    
    plan_modules = []
    if plan_id:
        plan = db.get(SubscriptionPlan, plan_id)
        if plan:
            plan_modules = plan.modules or []
    
    # Fallback to Starter if no plan assigned (matching subscription logic)
    if not plan_modules and not plan_id:
        starter = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Starter").first()
        if starter:
            plan_modules = starter.modules or []

    # 2. Vertical Extras
    vertical_extras = VERTICAL_EXTRA_MODULES.get(tenant.vertical_type, [])

    # 3. Overrides (Add-ons)
    overrides = sub.get("overrides", {})
    addon_features = [k for k, v in overrides.items() if v]

    # 4. Construct result
    return {
        "plan_features": plan_modules,
        "vertical_features": vertical_extras,
        "addon_features": addon_features,
        "all_features": list(set(plan_modules + vertical_extras + addon_features))
    }


def _build_tenant_out(tenant: Tenant, db: Session) -> TenantOut:
    """Helper to build a consistent TenantOut from a Tenant model."""
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
        onboarding_completed=bool(tenant.onboarding_completed),
        features=_calculate_tenant_features(tenant, db),
    )

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
    return _build_tenant_out(tenant, db)

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
    # Require tenant existence for branding upsert
    if not db.query(Tenant).filter_by(id=tenant_id).first():
        raise HTTPException(status_code=404, detail='Tenant not found')
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

@router.patch('/{tenant_id}/branding', response_model=BrandingOut)
def patch_branding(tenant_id: str, payload: BrandingUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Partial update for branding settings.

    Only fields provided are modified; unspecified values remain unchanged. Creates
    the branding row if it doesn't exist. Enforces tenant existence and audit trail.
    """
    if not db.query(Tenant).filter_by(id=tenant_id).first():
        raise HTTPException(status_code=404, detail='Tenant not found')
    b = db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
    created = False
    if not b:
        b = TenantBranding(tenant_id=tenant_id)
        db.add(b); created = True
    data = payload.dict(exclude_unset=True)
    for k,v in data.items():
        setattr(b, k, v)
    db.commit(); db.refresh(b)
    record('tenant.branding.create' if created else 'tenant.branding.patch', tenant_id=tenant_id, user_id=current.id, details={'fields': list(data.keys())})
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
MAGIC_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": 'image/png',
    b"\xff\xd8\xff": 'image/jpeg',  # JPEG start
    b"<svg": 'image/svg+xml',
    b"GIF87a": 'image/gif',  # not allowed but we detect to reject explicitly
    b"GIF89a": 'image/gif',
}

# Simple in-memory per-tenant upload counters (reset on process restart)
_UPLOAD_QUOTA = {}
UPLOAD_QUOTA_COUNT = 20  # max assets per tenant per process lifetime (simplistic)
UPLOAD_RATE_WINDOW = 60
UPLOAD_RATE_MAX = 10  # per-minute simple rate limit
_RATE_BUCKET = {}  # tenant_id -> list[timestamps]

def _branding_asset_dir(tenant_id: str) -> pathlib.Path:
    base = pathlib.Path(settings.static_dir or 'static') / 'branding' / tenant_id
    base.mkdir(parents=True, exist_ok=True)
    return base

def _list_branding_assets(tenant_id: str) -> list[dict]:
    d = _branding_asset_dir(tenant_id)
    assets = []
    if not d.exists():
        return assets
    for p in d.iterdir():
        if p.is_file():
            assets.append({
                'name': p.name,
                'size': p.stat().st_size,
                'url': f"/static/branding/{tenant_id}/{p.name}"
            })
    return sorted(assets, key=lambda x: x['name'])

@router.post('/{tenant_id}/branding/assets/{field}', response_model=BrandingAssetUploadOut)
def upload_branding_asset(tenant_id: str, field: str, file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if field not in ALLOWED_BRANDING_FIELDS:
        raise HTTPException(status_code=400, detail='Unsupported branding asset field')
    raw = file.file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='File too large')
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Unsupported content type')
    # Magic byte validation (best-effort)
    sample = raw[:16]
    detected = None
    for sig, mtype in MAGIC_SIGNATURES.items():
        if sample.startswith(sig):
            detected = mtype
            break
    if detected == 'image/gif':  # explicitly reject gifs for now
        raise HTTPException(status_code=400, detail='GIF not supported')
    if detected and detected != file.content_type and detected in ALLOWED_CONTENT_TYPES:
        # Adjust (eg: some browsers send image/svg+xml with xml declaration) accept; else mismatch
        file.content_type = detected
    elif detected is None and file.content_type != 'image/svg+xml':
        # Basic safeguard; allow svg textual without strict signature
        raise HTTPException(status_code=400, detail='Unrecognized image format')

    # Quota enforcement
    count = _UPLOAD_QUOTA.get(tenant_id, 0)
    if count >= UPLOAD_QUOTA_COUNT:
        raise HTTPException(status_code=429, detail='Upload quota exceeded')
    # Rate limiting (sliding window)
    now = time()
    bucket = _RATE_BUCKET.setdefault(tenant_id, [])
    bucket[:] = [t for t in bucket if now - t < UPLOAD_RATE_WINDOW]
    if len(bucket) >= UPLOAD_RATE_MAX:
        raise HTTPException(status_code=429, detail='Upload rate exceeded')
    bucket.append(now)
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
    def _process_variants(payload):  # executed in job queue
        try:
            img = Image.open(io.BytesIO(raw))
            for size in [64, 128, 256, 512]:
                try:
                    resized = img.copy()
                    resized.thumbnail((size, size))
                    variant_name = f"{base_name}-{size}{ext}"
                    variant_path = dest_dir / variant_name
                    resized.save(variant_path)
                except Exception:
                    continue
        except Exception:
            return {'ok': False}
        return {'ok': True}

    # For large files (>100KB) offload variant generation; else inline
    if file.content_type in {'image/png', 'image/jpeg'} and field in {'logo_light','logo_dark','app_icon'}:
        if len(raw) > 100 * 1024:
            try:
                jobs.register_job(f"branding_variants_{field}", _process_variants)
            except Exception:
                pass
            jobs.enqueue(f"branding_variants_{field}")
        else:
            _process_variants(None)
        # Populate variant URLs regardless (may exist shortly after)
    for size in [64,128,256,512]:
            variant_name = f"{base_name}-{size}{ext}"
            variants[str(size)] = f"/static/branding/{tenant_id}/{variant_name}"

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
    _UPLOAD_QUOTA[tenant_id] = count + 1
    record('tenant.branding.asset_upload', tenant_id=tenant_id, user_id=current.id, details={'field': field, 'size': len(raw), 'created': created, 'variants': list(variants.keys())})
    flush(db)
    return BrandingAssetUploadOut(field=field, url=rel_url, size=len(raw), content_type=file.content_type, variants=variants or None, etag=etag)

@router.get('/{tenant_id}/branding/assets')
def list_branding_assets(tenant_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return {
        'tenant_id': tenant_id,
        'assets': _list_branding_assets(tenant_id)
    }

@router.get("", response_model=List[TenantOut])
def list_tenants(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).all()
    return [_build_tenant_out(t, db) for t in tenants]

@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _build_tenant_out(tenant, db)

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
    return _build_tenant_out(tenant, db)

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
    return _build_tenant_out(tenant, db)

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
    return _build_tenant_out(tenant, db)

# --- Onboarding Wizard (bulk update) ────────────────────────────────────────

class OnboardingBrandingPayload(BaseModel):
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    tagline: Optional[str] = None

class OnboardingLoyaltyPayload(BaseModel):
    points_per_rand: Optional[float] = None
    visit_milestone: Optional[int] = None
    reward_description: Optional[str] = None

class OnboardingServiceItem(BaseModel):
    name: str
    price_cents: int

class OnboardingTeamInvite(BaseModel):
    email: EmailStr

class OnboardingPayload(BaseModel):
    """Composite payload for the onboarding wizard."""
    # Step 1 — Business Info
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    # Step 2 — Branding
    branding: Optional[OnboardingBrandingPayload] = None
    # Step 3 — Verticals
    verticals: Optional[List[str]] = None
    # Step 4 — Loyalty Program
    loyalty: Optional[OnboardingLoyaltyPayload] = None
    # Step 5 — Services / Products
    services: Optional[List[OnboardingServiceItem]] = None
    # Step 6 — Team Invites
    team_invites: Optional[List[OnboardingTeamInvite]] = None


@router.patch("/{tenant_id}/onboarding")
def complete_onboarding(
    tenant_id: str,
    payload: OnboardingPayload,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Bulk-update tenant settings from the onboarding wizard.

    Accepts business info, branding, selected verticals, loyalty config,
    initial services, and team invite emails in one call. Marks the tenant
    as onboarding-complete on success.
    """
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Step 1 — Business Info
    if payload.business_name is not None:
        tenant.name = payload.business_name
    if payload.business_type is not None:
        # Map to vertical_type if it's a valid VerticalType
        try:
            tenant.vertical_type = VerticalType(payload.business_type).value
        except ValueError:
            pass  # Keep existing vertical_type if not a valid enum
    if payload.phone or payload.email or payload.address:
        config = dict(tenant.config or {})
        if payload.phone:
            config["business_phone"] = payload.phone
        if payload.email:
            config["business_email"] = payload.email
        if payload.address:
            config["business_address"] = payload.address
        tenant.config = config

    # Step 2 — Branding
    if payload.branding:
        branding = db.query(TenantBranding).filter_by(tenant_id=tenant_id).first()
        if not branding:
            branding = TenantBranding(tenant_id=tenant_id)
            db.add(branding)
        b = payload.branding
        if b.logo_url is not None:
            branding.logo_light_url = b.logo_url
            tenant.logo_url = b.logo_url
        if b.primary_color is not None:
            branding.primary_color = b.primary_color
            tenant.theme_color = b.primary_color
        if b.secondary_color is not None:
            branding.secondary_color = b.secondary_color
        if b.tagline is not None:
            extra = dict(branding.extra or {})
            extra["tagline"] = b.tagline
            branding.extra = extra

    # Step 3 — Verticals
    if payload.verticals:
        tenant.vertical_features = {v: True for v in payload.verticals}
        # Set the primary vertical to the first in the list
        if payload.verticals:
            try:
                tenant.vertical_type = VerticalType(payload.verticals[0]).value
            except ValueError:
                pass

    # Step 4 — Loyalty Program
    if payload.loyalty:
        lp = db.query(LoyaltyProgram).filter_by(tenant_id=tenant_id).first()
        if not lp:
            lp = LoyaltyProgram(tenant_id=tenant_id)
            db.add(lp)
        loy = payload.loyalty
        if loy.points_per_rand is not None:
            lp.accrual_ratio = loy.points_per_rand
        if loy.reward_description is not None:
            lp.name = loy.reward_description
        # Store visit_milestone in tenant config
        if loy.visit_milestone is not None:
            config = dict(tenant.config or {})
            config["visit_milestone"] = loy.visit_milestone
            tenant.config = config

    # Step 5 — Services / Products
    if payload.services:
        for svc in payload.services:
            service = Service(
                category="general",
                name=svc.name,
                base_price=svc.price_cents,
                loyalty_eligible=True,
            )
            db.add(service)

    # Step 6 — Team Invites (store emails; actual invite sending deferred)
    team_emails = []
    if payload.team_invites:
        for invite in payload.team_invites:
            team_emails.append(invite.email)

    # Mark onboarding complete
    tenant.onboarding_completed = True
    config = dict(tenant.config or {})
    onboarding = config.get("onboarding", {})
    onboarding["completed"] = True
    onboarding["completed_at"] = datetime.utcnow().isoformat()
    config["onboarding"] = onboarding
    tenant.config = config

    db.commit()
    db.refresh(tenant)

    record(
        "tenant.onboarding.complete",
        tenant_id=tenant.id,
        user_id=current.id,
        details={"team_invites": team_emails},
    )
    flush(db)

    return {
        "success": True,
        "message": "Onboarding completed successfully",
        "tenant": _build_tenant_out(tenant, db),
        "team_invites": team_emails,
    }

 
# --- Invite a client-admin to a newly provisioned tenant
class TenantInvite(BaseModel):
    email: EmailStr

class InviteOut(BaseModel):
    token: str
    expires_at: datetime

@router.post("/{tenant_id}/invite", response_model=InviteOut)
def invite_tenant_admin(tenant_id: str, payload: TenantInvite, request: Request, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Generate a one-time invite token and email it to the client-admin"""
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    token = uuid4().hex
    tenant_settings = get_tenant_settings(tenant)
    auth_settings = tenant_settings.auth
    email_settings = tenant_settings.email
    origin = get_request_origin(request)

    expires = datetime.utcnow() + timedelta(seconds=auth_settings.reset_token_expire_seconds)
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
    if email_settings.provider == "sendgrid" and email_settings.sendgrid_api_key:
        client = SendGridAPIClient(email_settings.sendgrid_api_key)
        link = tenant_settings.build_frontend_url(f"onboarding/invite?token={token}", origin=origin)
        mail = Mail(
            from_email=email_settings.from_email,
            to_emails=payload.email,
            subject="Your onboarding invite",
            html_content=f"<p>Please <a href='{link}'>click here</a> to set up your admin account.</p>",
        )
        if email_settings.from_name:
            mail.from_email.name = email_settings.from_name
        try:
            client.send(mail)
        except Exception:
            pass
    # Return the invite token and expiry
    record('tenant.invite_admin', tenant_id=tenant_id, user_id=current.id, details={'email': payload.email})
    flush(db)
    return InviteOut(token=invite.token, expires_at=invite.expires_at)
