# FastPay Deployment Process

This process deploys:
- **Backend**: Django + Postgres + Nginx (Docker Compose)
- **Dashboard**: Vite build served by the same Nginx container

Two environments are supported: **production** and **staging**. Each environment uses its own env files and (optionally) its own dashboard build output directory.

---

## Prerequisites (server)

- Docker and Docker Compose (v2 or docker-compose)
- Node.js + npm (for dashboard build on the server)
- Repo present at `/opt/FASTPAY` (production)
- Staging directory name: **FASTPAY_BASE** at `/root/Desktop/FASTPAY_BASE` (not FASTPAY-staging)

---

## One-time setup

Production:
```bash
cd /opt/FASTPAY
chmod +x deploy-all.sh
chmod +x BACKEND/deploy.sh
chmod +x promote-from-staging.sh
```

Staging (directory **FASTPAY_BASE**):
```bash
cd /root/Desktop/FASTPAY_BASE
chmod +x BACKEND/deploy-staging.sh
chmod +x promote-from-staging.sh
```

---

## Environment configuration

### Backend env files

- Production: `BACKEND/.env.production` (in `/opt/FASTPAY`)
- Staging: `BACKEND/.env.staging` (in `/root/Desktop/FASTPAY_BASE`)

Production:
```bash
cd /opt/FASTPAY/BACKEND
cp .env.example .env.production
```

Staging:
```bash
cd /root/Desktop/FASTPAY_BASE/BACKEND
cp .env.example .env.staging
```

Update `ALLOWED_HOSTS`, database credentials, and any API keys for each environment.

### Dashboard env files

Vite reads environment variables per mode:
- Production: `DASHBOARD/.env.production` (in `/opt/FASTPAY`)
- Staging: `DASHBOARD/.env.staging` (in `/root/Desktop/FASTPAY_BASE`)

Production:
```bash
cd /opt/FASTPAY/DASHBOARD
cp .env.example .env.production
```

Staging:
```bash
cd /root/Desktop/FASTPAY_BASE/DASHBOARD
cp .env.example .env.staging
```

Update `VITE_API_BASE_URL` and Firebase config for each environment.

---

## Build dashboard

### Production build (default)

```bash
cd /opt/FASTPAY/DASHBOARD
npm install
VITE_BASE_PATH=/ npm run build -- --mode production
```

### Staging build (served at /test)

```bash
cd /root/Desktop/FASTPAY_BASE/DASHBOARD
npm install
VITE_BASE_PATH=/test/ npm run build -- --mode staging
```

Staging is served from `/test`, so the base path must be `/test/`.

---

## Deploy backend

### Production

```bash
cd /opt/FASTPAY/BACKEND
ENV_FILE=.env.production ./deploy.sh production --no-input
```

### Staging

```bash
cd /root/Desktop/FASTPAY_BASE/BACKEND
./deploy.sh staging --no-input --skip-tests
```

`deploy.sh` handles migrations, collectstatic, and starts containers.

### Backend deploy options (all 6)

| Option | Description |
|--------|-------------|
| `--no-input` | Skip superuser prompt and interactive prompts |
| `--skip-tests` | Skip Django test suite during deploy |
| `--skip-pull` | Do not run `git pull` (deploy current tree only) |
| `--no-rebuild` | Build Docker images using cache (faster) |
| `--skip-nginx-reload` | Skip nginx config validation/reload |
| `--test-pattern PATTERN` | Run only tests matching PATTERN (e.g. `api.tests.test_views`) |

Examples:

```bash
# Full deploy (pull + rebuild)
./deploy.sh staging --no-input

# Quick deploy: no git pull, use Docker cache
./deploy.sh staging --no-input --skip-pull --no-rebuild

# Skip tests and nginx reload
./deploy.sh staging --no-input --skip-tests --skip-nginx-reload
```

---

## One-command deployment (recommended)

This builds the dashboard and deploys the backend in one run.

### Production

```bash
cd /opt/FASTPAY
./deploy-all.sh production --no-input
```

### Staging is deployed separately

Staging uses the **FASTPAY_BASE** directory at `/root/Desktop/FASTPAY_BASE` (not FASTPAY-staging) and is served at `/test` on the same domain.

**Staging deploy at public URL (tested):** From repo root run `./deploy-all.sh --no-input` (runs dashboard build, backend deploy with tests, and verification of public URLs). On the staging server, run `sudo ./BACKEND/nginx/apply-staging-on-host.sh` once so host nginx serves https://staging.fastpaygaming.com/ and https://api-staging.fastpaygaming.com/. Full steps: see [BACKEND/nginx/STAGING_NGINX.md](BACKEND/nginx/STAGING_NGINX.md) section "Staging deploy at public URL (tested)".

---

## Verification

```bash
curl -I http://<server-ip>/health/
curl -I http://<server-ip>/api/
```

For production domains, also verify:

```bash
curl -Ik https://fastpaygaming.com/
curl -Ik https://api.fastpaygaming.com/api/
curl -Ik https://fastpaygaming.com/test/
curl -Ik https://fastpaygaming.com/test/api/
```

For logs:

```bash
cd /opt/FASTPAY/BACKEND
docker compose logs -f
```

---

## Rollback (simple)

1. Check out the previous commit (or restore a previous `dist/` build).
2. Re-run the deploy:

```bash
cd /opt/FASTPAY
./deploy-all.sh production --no-input
```

---

## Staging → Production Promotion

Use a controlled sync to update production code from staging before deploy:

```bash
cd /opt/FASTPAY
./promote-from-staging.sh
```

Preview changes first:

```bash
./promote-from-staging.sh --dry-run
```

The promotion script excludes env files, runtime data, and build artifacts.

---

## Health monitor (optional)

To get Telegram alerts when dashboard or backend goes down:

```bash
cd /root/Desktop/FASTPAY_BASE/health-monitor
cp health-monitor.env.example health-monitor.env
# Edit: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS
chmod +x health-monitor.sh
# Add to cron: */5 * * * * /root/Desktop/FASTPAY_BASE/health-monitor/health-monitor.sh
```

See `health-monitor/README.md` for full setup and systemd option.

---

## Notes

- The Nginx config for backend + dashboard is in `BACKEND/nginx/conf.d/fastpay.conf`.
- If you deploy dashboard builds from CI, skip dashboard build and set `DASHBOARD_DIST_PATH` to the uploaded build directory.
- For custom domains, update `server_name` and SSL paths in the Nginx config.
- Staging is served at `/test` and uses the host port `8001` for the staging backend.
