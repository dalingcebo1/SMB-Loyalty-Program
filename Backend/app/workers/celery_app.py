"""
Celery Application Configuration

Celery worker for background task processing.
"""
from celery import Celery
from config import settings

# Initialize Celery app
celery_app = Celery(
    'smb_loyalty',
    broker=settings.redis_url or 'redis://localhost:6379/0',
    backend=settings.redis_url or 'redis://localhost:6379/0',
    include=['app.workers.tasks']  # Auto-discover tasks
)

# Celery configuration
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    
    # Timezone
    timezone='UTC',
    enable_utc=True,
    
    # Task execution
    task_track_started=True,
    task_time_limit=300,  # 5 minutes hard limit
    task_soft_time_limit=240,  # 4 minutes soft limit
    
    # Result backend
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={'master_name': 'mymaster'},
    
    # Worker
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    
    # Retry policy
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Rate limiting
    task_default_rate_limit='100/m',
    
    # Beat schedule (periodic tasks)
    beat_schedule={
        'cleanup-expired-sessions': {
            'task': 'app.workers.tasks.cleanup_expired_sessions',
            'schedule': 3600.0,  # Every hour
        },
        'generate-daily-analytics': {
            'task': 'app.workers.tasks.generate_daily_analytics',
            'schedule': 86400.0,  # Every day at midnight
            'args': (),
        },
        'sync-tenant-caches': {
            'task': 'app.workers.tasks.sync_tenant_caches',
            'schedule': 300.0,  # Every 5 minutes
        },
    },
)

# Task routes (different queues for different priorities)
celery_app.conf.task_routes = {
    'app.workers.tasks.send_*': {'queue': 'notifications'},
    'app.workers.tasks.generate_*': {'queue': 'reports'},
    'app.workers.tasks.sync_*': {'queue': 'analytics'},
    'app.workers.tasks.cleanup_*': {'queue': 'maintenance'},
}

# Set default queue
celery_app.conf.task_default_queue = 'default'
