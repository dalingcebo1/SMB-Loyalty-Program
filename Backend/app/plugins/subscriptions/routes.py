from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from sqlalchemy import func

from app.core.database import get_db
from app.models import Tenant, Order, Redemption, Payment, SubscriptionPlan
from app.plugins.auth.routes import require_admin

router = APIRouter(prefix="", tags=["subscriptions"], dependencies=[Depends(require_admin)])


# Pydantic models
class PlanOut(BaseModel):
    id: int
    name: str
    price_cents: int
    billing_period: str
    modules: List[str]
    active: bool = True

class PlanIn(BaseModel):
    name: str
    price_cents: int
    billing_period: str
    module_keys: List[str] = []
    description: Optional[str] = None
    active: Optional[bool] = True

class TenantAssignPlan(BaseModel):
    plan_id: int

class OverridePayload(BaseModel):
    module_key: str
    enabled: bool

class BillingProfile(BaseModel):
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    vat_number: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None


def _get_tenant(db: Session, tenant_id: str) -> Tenant:
    t = db.query(Tenant).filter_by(id=tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if t.config is None:
        t.config = {}
    return t


# Module registry and vertical-aware extras
MODULE_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Core Operations
    "core": {"name": "Core", "category": "Core Operations", "description": "Tenant, auth, settings"},
    "team": {"name": "Team & Roles", "category": "Core Operations"},
    "orders": {"name": "Orders / POS", "category": "Core Operations"},
    "inventory": {"name": "Inventory", "category": "Core Operations", "description": "Catalog & stock", "vertical_hint": ["flowershop", "dispensary"]},
    "bookings": {"name": "Bookings", "category": "Core Operations", "description": "Scheduling / courts", "vertical_hint": ["padel", "beauty"]},
    # Customer Growth
    "loyalty": {"name": "Loyalty", "category": "Customer Growth"},
    "messaging": {"name": "Messaging", "category": "Customer Growth", "description": "Email/SMS/WhatsApp"},
    "referrals": {"name": "Referrals", "category": "Customer Growth"},
    "automation": {"name": "Automations", "category": "Customer Growth"},
    "campaigns": {"name": "Campaigns", "category": "Customer Growth"},
    # Intelligence & Compliance
    "analytics": {"name": "Analytics", "category": "Intelligence"},
    "data_export": {"name": "Data Export", "category": "Intelligence"},
    "audits": {"name": "Audit Logs", "category": "Intelligence"},
    # Platform
    "integrations": {"name": "Integrations", "category": "Platform"},
    "api": {"name": "Public API & Webhooks", "category": "Platform"},
    "branding_plus": {"name": "Branding+", "category": "Platform"},
    "priority_support": {"name": "Priority Support", "category": "Platform"},
    "billing": {"name": "Billing", "category": "Platform"},
}

VERTICAL_EXTRA_MODULES: Dict[str, List[str]] = {
    "padel": ["bookings"],
    "beauty": ["bookings"],
    "flowershop": ["inventory"],
    "dispensary": ["inventory"],
    "carwash": [],
}

# Seed in-memory plan catalog (could be stored in DB later)
DEFAULT_PLANS: Dict[int, Dict[str, Any]] = {
    1: {
        "id": 1,
        "name": "Starter",
    "price_cents": 150000,  # R1500 / month
        "billing_period": "monthly",
    "modules": ["core", "team", "orders", "loyalty", "analytics", "integrations"],
        # Reasonable starter caps; adjust to your pricing later
        "limits": {"core": 200, "loyalty": 100, "analytics": 200, "inventory": 0, "billing": 200},
    },
    2: {
        "id": 2,
        "name": "Advanced",
    "price_cents": 250000,  # R2500 / month
        "billing_period": "monthly",
    "modules": ["core", "team", "orders", "loyalty", "analytics", "integrations", "messaging", "referrals", "automation", "campaigns"],
        "limits": {"core": 2000, "loyalty": 500, "analytics": 5000, "inventory": 1000, "billing": 2000},
    },
    3: {
        "id": 3,
        "name": "Premium",
    "price_cents": 500000,  # R5000 / month
        "billing_period": "monthly",
    "modules": ["core", "team", "orders", "loyalty", "analytics", "integrations", "messaging", "referrals", "automation", "campaigns", "api", "data_export", "branding_plus", "priority_support"],
        "limits": {"core": None, "loyalty": None, "analytics": None, "inventory": None, "billing": None},
    },
}


