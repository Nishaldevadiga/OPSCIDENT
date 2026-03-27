import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
        ('tickets', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InAppNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(
                    choices=[
                        ('claim_submitted', 'Claim Submitted'),
                        ('claim_approved', 'Claim Approved'),
                        ('claim_rejected', 'Claim Rejected'),
                        ('info_requested', 'Information Requested'),
                        ('appeal_received', 'Appeal Received'),
                        ('appeal_decided', 'Appeal Decided'),
                        ('status_changed', 'Status Changed'),
                    ],
                    max_length=30,
                )),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='in_app_notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('ticket', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='in_app_notifications',
                    to='tickets.ticket',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
