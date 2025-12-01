"""
Metrics endpoint for Prometheus scraping.
"""
from fastapi import APIRouter, Response
from app.core.metrics import get_metrics, get_metrics_content_type

router = APIRouter(tags=["observability"])


@router.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.
    
    Returns metrics in Prometheus text format for scraping.
    No authentication required (typically scraped from internal network).
    
    Returns:
        Metrics in Prometheus format
    """
    metrics_data = get_metrics()
    return Response(
        content=metrics_data,
        media_type=get_metrics_content_type()
    )
