# FastPay Backend (Django REST Framework)

Django REST Framework backend API for FastPay system.

## System Architecture

The FastPay system consists of:
- **FASTPAY_BASE** - Android APK application
- **fastpay_dashboard** - Frontend dashboard (React/TypeScript)
- **fastpay_be** - Backend API (Django REST Framework)

## Features

- ✅ Device management
- ✅ Messages (SMS) CRUD and batch uploads
- ✅ Notifications CRUD and batch uploads
- ✅ Contacts CRUD and batch uploads
- ✅ File system operations (upload, download, list, delete)
- ✅ RESTful API endpoints
- ✅ SQLite/PostgreSQL database support
- ✅ Docker deployment ready
- ✅ One-click deployment scripts

## Quick Start

### Local Development

1. **Clone and navigate:**
   ```bash
   git clone <your-repo-url>
   cd fastpay_be
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   
   # Windows:
   venv\Scripts\activate
   
   # Linux/Mac:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```

5. **Run migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

6. **Create superuser:**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run development server:**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://127.0.0.1:8000/`

---

## Deployment to VPS

**Deploy layout (staging and production):** For where code lives on the server (`/var/www/fastpay` for production, `/desktop/fastpay` for staging), which URLs serve what, and the full deploy process, see **[../docs/VPS_DEPLOY_STRUCTURE.md](../docs/VPS_DEPLOY_STRUCTURE.md)**.

### For Windows Users Deploying to Linux VPS

**See `DEPLOY_FROM_WINDOWS.md` for detailed Windows → Linux deployment guide.**

**Quick steps:**

1. **Method 1: SSH Directly (Recommended)**
   ```powershell
   # From Windows PowerShell
   ssh root@your-vps-ip
   
   # Then on VPS:
   cd /opt
   git clone <your-repo-url> fastpay_be
   cd fastpay_be
   chmod +x setup.sh deploy.sh restart.sh
   sudo ./setup.sh
   sudo nano .env.production  # Configure
   sudo ./deploy.sh
   ```

2. **Method 2: Use PowerShell Script**
   ```powershell
   # Edit deploy-remote.ps1 with your VPS details
   .\deploy-remote.ps1 -VpsIp "your-vps-ip" -Username "root" -FirstTime
   ```

### Gmail & Drive (staging and production)

For Connect Gmail / Drive to work on your domain, set `GOOGLE_REDIRECT_URI` (backend callback URL) and `DASHBOARD_ORIGIN` in the backend env, and `VITE_API_BASE_URL` in the dashboard build. **See [docs/GMAIL_DRIVE_DEPLOY.md](docs/GMAIL_DRIVE_DEPLOY.md)** for staging vs production env and Google Console setup.

### For Linux Users

**See `QUICK_DEPLOY.md` or `DEPLOYMENT.md` for full deployment guide.**

**Quick deployment:**
```bash
cd /opt
git clone <your-repo-url> fastpay_be
cd fastpay_be
chmod +x setup.sh deploy.sh restart.sh
sudo ./setup.sh
sudo nano .env.production  # Configure
sudo ./deploy.sh
```

---

## API Endpoints

### Root
- `GET /api/` - Welcome message

### Devices
- `GET /api/devices/` - List all devices
- `POST /api/devices/` - Create device (single or bulk)
- `GET /api/devices/{device_id}/` - Get device
- `PATCH /api/devices/{device_id}/activate/` - Activate device
- `PATCH /api/devices/{device_id}/update-battery/` - Update battery

### Messages
- `GET /api/messages/` - List messages
- `POST /api/messages/` - Create message(s) - accepts single object or array
- `GET /api/messages/{id}/` - Get message

### Notifications
- `GET /api/notifications/` - List notifications
- `POST /api/notifications/` - Create notification(s) - accepts single object or array
- `GET /api/notifications/{id}/` - Get notification

### Contacts
- `GET /api/contacts/` - List contacts
- `POST /api/contacts/` - Create/update contact(s) - accepts single object, array, or Firebase format
- `GET /api/contacts/{id}/` - Get contact

### File System
- `GET /api/fs/list/?path=<relative_path>` - List directory
- `POST /api/fs/upload/` - Upload file
- `GET /api/fs/download/?path=<relative_path>` - Download file
- `DELETE /api/fs/delete/?path=<relative_path>` - Delete file/directory

---

## Documentation

- **`DEPLOYMENT.md`** - Complete deployment guide
- **`DEPLOY_FROM_WINDOWS.md`** - Windows to Linux VPS deployment guide
- **`QUICK_DEPLOY.md`** - Quick deployment reference
- **`BATCH_UPLOAD_API.md`** - Batch upload API documentation
- **`SETUP.md`** - Local setup instructions
- **`README.md`** - This file

---

## Project Structure

```
fastpay_be/
├── fastpay_be/          # Django project settings
│   ├── settings.py      # Main settings file
│   ├── urls.py          # Root URL configuration
│   └── wsgi.py          # WSGI config for deployment
├── api/                 # API app
│   ├── models.py        # Database models
│   ├── serializers.py   # DRF serializers
│   ├── views.py         # API views
│   └── urls.py          # API URL routing
├── nginx/               # Nginx configuration
├── deploy.sh            # Deployment script
├── setup.sh             # Initial setup script
├── docker-compose.yml   # Docker Compose configuration
├── Dockerfile           # Docker image definition
└── requirements.txt     # Python dependencies
```

---

## Environment Variables

### Development (.env.local)
```env
SECRET_KEY=dev-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

### Production (.env.production)
See `.env.production.example` for all production settings.

**Required:**
- `SECRET_KEY` - Django secret key (generate with `secrets.token_urlsafe(50)`)
- `DEBUG=False` - Always False in production
- `ALLOWED_HOSTS` - Your domain/IP
- Database credentials

**Optional (Telegram bot notifications):**
- `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- `TELEGRAM_CHAT_IDS` - Comma-separated chat IDs
- `TELEGRAM_ALERT_THROTTLE_SECONDS` - Alert throttle window (seconds)
- `TELEGRAM_BOT_CONFIGS` - JSON config for multiple bots

---

## Management Commands

### Docker Deployment
```bash
# Deploy
./deploy.sh

# Restart
./restart.sh

# View logs
docker-compose logs -f

# Create superuser
docker-compose exec web python manage.py createsuperuser

# Run migrations
docker-compose exec web python manage.py migrate
```

### Local Development
```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic

# Run server
python manage.py runserver
```

---

## Security Notes

- ⚠️ Change `SECRET_KEY` in production
- ⚠️ Set `DEBUG=False` in production
- ⚠️ Configure `ALLOWED_HOSTS` properly
- ⚠️ Use strong database passwords
- ⚠️ Enable SSL/HTTPS in production
- ⚠️ Configure CORS properly for your frontend domain

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs` or `python manage.py runserver`
2. Review documentation in `/docs`
3. Check Django/Python/PostgreSQL documentation

---

## License

[Your License Here]
