import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async


class TicketStatusConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.ticket_id = self.scope['url_route']['kwargs']['ticket_id']
        self.group_name = f'ticket_{self.ticket_id}'

        # Authenticate via ?token= query param (HTTP Authorization header not
        # available in WS handshake).
        token_str = self._extract_token()
        if not token_str:
            await self.close(code=4001)
            return

        user = await self._authenticate(token_str)
        if user is None:
            await self.close(code=4001)
            return

        # Authorise: customer owns the ticket, or user is an agent.
        allowed = await self._is_authorised(user, self.ticket_id)
        if not allowed:
            await self.close(code=4003)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send current ticket state immediately on connect.
        ticket_data = await self._get_ticket_state(self.ticket_id)
        if ticket_data:
            await self.send_json({'type': 'ticket.state', **ticket_data})

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Messages sent to the group are forwarded to the WebSocket client.
    async def ticket_update(self, event):
        await self.send_json(event)

    # ------------------------------------------------------------------ helpers

    def _extract_token(self):
        qs = parse_qs(self.scope.get('query_string', b'').decode())
        tokens = qs.get('token', [])
        return tokens[0] if tokens else None

    @database_sync_to_async
    def _authenticate(self, token_str):
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        from apps.accounts.models import User
        try:
            token = AccessToken(token_str)
            return User.objects.get(id=token['user_id'])
        except (TokenError, User.DoesNotExist, Exception):
            return None

    @database_sync_to_async
    def _is_authorised(self, user, ticket_id):
        from apps.tickets.models import Ticket
        try:
            ticket = Ticket.objects.get(id=ticket_id)
            return user.role == 'agent' or ticket.customer_id == user.id
        except Ticket.DoesNotExist:
            return False

    @database_sync_to_async
    def _get_ticket_state(self, ticket_id):
        from apps.tickets.models import Ticket
        try:
            ticket = Ticket.objects.get(id=ticket_id)
            return {'status': ticket.status, 'ticket_id': ticket.ticket_id}
        except Ticket.DoesNotExist:
            return None
