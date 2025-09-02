"""Aggregate developer routers into a single composite router.

Phase 2 refactor: split dev endpoints by concern while preserving
original mount point (/api/dev).
"""
from fastapi import APIRouter
from .status_routes import status_router
from .danger_routes import danger_router
from .jobs_routes import jobs_router
from .rate_limit_routes import rate_router
from .audit_routes import audit_router

router = APIRouter()
for r in (status_router, danger_router, jobs_router, rate_router, audit_router):
    router.include_router(r)
