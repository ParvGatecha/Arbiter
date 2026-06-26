from celery import Celery
from backend.app.core.config import settings

celery_app = Celery(
    "arbiter_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["backend.app.tasks.evaluation"]
)

# Custom configurations
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Prevent tasks from blocking indefinitely
    task_time_limit=600,  # 10 minutes
    task_soft_time_limit=300,  # 5 minutes
)
