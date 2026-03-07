from .tasks import send_ticket_submitted_email, send_status_change_email, send_info_request_email


class NotificationService:
    """Service for managing notifications."""

    @staticmethod
    def send_ticket_submitted_notification(ticket):
        """Queue notification for ticket submission."""
        send_ticket_submitted_email.delay(ticket.id)

    @staticmethod
    def send_status_change_notification(ticket):
        """Queue notification for status change."""
        send_status_change_email.delay(ticket.id)

    @staticmethod
    def send_info_request_notification(ticket, message):
        """Queue notification for information request."""
        send_info_request_email.delay(ticket.id, message)
