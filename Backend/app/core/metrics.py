"""
Prometheus Metrics

Comprehensive metrics collection for monitoring and observability.
"""
from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client import REGISTRY, CollectorRegistry
from starlette.requests import Request
from starlette.responses import Response
import time
from typing import Callable
import logging
import os

logger = logging.getLogger(__name__)

# Use a separate registry for tests to avoid conflicts
if os.getenv('PYTEST_CURRENT_TEST'):
    # During tests, use a fresh registry
    _metrics_registry = CollectorRegistry()
else:
    # In production, use the default registry
    _metrics_registry = REGISTRY

def _get_or_create_metric(metric_class, name, *args, **kwargs):
    """Get existing metric or create new one if not registered."""
    # Pass custom registry
    if 'registry' not in kwargs:
        kwargs['registry'] = _metrics_registry
    
    try:
        return metric_class(name, *args, **kwargs)
    except ValueError as e:
        # If metric already exists in registry, return the existing one
        # This handles the "Duplicated timeseries" error during re-imports
        if "Duplicated timeseries" in str(e):
            # Iterate through registered collectors to find the matching one
            for collector in _metrics_registry._collector_to_names.keys():
                if hasattr(collector, '_name') and collector._name == name:
                    return collector
                # Info metrics often append '_info'
                if hasattr(collector, '_name') and collector._name == f"{name}_info":
                    return collector
            
            # If we can't find it but it says duplicated, it might be a race condition or weird state.
            # In production, this shouldn't happen often unless we have circular imports.
            # We will log and re-raise to be safe, but usually the loop above finds it.
            logger.warning(f"Metric {name} reported as duplicate but not found in registry iteration.")
            raise e
        raise e

# ============================================================================
# REQUEST METRICS
# ============================================================================

# Total HTTP requests
http_requests_total = _get_or_create_metric(
    Counter,
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status', 'tenant_id']
)

# Request duration
http_request_duration_seconds = _get_or_create_metric(
    Histogram,
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'tenant_id'],
    buckets=(0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
)

# Request size
http_request_size_bytes = _get_or_create_metric(
    Histogram,
    'http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint', 'tenant_id']
)

# Response size
http_response_size_bytes = _get_or_create_metric(
    Histogram,
    'http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint', 'tenant_id']
)

# Active requests
http_requests_in_progress = _get_or_create_metric(
    Gauge,
    'http_requests_in_progress',
    'Number of HTTP requests currently being processed',
    ['method', 'tenant_id']
)

# ============================================================================
# TENANT METRICS
# ============================================================================

# Total tenants
tenants_total = _get_or_create_metric(
    Gauge,
    'tenants_total',
    'Total number of tenants',
    ['vertical', 'status']
)

# Tenant requests
tenant_requests_total = _get_or_create_metric(
    Counter,
    'tenant_requests_total',
    'Total requests per tenant',
    ['tenant_id', 'vertical', 'endpoint']
)

# Tenant API latency
tenant_request_duration_seconds = _get_or_create_metric(
    Histogram,
    'tenant_request_duration_seconds',
    'Request latency per tenant',
    ['tenant_id', 'endpoint']
)

# Active tenants (with recent activity)
active_tenants = _get_or_create_metric(
    Gauge,
    'active_tenants_count',
    'Number of tenants with activity in last hour'
)

# ============================================================================
# DATABASE METRICS
# ============================================================================

# Database queries
database_queries_total = _get_or_create_metric(
    Counter,
    'database_queries_total',
    'Total database queries',
    ['operation', 'table', 'tenant_id']
)

# Query duration
database_query_duration_seconds = _get_or_create_metric(
    Histogram,
    'database_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table'],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0)
)

# Slow queries (> 1 second)
database_slow_queries_total = _get_or_create_metric(
    Counter,
    'database_slow_queries_total',
    'Total slow database queries (duration > 1s)',
    ['operation', 'table', 'endpoint']
)

