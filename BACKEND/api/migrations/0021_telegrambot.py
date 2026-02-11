from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_add_dashuser_theme_mode'),
    ]

    operations = [
        migrations.CreateModel(
            name='TelegramBot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(db_index=True, help_text='Display name for the bot (used in dropdown)', max_length=100, unique=True)),
                ('token', models.CharField(help_text='Telegram Bot API token (from @BotFather)', max_length=255)),
                ('chat_ids', models.JSONField(blank=True, default=list, help_text='List of chat IDs to send messages to')),
                ('description', models.TextField(blank=True, help_text='Optional description of the bot\'s purpose', null=True)),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Whether this bot is active and available for use')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Telegram Bot',
                'verbose_name_plural': 'Telegram Bots',
                'db_table': 'telegram_bots',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='telegrambot',
            index=models.Index(fields=['name'], name='telegram_bo_name_idx'),
        ),
        migrations.AddIndex(
            model_name='telegrambot',
            index=models.Index(fields=['is_active'], name='telegram_bo_is_acti_idx'),
        ),
    ]
