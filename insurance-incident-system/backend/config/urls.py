import time
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def health(request):
    start = time.monotonic()
    status = {"status": "ok", "services": {}}

    # Database
    try:
        from django.db import connection
        connection.ensure_connection()
        status["services"]["database"] = "ok"
    except Exception as e:
        status["services"]["database"] = f"error: {e}"
        status["status"] = "degraded"

    # Groq API key present
    status["services"]["groq"] = "configured" if settings.GROQ_API_KEY else "missing"

    status["response_ms"] = round((time.monotonic() - start) * 1000, 1)
    http_status = 200 if status["status"] == "ok" else 503
    return JsonResponse(status, status=http_status)

urlpatterns = [
    path('health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/agent/', include('apps.tickets.agent_urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/ai/', include('apps.ai_services.urls')),
]

if not settings.USE_S3:
    # Serve uploaded media files directly (not via S3). Safe for single-instance Cloud Run.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
