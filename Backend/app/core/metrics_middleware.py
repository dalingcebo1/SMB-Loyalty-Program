"""
Prometheus Metrics Middleware

Automatically tracks request/response metrics.
"""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.metrics import (
    track_request_metrics,
    http_requests_in_progress,
    track_error
)

logger = logging.getLogger(__name__)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to collect Prometheus metrics for all requests"""
    
    async def dispatch(self, request: Request, call_next):
        """
        Track metrics for each request/response.
        
        Args:
            request: Request object
            call_next: Next middleware/handler
        
        Returns:
            Response object
        """
        # Skip metrics endpoint itself to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)
        
        # Get tenant ID if available
        tenant_id = getattr(request.state, 'tenant_id', 'unknown')
        method = request.method
        
        # Track active requests
        http_requests_in_progress.labels(
            method=method,
            tenant_id=tenant_id
        ).inc()
        
        start_time = time.time()
        response = None
        
        try:
            # Call next middleware/handler
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Track metrics
            track_request_metrics(request, response, duration)
            
            return response
            
        except Exception as exc:
            # Track error
            duration = time.time() - start_time
            
            track_error(
                endpoint=request.url.path,
                error_type=type(exc).__name__,
                tenant_id=tenant_id
            )
            
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                exc_info=True
            )
            
            # Re-raise to let error handlers deal with it
            raise
            
        finally:
            # Decrement active requests
            http_requests_in_progress.labels(
                method=method,
                tenant_id=tenant_id
            ).dec()