# Connection pool
database_connections = _get_or_create_metric(
    Gauge,
    'database_connections',
    'Number of database connections',
    ['state']  # 'active', 'idle', 'waiting'
)

# ============================================================================
# CACHE METRICS
# ============================================================================

# Cache operations
cache_operations_total = _get_or_create_metric(
    Counter,
    'cache_operations_total',
    'Total cache operations',
    ['operation', 'layer', 'result']  # operation: get/set/delete, layer: l1/l2, result: hit/miss/error
)

# Cache hit rate
cache_hit_rate = _get_or_create_metric(
    Gauge,
    'cache_hit_rate',
    'Cache hit rate percentage',
    ['layer']  # l1, l2
)

# Cache size
cache_size = _get_or_create_metric(
    Gauge,
    'cache_size',
    'Number of items in cache',
    ['layer']
)

# Cache memory usage
cache_memory_bytes = _get_or_create_metric(
    Gauge,
    'cache_memory_bytes',
    'Cache memory usage in bytes',
    ['layer']
)

# ============================================================================
# BUSINESS METRICS
# ============================================================================

# Orders
orders_total = _get_or_create_metric(
    Counter,
    'orders_total',
    'Total orders created',
    ['tenant_id', 'vertical', 'status']
)

# Order value
order_value_cents = _get_or_create_metric(
    Histogram,
    'order_value_cents',
    'Order value in cents',
    ['tenant_id', 'vertical'],
    buckets=(100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000)
)

# Loyalty points
loyalty_points_awarded = _get_or_create_metric(
    Counter,
    'loyalty_points_awarded_total',
    'Total loyalty points awarded',
    ['tenant_id', 'vertical']
)

# User registrations
user_registrations_total = _get_or_create_metric(
    Counter,
    'user_registrations_total',
    'Total user registrations',
    ['tenant_id', 'vertical']
)

# Active users
active_users = _get_or_create_metric(
    Gauge,
    'active_users',
    'Number of active users in last 24 hours',
    ['tenant_id', 'vertical']
)

# ============================================================================
# CELERY METRICS
# ============================================================================

# Tasks queued
celery_tasks_queued = _get_or_create_metric(
    Gauge,
    'celery_tasks_queued',
    'Number of tasks waiting in queue',
    ['queue']
)

# Tasks executed
celery_tasks_total = _get_or_create_metric(
    Counter,
    'celery_tasks_total',
    'Total Celery tasks executed',
    ['task_name', 'status']  # status: success/failure/retry
)

# Task duration
celery_task_duration_seconds = _get_or_create_metric(
    Histogram,
    'celery_task_duration_seconds',
    'Celery task execution duration',
    ['task_name'],
    buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0)
)

# Workers
celery_workers = _get_or_create_metric(
    Gauge,
    'celery_workers',
    'Number of Celery workers',
    ['status']  # online, offline
)

# ============================================================================
# SYSTEM METRICS
# ============================================================================

# Application info
app_info = _get_or_create_metric(
    Info,
    'app',
    'Application information'
)

# Uptime
app_uptime_seconds = _get_or_create_metric(
    Gauge,
    'app_uptime_seconds',
    'Application uptime in seconds'
)

# Python version
python_info = _get_or_create_metric(
    Info,
    'python',
    'Python interpreter information'
)

# ============================================================================
# RATE LIMIT METRICS
# ============================================================================

# Rate limit hits
rate_limit_hits_total = _get_or_create_metric(
    Counter,
    'rate_limit_hits_total',
    'Total rate limit hits',
    ['endpoint', 'tenant_id', 'limit_type']
)

# Rate limit rejections (429 responses)
rate_limit_rejections_total = _get_or_create_metric(
    Counter,
    'rate_limit_rejections_total',
    'Total rate limit rejections',
    ['endpoint', 'tenant_id', 'limit_type']
)

# ============================================================================
# ERROR METRICS
# ============================================================================

