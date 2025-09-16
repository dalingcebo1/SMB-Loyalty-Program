"""
Monitoring and health check endpoints for production.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import Dict, Any
import os
import sys

from app.core.database import get_db, engine
from config import settings
from typing import Optional

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "SMB Loyalty Program API",
        "version": "1.0.0"
    }


@router.get("/detailed")
async def detailed_health_check(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Detailed health check with dependency status."""
    checks = {}
    overall_status = "healthy"
    
    # Database check
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        checks["database"] = {
            "status": "unhealthy", 
            "message": f"Database connection failed: {str(e)}"
        }
        overall_status = "unhealthy"
    
    # Environment check
    try:
        required_env_vars = [
            "DATABASE_URL",
            "SECRET_KEY",
            "YOCO_SECRET_KEY"
        ]
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]
        
        if missing_vars:
            checks["environment"] = {
                "status": "warning",
                "message": f"Missing environment variables: {', '.join(missing_vars)}"
            }
            if overall_status == "healthy":
                overall_status = "warning"
        else:
            checks["environment"] = {
                "status": "healthy",
                "message": "All required environment variables present"
            }
    except Exception as e:
        checks["environment"] = {
            "status": "unhealthy",
            "message": f"Environment check failed: {str(e)}"
        }
        overall_status = "unhealthy"
    
    # System resources check
    try:
        try:
            import psutil
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            memory_warning = memory.percent > 80
            disk_warning = disk.percent > 80
            
            if memory_warning or disk_warning:
                checks["resources"] = {
                    "status": "warning",
                    "message": f"High resource usage - Memory: {memory.percent}%, Disk: {disk.percent}%",
                    "details": {
                        "memory_percent": memory.percent,
                        "disk_percent": disk.percent
                    }
                }
                if overall_status == "healthy":
                    overall_status = "warning"
            else:
                checks["resources"] = {
                    "status": "healthy",
                    "message": "System resources within normal limits",
                    "details": {
                        "memory_percent": memory.percent,
                        "disk_percent": disk.percent
                    }
                }
        except ImportError:
            checks["resources"] = {
                "status": "unknown",
                "message": "psutil not available for resource monitoring"
            }
    except Exception as e:
        checks["resources"] = {
            "status": "error",
            "message": f"Resource check failed: {str(e)}"
        }

    # Redis check (optional)
    try:
        redis_url = os.getenv("RATE_LIMIT_REDIS_URL")
        if redis_url:
            try:
                import redis  # type: ignore
                r = redis.from_url(redis_url)
                r.ping()
                checks["redis"] = {"status": "healthy", "message": "Redis reachable"}
            except Exception as re:  # pragma: no cover
                checks["redis"] = {"status": "unhealthy", "message": f"Redis error: {re}"}
                overall_status = "unhealthy"
        else:
            checks["redis"] = {"status": "skipped", "message": "No RATE_LIMIT_REDIS_URL configured"}
    except Exception as e:  # broad guard
        checks["redis"] = {"status": "error", "message": f"Redis check failed: {e}"}
    
    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "SMB Loyalty Program API",
        "version": "1.0.0",
        "checks": checks
    }


@router.get("/ready-lite", include_in_schema=False)
async def readiness_check_lite() -> Dict[str, Any]:
    """Extremely lightweight readiness probe (no DB).

    Returns 200 immediately – suitable for container platform readiness/liveness
    probes to avoid cascading startup failures if the DB is momentarily
    unavailable (the fuller /health/ready will still check deeper dependencies).
    """
    return {
        "status": "ready",
        "mode": "lite",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "SMB Loyalty Program API"
    }


_READY_CACHE: Dict[str, Any] = {}
_READY_CACHE_EXP: Optional[datetime] = None

