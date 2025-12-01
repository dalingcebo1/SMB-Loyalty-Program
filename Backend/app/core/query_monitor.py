"""
Database Query Monitoring Middleware

Tracks slow queries and emits metrics for Prometheus.
"""
import time
import logging
from sqlalchemy import event
from sqlalchemy.engine import Engine
from contextvars import ContextVar
from typing import Optional
from app.core.metrics import database_query_duration_seconds, database_slow_queries_total

logger = logging.getLogger(__name__)

# Context variable to track the current endpoint
_current_endpoint: ContextVar[Optional[str]] = ContextVar('current_endpoint', default=None)

# Track query start times
_query_start_times = {}


def set_current_endpoint(endpoint: str):
    """Set the current endpoint for query attribution."""
    _current_endpoint.set(endpoint)


def get_current_endpoint() -> Optional[str]:
    """Get the current endpoint."""
    return _current_endpoint.get()


def extract_table_name(statement: str) -> str:
    """Extract the primary table name from a SQL statement."""
    statement_upper = statement.upper().strip()
    
    # Try to find table name in common SQL patterns
    keywords = ['FROM', 'INTO', 'UPDATE', 'JOIN']
    
    for keyword in keywords:
        if keyword in statement_upper:
            # Find the keyword and extract the next word
            parts = statement_upper.split(keyword, 1)
            if len(parts) > 1:
                # Get the next words after the keyword
                words = parts[1].strip().split()
                if words:
                    # Clean up the table name (remove schema prefix, quotes, etc)
                    table = words[0].strip('(),"\'').split('.')[-1]
                    # Remove any JOIN, WHERE, etc that might be there
                    table = table.split()[0] if ' ' in table else table
                    return table.lower()[:50]  # Limit length
    
    return 'unknown'


def extract_operation(statement: str) -> str:
    """Extract the SQL operation type."""
    statement_upper = statement.upper().strip()
    
    if statement_upper.startswith('SELECT'):
        return 'select'
    elif statement_upper.startswith('INSERT'):
        return 'insert'
    elif statement_upper.startswith('UPDATE'):
        return 'update'
    elif statement_upper.startswith('DELETE'):
        return 'delete'
    elif statement_upper.startswith('CREATE'):
        return 'create'
    elif statement_upper.startswith('ALTER'):
        return 'alter'
    elif statement_upper.startswith('DROP'):
        return 'drop'
    else:
        return 'other'


@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Track query start time."""
    conn_id = id(conn)
    _query_start_times[conn_id] = time.time()


@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Track query completion and emit metrics."""
    conn_id = id(conn)
    start_time = _query_start_times.pop(conn_id, None)
    
    if start_time is None:
        return
    
    duration = time.time() - start_time
    
    # Extract query info
    operation = extract_operation(statement)
    table = extract_table_name(statement)
    
    # Emit duration metric
    database_query_duration_seconds.labels(
        operation=operation,
        table=table
    ).observe(duration)
    
    # Track slow queries (> 1 second)
    if duration > 1.0:
        endpoint = get_current_endpoint() or 'unknown'
        
        database_slow_queries_total.labels(
            operation=operation,
            table=table,
            endpoint=endpoint
        ).inc()
        
        # Log slow query details
        logger.warning(
            f"Slow query detected: {duration:.3f}s - {operation.upper()} on {table} - {endpoint}",
            extra={
                'duration_seconds': duration,
                'operation': operation,
                'table': table,
                'endpoint': endpoint,
                'statement': statement[:200]  # First 200 chars
            }
        )


def setup_query_monitoring():
    """
    Setup database query monitoring.
    
    Call this during application startup to enable query tracking.
    """
    logger.info("Database query monitoring enabled - tracking slow queries (> 1s)")
    logger.info("Metrics available at: database_query_duration_seconds, database_slow_queries_total")


def cleanup_query_monitoring():
    """
    Cleanup query monitoring state.
    
    Call this during shutdown or between tests.
    """
    _query_start_times.clear()
    _current_endpoint.set(None)
