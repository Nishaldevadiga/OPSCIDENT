from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create an agent user. No-op if the email already exists.'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--first-name', default='Agent')
        parser.add_argument('--last-name', default='User')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        if User.objects.filter(email=email).exists():
            self.stdout.write(f'Agent {email} already exists — skipping.')
            return

        User.objects.create_user(
            email=email,
            password=options['password'],
            first_name=options['first_name'],
            last_name=options['last_name'],
            role='agent',
        )
        self.stdout.write(self.style.SUCCESS(f'Agent {email} created successfully.'))
