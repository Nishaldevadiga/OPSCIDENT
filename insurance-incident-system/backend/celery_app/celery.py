import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('insurance_system')

app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks([
    'apps.ai_services',
    'apps.notifications',
])

app.conf.task_routes = {
    'apps.ai_services.tasks.*': {'queue': 'ai_processing'},
    'apps.notifications.tasks.*': {'queue': 'notifications'},
}

app.conf.task_default_queue = 'default'
