from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_telegrambot'),
    ]

    operations = [
        # Add chat_type field
        migrations.AddField(
            model_name='telegrambot',
            name='chat_type',
            field=models.CharField(
                choices=[
                    ('personal', 'Personal Chat'),
                    ('group', 'Group'),
                    ('supergroup', 'Supergroup'),
                    ('channel', 'Channel'),
                ],
                db_index=True,
                default='channel',
                help_text='Type of chat: personal, group, supergroup, or channel',
                max_length=20,
            ),
        ),
        # Add message_thread_id for topics
        migrations.AddField(
            model_name='telegrambot',
            name='message_thread_id',
            field=models.IntegerField(
                blank=True,
                help_text='Topic ID for supergroups with forum/topics enabled',
                null=True,
            ),
        ),
        # Add cached chat info fields
        migrations.AddField(
            model_name='telegrambot',
            name='chat_title',
            field=models.CharField(
                blank=True,
                help_text='Cached chat title from Telegram',
                max_length=255,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='telegrambot',
            name='chat_username',
            field=models.CharField(
                blank=True,
                help_text='Cached chat username (e.g., @mychannel)',
                max_length=100,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='telegrambot',
            name='bot_username',
            field=models.CharField(
                blank=True,
                help_text="Bot's username from Telegram",
                max_length=100,
                null=True,
            ),
        ),
        # Add usage tracking fields
        migrations.AddField(
            model_name='telegrambot',
            name='last_used_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Last time this bot was used to send a message',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='telegrambot',
            name='message_count',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Total messages sent through this bot',
            ),
        ),
        # Add indexes for new fields
        migrations.AddIndex(
            model_name='telegrambot',
            index=models.Index(fields=['chat_type'], name='telegram_bo_chat_ty_idx'),
        ),
        migrations.AddIndex(
            model_name='telegrambot',
            index=models.Index(fields=['last_used_at'], name='telegram_bo_last_us_idx'),
        ),
    ]