def _ensure_subscription_struct(t: Tenant):
    cfg = t.config or {}
    sub = cfg.get("subscription") or {}
    # structure: { plan_id, status, overrides: {k:bool}, history: [..], started_at }
    if "status" not in sub:
        sub["status"] = "active"
    if "overrides" not in sub:
        sub["overrides"] = {}
    if "history" not in sub:
        sub["history"] = []
    if "started_at" not in sub:
        sub["started_at"] = datetime.utcnow().isoformat()
    cfg["subscription"] = sub
    t.config = cfg
    return sub


def _record_history(sub: dict, action: str, details: Optional[str] = None, actor: Optional[str] = None):
    sub.setdefault("history", []).insert(0, {
        "ts": datetime.utcnow().isoformat(),
        "action": action,
        "details": details,
        "actor": actor or "system",
    })


def _seed_default_plans_if_empty(db: Session):
    if db.query(SubscriptionPlan).count() > 0:
        return
    # Seed three basic plans aligned with defaults above
    seed = [
        SubscriptionPlan(name="Starter", price_cents=150000, billing_period="monthly", modules=["core","team","orders","loyalty","analytics","integrations"], active=True),
        SubscriptionPlan(name="Advanced", price_cents=250000, billing_period="monthly", modules=["core","team","orders","loyalty","analytics","integrations","messaging","referrals","automation","campaigns"], active=True),
        SubscriptionPlan(name="Premium", price_cents=500000, billing_period="monthly", modules=["core","team","orders","loyalty","analytics","integrations","messaging","referrals","automation","campaigns","api","data_export","branding_plus","priority_support"], active=True),
    ]
    db.add_all(seed)
    db.commit()


