# FastPay Deployment Process

**Structured reference:** For a single-command, step-by-step deploy flow, see **[docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md)**. From repo root, use **`./deploy.sh <staging|production> [options]`** as the main entry point.

This document adds detail on env files, backend options, and health monitor.

---

This process deploys:
- **Backend**: Django + Postgres + Nginx (Docker Compose)
- **Dashboard**: Vite build served by the same Nginx container

Two environments are supported: **production** and **staging**. Each environment uses its own env files and (optionally) its own dashboard build output directory.

---

## Prerequisites (server)

- Docker and Docker Compose (v2 or docker-compose)
- Node.js + npm (for dashboard build on the server)
- Repo present at production base (e.g. `/var/www/fastpay`; see [docs/VPS_DEPLOY_STRUCTURE.md](docs/VPS_DEPLOY_STRUCTURE.md))
- Staging: repo at e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`

---

## One-time setup

From repo root (see [docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md) for full setup):

```bash
chmod +x deploy.sh deploy-all.sh deploy-production.sh BACKEND/deploy.sh
chmod +x DASHBOARD_FASTPAY/deploy.sh DASHBOARD_REDPAY/deploy.sh
# Optional: chmod +x promote-from-staging.sh
```

---

## Environment configuration

### Backend env files

- Production: `BACKEND/.env.production` (in `/var/www/fastpay`)
- Staging: `BACKEND/.env.staging` (in your staging repo, e.g. FASTPAY_BASE or `/desktop/fastpay`)

Production:
```bash
cd /var/www/fastpay/BACKEND
cp .env.example .env.production
```

Staging:
```bash
cd /path/to/your/staging/repo/BACKEND
cp .env.example .env.staging
```

Update `ALLOWED_HOSTS`, database credentials, and any API keys for each environment.

### Dashboard env files

Vite reads environment variables per mode. Use **DASHBOARD_FASTPAY** (and **DASHBOARD_REDPAY** for RedPay).

- Production: `DASHBOARD_FASTPAY/.env.production` (in `/var/www/fastpay`)
- Staging: `DASHBOARD_FASTPAY/.env.staging` (in your staging repo)

Production:
```bash
cd /var/www/fastpay/DASHBOARD_FASTPAY
cp .env.example .env.production
```

Staging:
```bash
cd /path/to/your/staging/repo/DASHBOARD_FASTPAY
cp .env.example .env.staging
```

Update `VITE_API_BASE_URL` and Firebase config for each environment.

---

## Build dashboard

Use **DASHBOARD_FASTPAY** (FastPay) and **DASHBOARD_REDPAY** (RedPay). See [docs/VPS_DEPLOY_STRUCTURE.md](docs/VPS_DEPLOY_STRUCTURE.md) for layout.

### Production build (FastPay)

```bash
cd /var/www/fastpay/DASHBOARD_FASTPAY
npm ci --legacy-peer-deps
./deploy.sh production
```

### Staging build (FastPay + RedPay)

```bash
cd /path/to/your/staging/repo
./deploy-all.sh dashboard   # builds DASHBOARD_FASTPAY and DASHBOARD_REDPAY
```

Or per dashboard: `cd DASHBOARD_FASTPAY && ./deploy.sh staging` and `cd DASHBOARD_REDPAY && ./deploy.sh staging`.

---

## Deploy backend

### Production

```bash
cd /var/www/fastpay/BACKEND
ENV_FILE=.env.production ./deploy.sh production --no-input
```

### Staging

```bash
cd /path/to/your/staging/repo/BACKEND
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

Use the **single entry point** from repo root. See [docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md) for the full structured process.

### Production

```bash
cd /var/www/fastpay   # or set PRODUCTION_BASE to your repo path
./deploy.sh production --no-input --pull
```

Or directly: `./deploy-production.sh --no-input --pull`

### Staging deploy (simple steps)

Staging uses your staging repo (e.g. FASTPAY_BASE or `/desktop/fastpay`) and is served via host nginx.

1. **From repo root**, deploy with local code (no git pull by default):
   ```bash
   ./deploy.sh staging --no-input
   ```
   Or directly: `./deploy-all.sh --no-input`
   This builds the dashboards, deploys the backend with tests, and runs verification.

2. **On the staging server**, apply host nginx so public URLs work:
   ```bash
   sudo ./BACKEND/nginx/apply-staging-on-host.sh
   ```

3. **Check:** Open https://staging.fastpaygaming.com/, https://sredpay.fastpaygaming.com/, https://sapi.fastpaygaming.com/api/. Optionally run `./scripts/check-dns-a.sh` and `./BACKEND/scripts/check-staging-postdeploy.sh`.

Staging uses host nginx only (no Traefik). Full details: [BACKEND/nginx/STAGING_NGINX.md](BACKEND/nginx/STAGING_NGINX.md) and [docs/VPS_DEPLOY_STRUCTURE.md](docs/VPS_DEPLOY_STRUCTURE.md).

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

Optional: run `./scripts/check-production-ready.sh` from repo root for a single preflight + post-deploy check (DNS, HTTP, browser) without deploying. See [docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md) § 5.2.

For logs:

```bash
cd /var/www/fastpay/BACKEND
docker compose logs -f
```

---

## Rollback (simple)

1. Check out the previous commit (or restore a previous `dist/` build).
2. Re-run the deploy for that environment:

```bash
./deploy.sh production --no-input --pull
# or staging:
./deploy.sh staging --no-input
```

---

## Staging → Production Promotion

Use a controlled sync to update production code from staging before deploy:

```bash
cd /var/www/fastpay
STAGING_DIR=/path/to/staging ./promote-from-staging.sh   # optional: set if staging is elsewhere
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
cd /path/to/your/repo/health-monitor
cp health-monitor.env.example health-monitor.env
# Edit: add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS
chmod +x health-monitor.sh
# Add to cron: */5 * * * * /path/to/repo/health-monitor/health-monitor.sh
```

See `health-monitor/README.md` for full setup and systemd option.

---

## Notes

- The Nginx config for backend + dashboard is in `BACKEND/nginx/conf.d/fastpay.conf`.
- If you deploy dashboard builds from CI, skip dashboard build and set `DASHBOARD_DIST_PATH` to the uploaded build directory.
- For custom domains, update `server_name` and SSL paths in the Nginx config.
- Staging is served at `/test` and uses the host port `8001` for the staging backend.
