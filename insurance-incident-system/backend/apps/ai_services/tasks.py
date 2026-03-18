from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document(self, document_id, analyze_only=False):
    """Process a single document through AI analysis.

    analyze_only=True skips the make_ai_decision call; used by reanalyze_ticket
    which runs make_ai_decision once after all documents are processed.
    """
    from apps.documents.models import Document
    from .services import AIAnalysisService

    try:
        document = Document.objects.select_related('ticket').get(id=document_id)
        ticket = document.ticket
        logger.info(f"Processing document {document_id} for ticket {ticket.ticket_id}")

        # Update status to processing if still submitted
        if ticket.status == 'submitted':
            from apps.tickets.models import StatusHistory
            old_status = ticket.status
            ticket.status = 'processing'
            ticket.save()
            StatusHistory.objects.create(
                ticket=ticket,
                old_status=old_status,
                new_status='processing',
                reason='AI analysis started'
            )

        service = AIAnalysisService()

        if document.file_type == 'pdf':
            service.analyze_pdf(document)
        else:
            service.analyze_image(document)

        logger.info(f"Document {document_id} processed successfully")

    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
        return
    except Exception as exc:
        import traceback
        logger.error(f"Error processing document {document_id}: {exc}\n{traceback.format_exc()}")
        if self.request.retries >= self.max_retries:
            logger.error(f"Max retries exceeded for document {document_id}, escalating to manual review")
            _escalate_to_manual_review(document_id)
        else:
            raise self.retry(exc=exc)
        return

    # Run AI decision after successful analysis — outside the retry block so
    # a failed decision doesn't retrigger document re-analysis.
    # Use .delay() so Celery handles retry/error lifecycle independently.
    if not analyze_only:
        make_ai_decision.delay(ticket.id)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def make_ai_decision(self, ticket_id):
    """AI makes automatic decision on the ticket."""
    from apps.tickets.models import Ticket
    from .services import AIAnalysisService

    try:
        ticket = Ticket.objects.get(id=ticket_id)

        # Only process if ticket is still in processing state
        if ticket.status not in ['processing', 'submitted']:
            logger.info(f"Ticket {ticket.ticket_id} already decided (status: {ticket.status})")
            return

        logger.info(f"AI making decision for ticket {ticket.ticket_id}")

        service = AIAnalysisService()
        result = service.generate_recommendation_and_decide(ticket)

        if result:
            logger.info(f"AI Decision for {ticket.ticket_id}: {result['recommendation']} (confidence: {result['confidence']})")

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")
    except Exception as exc:
        logger.error(f"Error in AI decision for ticket {ticket_id}: {exc}")
        if self.request.retries >= self.max_retries:
            logger.error(f"Max retries exceeded for AI decision on ticket {ticket_id}, escalating to manual review")
            _escalate_decision_failure(ticket_id)
        else:
            raise self.retry(exc=exc)


@shared_task
def reanalyze_ticket(ticket_id):
    """Re-run AI analysis when customer provides more documents.

    Resets all prior analysis scores so stale results from the previous round
    don't pollute the new decision. All documents are analyzed with analyze_only=True,
    then make_ai_decision is called once after all analysis is complete.
    """
    from apps.tickets.models import Ticket, StatusHistory
    from apps.documents.models import Document
    from .models import AIAnalysis

    try:
        ticket = Ticket.objects.get(id=ticket_id)
        documents = Document.objects.filter(ticket=ticket)

        if not documents.exists():
            logger.warning(f"No documents found for ticket {ticket.ticket_id}")
            return

        # Reset prior analysis so stale scores don't carry over
        AIAnalysis.objects.filter(ticket=ticket).update(
            extracted_data={},
            damage_score=None,
            fraud_indicators=[],
            recommendation='review',
            confidence_score=0.0,
            analysis_summary='',
            pdf_analysis_complete=False,
            image_analysis_complete=False,
        )

        # Reset to processing
        old_status = ticket.status
        if old_status != 'processing':
            ticket.status = 'processing'
            ticket.save()
            StatusHistory.objects.create(
                ticket=ticket,
                old_status=old_status,
                new_status='processing',
                reason='Re-analyzing with new documents'
            )

        # Analyze all documents without triggering a premature decision after each one.
        # make_ai_decision runs once below after all analysis is complete.
        for doc in documents:
            process_document.delay(doc.id, analyze_only=True)

        # Single decision pass after all documents are queued/processed
        make_ai_decision.delay(ticket.id)

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")


def _escalate_decision_failure(ticket_id):
    """Fallback: when make_ai_decision exhausts all retries, move ticket to pending_info."""
    from apps.tickets.models import Ticket, StatusHistory
    from apps.notifications.services import NotificationService

    try:
        ticket = Ticket.objects.get(id=ticket_id)
        if ticket.status == 'processing':
            ticket.status = 'pending_info'
            ticket.save()
            StatusHistory.objects.create(
                ticket=ticket,
                old_status='processing',
                new_status='pending_info',
                reason='Your claim is currently being reviewed by one of our team members. We will notify you as soon as a decision has been made.'
            )
            NotificationService.send_info_request_notification(
                ticket,
                "Your claim documents have been received and are being reviewed by our team. "
                "An agent will be in touch with you shortly."
            )
            logger.info(f"Ticket {ticket.ticket_id} escalated to manual review after decision failure")
    except Exception as e:
        logger.error(f"Failed to escalate decision failure for ticket {ticket_id}: {e}")


def _escalate_to_manual_review(document_id):
    """Fallback: when AI analysis exhausts all retries, move ticket to pending_info."""
    from apps.documents.models import Document
    from apps.tickets.models import StatusHistory
    from apps.notifications.services import NotificationService

    try:
        document = Document.objects.select_related('ticket').get(id=document_id)
        ticket = document.ticket
        if ticket.status == 'processing':
            ticket.status = 'pending_info'
            ticket.save()
            StatusHistory.objects.create(
                ticket=ticket,
                old_status='processing',
                new_status='pending_info',
                reason='Your claim is currently being reviewed by one of our team members. We will notify you as soon as a decision has been made.'
            )
            NotificationService.send_info_request_notification(
                ticket,
                "Your claim is currently being reviewed by one of our team members. "
                "We will notify you as soon as a decision has been made."
            )
            logger.info(f"Ticket {ticket.ticket_id} escalated to manual review after AI failure")
    except Exception as e:
        logger.error(f"Failed to escalate ticket for document {document_id}: {e}")