# Errors
errors_total = _get_or_create_metric(
    Counter,
    'errors_total',
    'Total errors',
    ['endpoint', 'error_type', 'tenant_id']
)

# Exceptions
exceptions_total = _get_or_create_metric(
    Counter,
    'exceptions_total',
    'Total unhandled exceptions',
    ['exception_type', 'endpoint']
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def track_request_metrics(
    request: Request,
    response: Response,
    duration: float
):
    """
    Track request metrics.
    
    Args:
        request: Request object
        response: Response object
        duration: Request duration in seconds
    """
    try:
        method = request.method
        endpoint = request.url.path
        status = response.status_code
        tenant_id = getattr(request.state, 'tenant_id', 'unknown')
        
        # Total requests
        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status=status,
            tenant_id=tenant_id
        ).inc()
        
        # Duration
        http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint,
            tenant_id=tenant_id
        ).observe(duration)
        
        # Request size
        content_length = request.headers.get('content-length')
        if content_length:
            http_request_size_bytes.labels(
                method=method,
                endpoint=endpoint,
                tenant_id=tenant_id
            ).observe(int(content_length))
        
        # Response size
        response_length = response.headers.get('content-length')
        if response_length:
            http_response_size_bytes.labels(
                method=method,
                endpoint=endpoint,
                tenant_id=tenant_id
            ).observe(int(response_length))
        
    except Exception as exc:
        logger.error(f"Failed to track request metrics: {exc}", exc_info=True)


def track_cache_operation(
    operation: str,
    layer: str,
    result: str
):
    """
    Track cache operation.
    
    Args:
        operation: Operation type (get, set, delete)
        layer: Cache layer (l1, l2)
        result: Operation result (hit, miss, error)
    """
    cache_operations_total.labels(
        operation=operation,
        layer=layer,
        result=result
    ).inc()


def track_database_query(
    operation: str,
    table: str,
    duration: float,
    tenant_id: str = 'unknown'
):
    """
    Track database query.
    
    Args:
        operation: SQL operation (SELECT, INSERT, UPDATE, DELETE)
        table: Table name
        duration: Query duration in seconds
        tenant_id: Tenant ID
    """
    database_queries_total.labels(
        operation=operation,
        table=table,
        tenant_id=tenant_id
    ).inc()
    
    database_query_duration_seconds.labels(
        operation=operation,
        table=table
    ).observe(duration)


def track_order_created(
    tenant_id: str,
    vertical: str,
    status: str,
    value_cents: int
):
    """
    Track order creation.
    
    Args:
        tenant_id: Tenant ID
        vertical: Vertical type
        status: Order status
        value_cents: Order value in cents
    """
    orders_total.labels(
        tenant_id=tenant_id,
        vertical=vertical,
        status=status
    ).inc()
    
    order_value_cents.labels(
        tenant_id=tenant_id,
        vertical=vertical
    ).observe(value_cents)


def track_points_awarded(
    tenant_id: str,
    vertical: str,
    points: int
):
    """
    Track loyalty points awarded.
    
    Args:
        tenant_id: Tenant ID
        vertical: Vertical type
        points: Points awarded
    """
    loyalty_points_awarded.labels(
        tenant_id=tenant_id,
        vertical=vertical
    ).inc(points)


def track_error(
    endpoint: str,
    error_type: str,
    tenant_id: str = 'unknown'
):
    """
    Track error occurrence.
    
    Args:
        endpoint: Endpoint path
        error_type: Error type
        tenant_id: Tenant ID
    """
    errors_total.labels(
        endpoint=endpoint,
        error_type=error_type,
        tenant_id=tenant_id
    ).inc()


def get_metrics() -> bytes:
    """
    Get current metrics in Prometheus format.
    
    Returns:
        Metrics data
    """
    return generate_latest(_metrics_registry)


def get_metrics_content_type() -> str:
    """
    Get content type for metrics endpoint.
    
    Returns:
        Content type string
    """
    return CONTENT_TYPE_LATEST