@router.get("/plans", response_model=List[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    _seed_default_plans_if_empty(db)
    rows = db.query(SubscriptionPlan).filter(SubscriptionPlan.active == True).order_by(SubscriptionPlan.price_cents).all()
    return [PlanOut(id=r.id, name=r.name, price_cents=r.price_cents, billing_period=r.billing_period, modules=r.modules, active=r.active) for r in rows]


@router.get("/plans/all", response_model=List[PlanOut])
def list_all_plans(db: Session = Depends(get_db)):
    """List all plans including archived."""
    _seed_default_plans_if_empty(db)
    rows = db.query(SubscriptionPlan).order_by(SubscriptionPlan.active.desc(), SubscriptionPlan.price_cents).all()
    return [PlanOut(id=r.id, name=r.name, price_cents=r.price_cents, billing_period=r.billing_period, modules=r.modules, active=r.active) for r in rows]


@router.post("/plans", response_model=PlanOut)
def create_plan(payload: PlanIn, db: Session = Depends(get_db)):
    _seed_default_plans_if_empty(db)
    exists = db.query(SubscriptionPlan).filter(SubscriptionPlan.name.ilike(payload.name)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Plan with this name already exists")
    r = SubscriptionPlan(
        name=payload.name,
        price_cents=payload.price_cents,
        billing_period=payload.billing_period,
        modules=payload.module_keys or [],
        description=payload.description,
        active=payload.active if payload.active is not None else True,
    )
    db.add(r); db.commit(); db.refresh(r)
    return PlanOut(id=r.id, name=r.name, price_cents=r.price_cents, billing_period=r.billing_period, modules=r.modules, active=r.active)


@router.put("/plans/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: int, payload: PlanIn, db: Session = Depends(get_db)):
    r = db.query(SubscriptionPlan).get(plan_id)
    if not r:
        raise HTTPException(status_code=404, detail="Plan not found")
    r.name = payload.name
    r.price_cents = payload.price_cents
    r.billing_period = payload.billing_period
    r.modules = payload.module_keys or []
    r.description = payload.description
    if payload.active is not None:
        r.active = payload.active
    db.add(r); db.commit(); db.refresh(r)
    return PlanOut(id=r.id, name=r.name, price_cents=r.price_cents, billing_period=r.billing_period, modules=r.modules, active=r.active)


@router.post("/plans/{plan_id}/archive")
def archive_plan(plan_id: int, db: Session = Depends(get_db)):
    r = db.query(SubscriptionPlan).get(plan_id)
    if not r:
        raise HTTPException(status_code=404, detail="Plan not found")
    r.active = False
    db.add(r); db.commit()
    return {"ok": True}


@router.post("/plans/{plan_id}/restore")
def restore_plan(plan_id: int, db: Session = Depends(get_db)):
    r = db.query(SubscriptionPlan).get(plan_id)
    if not r:
        raise HTTPException(status_code=404, detail="Plan not found")
    r.active = True
    db.add(r); db.commit()
    return {"ok": True}


@router.get("/tenants/{tenant_id}")
def get_tenant_subscription(tenant_id: str, db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id)
    sub = _ensure_subscription_struct(t)
    # Pick plan from DB if available; fallback to defaults by index name
    plan_id = sub.get("plan_id")
    plan_row = db.query(SubscriptionPlan).get(plan_id) if plan_id else None
    if not plan_row:
        _seed_default_plans_if_empty(db)
        plan_row = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Starter").first()
    plan = {
        "id": plan_row.id,
        "name": plan_row.name,
        "price_cents": plan_row.price_cents,
        "billing_period": plan_row.billing_period,
        "modules": plan_row.modules,
    }
    # Active modules come from plan + vertical-aware extras + enabled overrides
    vertical_extras = VERTICAL_EXTRA_MODULES.get((t.vertical_type or "") if hasattr(t, "vertical_type") else "", [])
    active_modules = list({
        * (plan.get("modules", []) or []),
        * (vertical_extras or []),
        * [k for k, v in (sub.get("overrides", {}) or {}).items() if v],
    })
    return {
        "plan": {
            "id": plan["id"],
            "name": plan["name"],
            "price_cents": plan["price_cents"],
            "billing_period": plan["billing_period"],
        },
        "active_modules": active_modules,
        "status": sub.get("status", "active"),
    }


@router.post("/tenants/{tenant_id}/assign-plan")
def assign_plan(tenant_id: str, payload: TenantAssignPlan, db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id)
    sub = _ensure_subscription_struct(t)
    plan_row = db.query(SubscriptionPlan).get(payload.plan_id)
    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan_row.active:
        raise HTTPException(status_code=400, detail="Cannot assign an archived plan")
    old = sub.get("plan_id")
    sub["plan_id"] = payload.plan_id
    # Persist module limits from selected plan for quick lookup
    # Map limits from legacy DEFAULT_PLANS by plan name when present; otherwise open caps
    # This keeps usage UI functional without introducing a new limits table.
    name_key = (plan_row.name or "").strip()
    legacy = next((v for v in DEFAULT_PLANS.values() if v.get("name") == name_key), None)
    sub["module_limits"] = (legacy.get("limits") if legacy else {k: None for k in (plan_row.modules or [])})
    _record_history(sub, "plan.change", details=f"{old or 'none'} -> {payload.plan_id}")
    db.add(t); db.commit()
    return {"ok": True}


@router.get("/modules")
def list_modules():
    # Serve the module registry with metadata so the UI can group and describe
    def to_out(k: str, meta: Dict[str, Any]):
        return {
            "key": k,
            "name": meta.get("name") or k.replace('_', ' ').title(),
            "category": meta.get("category"),
            "description": meta.get("description"),
            # Treat certain items as add-ons without affecting plan inclusion
            "is_addon": k in {"branding_plus", "priority_support"},
        }

    # Keep a stable, grouped order: by category then name
    items = [to_out(k, v) for k, v in MODULE_REGISTRY.items()]
    items.sort(key=lambda i: ((i.get("category") or "zzz"), i.get("name") or i["key"]))
    return items


@router.get("/tenants/{tenant_id}/overrides")
def get_overrides(tenant_id: str, db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id)
    sub = _ensure_subscription_struct(t)
    return {"overrides": sub.get("overrides", {})}


@router.post("/tenants/{tenant_id}/override")
def set_override(tenant_id: str, payload: OverridePayload, db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id)
    sub = _ensure_subscription_struct(t)
    sub.setdefault("overrides", {})[payload.module_key] = payload.enabled
    _record_history(sub, "module.override", details=f"{payload.module_key} -> {payload.enabled}")
    db.add(t); db.commit()
    return {"ok": True, "overrides": sub["overrides"]}


@router.get("/usage")
def get_usage(
    window: str = "30d",
    tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"),
    db: Session = Depends(get_db),
):
    """Compute module usage from real data.

    - core: number of orders created in window
    - loyalty: number of redemptions created/redeemed in window
    - billing: number of successful payments in window
    - analytics: number of distinct active users in window (via orders)
    - inventory: placeholder (0) unless you later add inventory events
    """
    days = 30 if window.endswith("30d") else 7
    start = datetime.utcnow() - timedelta(days=days)
    tid = tenant_id or "default"

    # Fetch limits from current plan assignment
    t = _get_tenant(db, tid)
    sub = _ensure_subscription_struct(t)
    plan = DEFAULT_PLANS.get(sub.get("plan_id") or 1) or DEFAULT_PLANS[1]
    limits = (sub.get("module_limits") or plan.get("limits") or {})

    # Orders
    orders_q = db.query(func.count(Order.id)).filter(Order.created_at >= start)
    orders_q = orders_q.filter((Order.tenant_id == tid) | (Order.tenant_id.is_(None)))  # include legacy rows without tenant
    core_count = orders_q.scalar() or 0

    # Redemptions (loyalty)
    red_q = db.query(func.count(Redemption.id)).filter(Redemption.created_at >= start)
    # Attempt tenant scoping; if model lacks tenant_id in some rows, include them
    red_q = red_q.filter(Redemption.tenant_id == tid)
    loyalty_count = red_q.scalar() or 0

    # Payments (billing)
    pay_q = db.query(func.count(Payment.id)).filter(Payment.created_at >= start, Payment.status == "success")
    # Join to orders to scope by tenant when available
    # Note: For SQLite simplicity, filter by order_id IN recent orders for this tenant
    tenant_order_ids = db.query(Order.id).filter((Order.tenant_id == tid) | (Order.tenant_id.is_(None))).subquery()
    pay_q = pay_q.filter(Payment.order_id.in_(tenant_order_ids))
    billing_count = pay_q.scalar() or 0

    # Analytics: distinct active users in window (via orders)
    users_q = db.query(func.count(func.distinct(Order.user_id))).filter(Order.created_at >= start)
    users_q = users_q.filter((Order.tenant_id == tid) | (Order.tenant_id.is_(None)))
    analytics_count = users_q.scalar() or 0

    # Inventory: placeholder (no concrete model yet)
    inventory_count = 0

    return [
        {"module": "core", "count": core_count, "limit": limits.get("core")},
        {"module": "loyalty", "count": loyalty_count, "limit": limits.get("loyalty")},
        {"module": "billing", "count": billing_count, "limit": limits.get("billing")},
        {"module": "analytics", "count": analytics_count, "limit": limits.get("analytics")},
        {"module": "inventory", "count": inventory_count, "limit": limits.get("inventory")},
    ]


@router.get("/tenants/{tenant_id}/history")
def get_history(tenant_id: str, db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id)
    sub = _ensure_subscription_struct(t)
    return sub.get("history", [])


# ─── Billing Facade (minimal) ─────────────────────────────────────────────

@router.get("/profile")
def get_billing_profile(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    profile = (t.config or {}).get("billing_profile") or {}
    return profile


@router.put("/profile")
def put_billing_profile(payload: BillingProfile, tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    cfg = t.config or {}
    cfg["billing_profile"] = payload.dict(exclude_unset=True)
    t.config = cfg
    db.add(t); db.commit()
    return cfg["billing_profile"]


@router.get("/payment-methods")
def get_payment_methods(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID")):
    # Demo payload; integrate with Stripe/Yoco later
    return [{"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030}]


@router.get("/invoices")
def get_invoices(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID")):
    # Demo invoices
    today = datetime.utcnow().date()
    return [
        {"id": "inv_1", "date": today.isoformat(), "amount_cents": 49900, "currency": "ZAR", "status": "paid", "hosted_invoice_url": None},
        {"id": "inv_2", "date": (today - timedelta(days=30)).isoformat(), "amount_cents": 49900, "currency": "ZAR", "status": "paid", "hosted_invoice_url": None},
    ]


@router.post("/portal")
def open_portal(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID")):
    # Return a placeholder URL
    return {"url": "/billing/portal-demo"}


@router.post("/start-trial")
def start_trial(days: int = 14, tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    sub = _ensure_subscription_struct(t)
    sub["status"] = "trialing"
    sub["trial_ends_at"] = (datetime.utcnow() + timedelta(days=days)).isoformat()
    _record_history(sub, "trial.start", details=f"{days}d")
    db.add(t); db.commit()
    return {"ok": True}


@router.post("/cancel-trial")
def cancel_trial(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    sub = _ensure_subscription_struct(t)
    sub["status"] = "active"
    sub.pop("trial_ends_at", None)
    _record_history(sub, "trial.cancel")
    db.add(t); db.commit()
    return {"ok": True}


@router.post("/pause")
def pause_subscription(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    sub = _ensure_subscription_struct(t)
    sub["status"] = "paused"
    _record_history(sub, "subscription.pause")
    db.add(t); db.commit()
    return {"ok": True}


@router.post("/resume")
def resume_subscription(tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"), db: Session = Depends(get_db)):
    t = _get_tenant(db, tenant_id or "default")
    sub = _ensure_subscription_struct(t)
    sub["status"] = "active"
    _record_history(sub, "subscription.resume")
    db.add(t); db.commit()
    return {"ok": True}
