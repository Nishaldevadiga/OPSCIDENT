from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_document(self, document_id):
    """Process a single document through AI analysis."""
    from apps.documents.models import Document
    from .services import AIAnalysisService

    try:
        document = Document.objects.select_related('ticket').get(id=document_id)
        logger.info(f"Processing document {document_id} for ticket {document.ticket.ticket_id}")

        service = AIAnalysisService()

        if document.file_type == 'pdf':
            service.analyze_pdf(document)
        else:
            service.analyze_image(document)

        logger.info(f"Document {document_id} processed successfully")

    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found")
    except Exception as exc:
        logger.error(f"Error processing document {document_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_ticket(self, ticket_id):
    """Run full AI analysis on a ticket after all documents are processed."""
    from apps.tickets.models import Ticket
    from .services import AIAnalysisService

    try:
        ticket = Ticket.objects.get(id=ticket_id)
        logger.info(f"Running full analysis for ticket {ticket.ticket_id}")

        service = AIAnalysisService()
        service.generate_recommendation(ticket)

        logger.info(f"Ticket {ticket.ticket_id} analysis complete")

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")
    except Exception as exc:
        logger.error(f"Error analyzing ticket {ticket_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task
def process_ticket_documents(ticket_id):
    """Process all documents for a ticket and then run full analysis."""
    from apps.tickets.models import Ticket
    from apps.documents.models import Document
    from celery import chain

    try:
        ticket = Ticket.objects.get(id=ticket_id)
        documents = Document.objects.filter(ticket=ticket)

        if not documents.exists():
            logger.warning(f"No documents found for ticket {ticket.ticket_id}")
            return

        old_status = ticket.status
        ticket.status = 'processing'
        ticket.save()

        from apps.tickets.models import StatusHistory
        StatusHistory.objects.create(
            ticket=ticket,
            old_status=old_status,
            new_status='processing',
            reason='AI analysis started'
        )

        for doc in documents:
            process_document.delay(doc.id)

        analyze_ticket.apply_async((ticket_id,), countdown=30)

    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found")