@router.get("/ready")
async def readiness_check(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Full readiness check (DB + optional Redis + basic model access).

    Behavior modifiers (environment variables):
      HEALTH_READY_SKIP_DEEP=1  -> Skip DB & Redis checks (fast path) returning cached/nominal 200.
      HEALTH_READY_CACHE_TTL=seconds (default 5) -> Cache successful deep result briefly to reduce load.

    Recommended: platform probes use /health/ready-lite; this endpoint is for diagnostics.
    Returns 503 if a hard dependency is down (unless skip flag set).
    """
    global _READY_CACHE, _READY_CACHE_EXP
    now = datetime.utcnow()
    cache_ttl = int(os.getenv("HEALTH_READY_CACHE_TTL", "5") or 5)
    skip_deep = os.getenv("HEALTH_READY_SKIP_DEEP", "0") == "1"

    # Serve cached if valid & not skipping (skip implies we just produce simple response anyway)
    if not skip_deep and _READY_CACHE and _READY_CACHE_EXP and now < _READY_CACHE_EXP:
        return _READY_CACHE

    if skip_deep:
        result = {
            "status": "ready",
            "timestamp": now.isoformat(),
            "message": "Skip flag active (HEALTH_READY_SKIP_DEEP=1) - deep checks bypassed",
            "mode": "skip"
        }
        _READY_CACHE = result
        _READY_CACHE_EXP = now + timedelta(seconds=cache_ttl)
        return result

    # Deep path
    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
        
        # Check required tables exist
        from app.models import Tenant, User, Service
        db.query(Tenant).first()
        # Optional Redis check if rate limiting redis configured
        redis_status: Optional[str] = None
        redis_url = os.getenv("RATE_LIMIT_REDIS_URL")
        if redis_url:
            try:
                import redis  # type: ignore
                r = redis.from_url(redis_url)
                r.ping()
                redis_status = "healthy"
            except Exception as re:  # pragma: no cover - env dependent
                redis_status = f"unhealthy: {re}"  # degrade readiness if Redis explicitly required
                raise RuntimeError(f"Redis not reachable: {re}")
        
        resp = {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Service is ready to accept traffic"
        }
        if redis_status:
            resp["redis"] = redis_status
        _READY_CACHE = resp
        _READY_CACHE_EXP = now + timedelta(seconds=cache_ttl)
        return resp

    except Exception as e:  # pragma: no cover - depends on external services
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}"
        )


@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Liveness check for Kubernetes/container orchestration."""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "Service is running"
    }


@router.get("/startup", include_in_schema=False)
async def startup_check() -> Dict[str, Any]:
    """Startup probe distinguishing initial boot from running.

    Uses STARTUP_GRACE_SECONDS (default 30). Returns 200 while within grace
    period; after that simply returns 200 with mode=post-grace. Provided mainly
    so orchestrators can allow longer warm-up without failing readiness.
    """
    grace = int(os.getenv("STARTUP_GRACE_SECONDS", "30") or 30)
    # Use process start time from an env var optionally injected, fallback to module import time
    global _PROCESS_START
    if '_PROCESS_START' not in globals():
        globals()['_PROCESS_START'] = datetime.utcnow()
    elapsed = (datetime.utcnow() - globals()['_PROCESS_START']).total_seconds()
    within = elapsed < grace
    return {
        "status": "starting" if within else "started",
        "mode": "grace" if within else "steady",
        "elapsed_seconds": int(elapsed),
        "grace_seconds": grace,
        "timestamp": datetime.utcnow().isoformat()
    }

if os.getenv("METRICS_ENABLED", "0") == "1":
    @router.get("/metrics")
    async def get_metrics(
        db: Session = Depends(get_db)
    ) -> Dict[str, Any]:
        """Basic application metrics (toggle via METRICS_ENABLED=1)."""
        try:
            from app.models import Tenant, User, Service, Payment, LoyaltyProgram
            tenant_count = db.query(Tenant).count()
            user_count = db.query(User).count()
            service_count = db.query(Service).count()
            payment_count = db.query(Payment).count()
            program_count = db.query(LoyaltyProgram).count()
            python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "application": {
                    "tenant_count": tenant_count,
                    "user_count": user_count,
                    "service_count": service_count,
                    "payment_count": payment_count,
                    "loyalty_program_count": program_count
                },
                "system": {
                    "python_version": python_version,
                    "environment": os.getenv("ENVIRONMENT", "development")
                }
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get metrics: {str(e)}"
            )
