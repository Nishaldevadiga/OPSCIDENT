from celery import shared_task
from celery.utils.log import get_task_logger
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

logger = get_task_logger(__name__)


def _create_inapp(user, ticket, notification_type, title, message):
    """Create an in-app notification record (fire-and-forget, no retries needed)."""
    try:
        from .models import InAppNotification
        InAppNotification.objects.create(
            user=user,
            ticket=ticket,
            notification_type=notification_type,
            title=title,
            message=message,
        )
    except Exception as e:
        logger.warning(f"Failed to create in-app notification: {e}")


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def send_email_notification(self, notification_id):
    """Send an email notification."""
    from .models import EmailNotification

    try:
        notification = EmailNotification.objects.select_related('user', 'ticket').get(id=notification_id)

        if notification.status == 'sent':
            logger.info(f"Notification {notification_id} already sent")
            return

        send_mail(
            subject=notification.subject,
            message=notification.body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notification.user.email],
            fail_silently=False,
        )

        notification.status = 'sent'
        notification.sent_at = timezone.now()
        notification.save()

        logger.info(f"Email sent to {notification.user.email}")

    except EmailNotification.DoesNotExist:
        logger.error(f"Notification {notification_id} not found")
    except Exception as exc:
        logger.error(f"Error sending notification {notification_id}: {exc}")
        try:
            notification = EmailNotification.objects.get(id=notification_id)
            notification.status = 'failed'
            notification.error_message = str(exc)
            notification.save()
        except EmailNotification.DoesNotExist:
            pass
        raise self.retry(exc=exc)


@shared_task
def send_ticket_submitted_email(ticket_id):
    """Send confirmation email when a ticket is submitted."""
    from apps.tickets.models import Ticket
    from .models import EmailNotification

    try:
        ticket = Ticket.objects.select_related('customer').get(id=ticket_id)

        subject = f"Insurance Claim Submitted - {ticket.ticket_id}"
        body = render_to_string('emails/ticket_submitted.txt', {
            'user': ticket.customer,
            'ticket': ticket,
        })

        notification = EmailNotification.objects.create(
            user=ticket.customer,
            ticket=ticket,
            notification_type='ticket_submitted',
            subject=subject,
            body=body,
        )

        send_email_notification.delay(notification.id)

        _create_inapp(
            ticket.customer, ticket, 'claim_submitted',
            'Claim Submitted',
            f"Your claim {ticket.ticket_id} has been submitted and is being reviewed by our team.",
        )

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")


@shared_task
def send_status_change_email(ticket_id):
    """Send email when ticket status changes."""
    from apps.tickets.models import Ticket
    from .models import EmailNotification

    try:
        ticket = Ticket.objects.select_related('customer').get(id=ticket_id)

        status_display = dict(Ticket.STATUS_CHOICES).get(ticket.status, ticket.status)
        subject = f"Claim Update - {ticket.ticket_id}: {status_display}"

        template = 'emails/status_change.txt'
        if ticket.status == 'approved':
            template = 'emails/ticket_approved.txt'
        elif ticket.status == 'rejected':
            template = 'emails/ticket_rejected.txt'

        body = render_to_string(template, {
            'user': ticket.customer,
            'ticket': ticket,
            'status_display': status_display,
        })

        notification_type = f'ticket_{ticket.status}' if ticket.status in ['approved', 'rejected'] else 'status_changed'

        notification = EmailNotification.objects.create(
            user=ticket.customer,
            ticket=ticket,
            notification_type=notification_type,
            subject=subject,
            body=body,
        )

        send_email_notification.delay(notification.id)

        inapp_map = {
            'approved': ('claim_approved', 'Claim Approved',
                         f"Great news! Your claim {ticket.ticket_id} has been approved."),
            'rejected': ('claim_rejected', 'Claim Not Approved',
                         f"Your claim {ticket.ticket_id} has been reviewed. Unfortunately it was not approved. You may appeal this decision."),
            'pending_info': ('info_requested', 'Action Required',
                             f"Additional information is needed to process your claim {ticket.ticket_id}."),
            'appealed': ('appeal_received', 'Appeal Received',
                         f"Your appeal for claim {ticket.ticket_id} has been received and is under review."),
        }
        if ticket.status in inapp_map:
            ntype, title, msg = inapp_map[ticket.status]
            _create_inapp(ticket.customer, ticket, ntype, title, msg)

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")


@shared_task
def send_info_request_email(ticket_id, message):
    """Send email when agent requests additional information."""
    from apps.tickets.models import Ticket
    from .models import EmailNotification

    try:
        ticket = Ticket.objects.select_related('customer').get(id=ticket_id)

        subject = f"Information Required - {ticket.ticket_id}"
        body = render_to_string('emails/info_request.txt', {
            'user': ticket.customer,
            'ticket': ticket,
            'message': message,
        })

        notification = EmailNotification.objects.create(
            user=ticket.customer,
            ticket=ticket,
            notification_type='info_requested',
            subject=subject,
            body=body,
        )

        send_email_notification.delay(notification.id)

        _create_inapp(
            ticket.customer, ticket, 'info_requested',
            'Action Required',
            f"Additional information is needed to process your claim {ticket.ticket_id}. Please log in to respond.",
        )

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")


@shared_task
def send_appeal_email(ticket_id, appeal_reason):
    """Send confirmation email when customer submits an appeal."""
    from apps.tickets.models import Ticket
    from .models import EmailNotification

    try:
        ticket = Ticket.objects.select_related('customer').get(id=ticket_id)

        subject = f"Appeal Received - {ticket.ticket_id}"
        body = render_to_string('emails/appeal_submitted.txt', {
            'user': ticket.customer,
            'ticket': ticket,
            'appeal_reason': appeal_reason,
        })

        notification = EmailNotification.objects.create(
            user=ticket.customer,
            ticket=ticket,
            notification_type='status_changed',
            subject=subject,
            body=body,
        )

        send_email_notification.delay(notification.id)

        _create_inapp(
            ticket.customer, ticket, 'appeal_received',
            'Appeal Received',
            f"Your appeal for claim {ticket.ticket_id} has been received. Our team will review it and notify you of the outcome.",
        )

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")
