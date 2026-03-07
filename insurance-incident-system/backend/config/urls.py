from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/agent/', include('apps.tickets.agent_urls')),
]
