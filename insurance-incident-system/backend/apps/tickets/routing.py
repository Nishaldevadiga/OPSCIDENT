from django.urls import re_path
from .consumers import TicketStatusConsumer

websocket_urlpatterns = [
    re_path(r'ws/tickets/(?P<ticket_id>\d+)/$', TicketStatusConsumer.as_asgi()),
]
