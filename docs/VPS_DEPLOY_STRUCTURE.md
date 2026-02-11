# VPS deploy structure – staging and production

This doc describes where code and config live on the server for **staging** and **production**, which URLs serve which part of the app after deploy, how to sync from GitHub, and the full deploy process.

---

## 1. Target layout

### Production (VPS)

Base path: **`/var/www/fastpay/`**

```
/var/www/fastpay/
├── BACKEND/                    # Backend app, deploy.sh, .env.production, Docker Compose
├── DASHBOARD_FASTPAY/          # FastPay dashboard source + dist/ + .env.production
└── DASHBOARD_REDPAY/           # RedPay dashboard source + dist/ + .env.production
```

- **BACKEND** — Django app, `deploy.sh`, `.env.production`, Docker Compose. Backend data (DB, static, media) via Docker volumes or e.g. `/var/lib/fastpay/production/` if bind-mounted.
- **DASHBOARD_FASTPAY** — FastPay dashboard repo copy; after build, `dist/` is served by nginx. Env: `.env.production`.
- **DASHBOARD_REDPAY** — RedPay dashboard repo copy; `dist/` and `.env.production` (or `.env.redpay-prod`).

### Staging

Base path: **`/desktop/fastpay/`**

```
/desktop/fastpay/
├── BACKEND/                    # Backend app, .env.staging, docker-compose.staging
├── DASHBOARD_FASTPAY/          # FastPay dashboard source + dist/ + .env.staging
└── DASHBOARD_REDPAY/           # RedPay dashboard source + dist/ + .env.staging
```

Same three directories; env files use `.env.staging` (and optionally `.env.redpay` for RedPay staging).

### Summary table

| Environment | Base path           | BACKEND               | DASHBOARD_FASTPAY           | DASHBOARD_REDPAY            |
| ----------- | ------------------- | --------------------- | --------------------------- | --------------------------- |
| Production  | `/var/www/fastpay/` | `BACKEND/`            | `DASHBOARD_FASTPAY/`        | `DASHBOARD_REDPAY/`         |
| Staging     | `/desktop/fastpay/` | `BACKEND/`            | `DASHBOARD_FASTPAY/`        | `DASHBOARD_REDPAY/`         |

---

## 2. URLs after deploy – which URL shows what

After deploy, use these URLs to reach each part of the app. Adjust if your nginx `server_name` or domains differ.

### Staging

| URL | What it serves |
| ----- | ----------------- |
| `https://staging.fastpaygaming.com/` | FastPay dashboard (DASHBOARD_FASTPAY build) |
| `https://axisurgent.fastpaygaming.com/` | AXISURGENT app (redirects to `/axisurgent`) |
| `https://api-staging.fastpaygaming.com/api/` | Backend API |
| `https://admin-staging.fastpaygaming.com/admin/` | Django admin |
| (If RedPay has a dedicated staging URL, add it here) | RedPay dashboard |

### Production

| URL | What it serves |
| ----- | ----------------- |
| `https://fastpaygaming.com/` (and `www`) | FastPay dashboard (DASHBOARD_FASTPAY build) |
| `https://api.fastpaygaming.com/api/` | Backend API |
| `https://api.fastpaygaming.com/admin/` (or admin subdomain) | Django admin |
| `https://owner.fastpaygaming.com/` | Owner app (if deployed) |
| `https://redpay.fastpaygaming.com/` (or your RedPay domain) | RedPay dashboard (if deployed) |

---

## 3. Nginx – where the built dashboard is served from

- **Production:** Main FastPay dashboard is served from `root /var/www/fastpay/DASHBOARD_FASTPAY/dist`. If RedPay has its own vhost, use `root /var/www/fastpay/DASHBOARD_REDPAY/dist` for that server block.
- **Staging:** Dashboard is served by the staging nginx container, which mounts the build from the host. The container’s docroot is fed from **`/desktop/fastpay/DASHBOARD_FASTPAY/dist`** (set via `STAGING_DASHBOARD_DIST_PATH` in BACKEND env). Host nginx proxies `staging.fastpaygaming.com` to that container (e.g. port 8888).

See **BACKEND/nginx/STAGING_NGINX.md** and **BACKEND/nginx/** configs for full nginx setup. For Gmail/Drive OAuth, see **BACKEND/docs/GMAIL_DRIVE_DEPLOY.md**.

---

## 4. GitHub sync

Before building or deploying, sync the repo at the environment base path using the dedicated script.

### When to run

- **Staging:** Before a full deploy from `/desktop/fastpay`, or let `deploy-all.sh --pull` call it.
- **Production:** Before a full deploy from `/var/www/fastpay`.

### How to run

From **repo root** (or set `REPO_BASE` / `FASTPAY_DEPLOY_BASE` to the base path):

```bash
# Staging (default branch: main)
./scripts/sync-from-github.sh staging [--branch main]

# Production (branch or tag)
./scripts/sync-from-github.sh production [--branch production]
./scripts/sync-from-github.sh production [--tag v1.2.3]

# Optional: deploy a specific commit
./scripts/sync-from-github.sh production --commit <sha>

# Only checkout, do not pull (e.g. after clone)
./scripts/sync-from-github.sh staging --skip-pull

# Only clone if directory missing; do not pull when dir exists
./scripts/sync-from-github.sh staging --clone-only
```

### Environment variables (optional)

- **REPO_BASE** or **FASTPAY_DEPLOY_BASE** — Override base path (default: `/desktop/fastpay` for staging, `/var/www/fastpay` for production).
- **GITHUB_REPO_URL** — Clone URL (if unset, script uses `origin` URL from the repo that contains the script).
- **GITHUB_STAGING_BRANCH** — Default branch for staging (default: `main`).
- **GITHUB_PRODUCTION_BRANCH** — Default branch for production (default: `main`).

The script will **clone** the monorepo into the base path if it does not exist, or **fetch and checkout** (and optionally **pull**) if it already exists.

---

## 5. Env file locations

| Environment | Base path           | BACKEND env               | DASHBOARD_FASTPAY env               | DASHBOARD_REDPAY env                     |
| ----------- | ------------------- | ------------------------- | ------------------------------------ | ---------------------------------------- |
| Production  | `/var/www/fastpay/` | `BACKEND/.env.production` | `DASHBOARD_FASTPAY/.env.production`  | `DASHBOARD_REDPAY/.env.production` or `.env.redpay-prod` |
| Staging     | `/desktop/fastpay/` | `BACKEND/.env.staging`    | `DASHBOARD_FASTPAY/.env.staging`     | `DASHBOARD_REDPAY/.env.staging` or `.env.redpay`         |

All paths are under the environment base path. Copy from `.env.example` in each project and fill values.

---

## 6. Complete deploy process

All commands assume you are using the **correct base path** for the environment (`/desktop/fastpay` for staging, `/var/www/fastpay` for production). For staging, run from **`/desktop/fastpay`** (or set `REPO_ROOT`/script vars to that path).

### 6.1 First-time setup (per environment)

**Staging (base: `/desktop/fastpay`):**

1. Create base dir: `mkdir -p /desktop/fastpay && cd /desktop/fastpay`
2. Get code: run `./scripts/sync-from-github.sh staging` from repo root (or clone the monorepo so that `BACKEND/`, `DASHBOARD_FASTPAY/`, `DASHBOARD_REDPAY/` exist under `/desktop/fastpay/`).
3. Env files: copy and fill from `.env.example` in each project:
   - `BACKEND/.env.staging`
   - `DASHBOARD_FASTPAY/.env.staging`
   - `DASHBOARD_REDPAY/.env.staging` (or `.env.redpay`)
4. Backend: ensure Docker/Docker Compose is installed. In `BACKEND/.env.staging` set `STAGING_DASHBOARD_DIST_PATH=/desktop/fastpay/DASHBOARD_FASTPAY/dist` (or `../DASHBOARD_FASTPAY/dist`).
5. (Optional) Host nginx: if staging is exposed via host nginx, run `sudo BACKEND/nginx/apply-staging-on-host.sh` from repo root; ensure certs/ACME as in **BACKEND/nginx/STAGING_NGINX.md**.

**Production (base: `/var/www/fastpay`):**

1. Create base dir: `sudo mkdir -p /var/www/fastpay && cd /var/www/fastpay`
2. Get code: run `./scripts/sync-from-github.sh production` from repo root (or clone so that `BACKEND/`, `DASHBOARD_FASTPAY/`, `DASHBOARD_REDPAY/` exist).
3. Env files: create and fill:
   - `BACKEND/.env.production`
   - `DASHBOARD_FASTPAY/.env.production`
   - `DASHBOARD_REDPAY/.env.production` (or `.env.redpay-prod`)
4. Backend: set `DASHBOARD_DIST_PATH=/var/www/fastpay/DASHBOARD_FASTPAY/dist` (and RedPay path if used) in `BACKEND/.env.production` or in the compose invocation.
5. Nginx: install configs that use `root /var/www/fastpay/DASHBOARD_FASTPAY/dist` (and RedPay vhost if needed); SSL as per BACKEND/nginx docs.

### 6.2 Staging full deploy (from `/desktop/fastpay`)

1. **Sync from GitHub (recommended):**  
   From repo root (or with `REPO_BASE=/desktop/fastpay`):  
   `./scripts/sync-from-github.sh staging [--branch main]`  
   Or manually: `cd /desktop/fastpay && git pull origin main`.
2. **Build FastPay dashboard:**  
   `cd /desktop/fastpay/DASHBOARD_FASTPAY && npm ci && ./deploy.sh staging`  
   → produces `dist/`.
3. **Build RedPay dashboard (if used):**  
   `cd /desktop/fastpay/DASHBOARD_REDPAY && npm ci && ./deploy.sh staging`  
   → produces `dist/`.
4. **Deploy backend:**  
   `cd /desktop/fastpay/BACKEND && ./deploy.sh staging [--no-input] [--skip-tests]`  
   → uses `.env.staging`, mounts `STAGING_DASHBOARD_DIST_PATH` (e.g. `/desktop/fastpay/DASHBOARD_FASTPAY/dist`) in staging nginx container.
5. **Apply host nginx (if used):**  
   `sudo /desktop/fastpay/BACKEND/nginx/apply-staging-on-host.sh`
6. **Verify:**  
   - Backend: `curl -s http://localhost:8001/health/`  
   - Dashboard: open https://staging.fastpaygaming.com/ (or your proxy target)  
   - API: `curl -s https://api-staging.fastpaygaming.com/api/`

**Single-command staging (if using deploy-all.sh):**  
From `/desktop/fastpay`, run `./deploy-all.sh [all|dashboard|backend] [--pull] [--skip-tests] [--no-input]`. With `--pull`, deploy-all.sh runs `./scripts/sync-from-github.sh staging` first (when the script is in repo root).

### 6.3 Production full deploy (from `/var/www/fastpay`)

1. **Sync from GitHub (recommended):**  
   `./scripts/sync-from-github.sh production [--branch production]` or `[--tag v1.2.3]`  
   Or manually: `cd /var/www/fastpay && git pull origin main` (or your production branch).
2. **Build FastPay dashboard:**  
   `cd /var/www/fastpay/DASHBOARD_FASTPAY && npm ci && ./deploy.sh production`  
   → produces `dist/`.
3. **Build RedPay dashboard (if used):**  
   `cd /var/www/fastpay/DASHBOARD_REDPAY && npm ci && ./deploy.sh production`  
   → produces `dist/`.
4. **Deploy backend:**  
   `cd /var/www/fastpay/BACKEND && ./deploy.sh production [--no-input] [--skip-tests]`  
   → uses `.env.production`; nginx (Docker or host) serves from `DASHBOARD_FASTPAY/dist` and optionally `DASHBOARD_REDPAY/dist`.
5. **Reload host nginx (if serving static from host):**  
   `sudo nginx -t && sudo systemctl reload nginx`
6. **Verify:**  
   Backend health, API URL, and dashboard URLs (main and RedPay if applicable).

### 6.4 Partial redeploys

- **Dashboard only (staging):**  
  `cd /desktop/fastpay/DASHBOARD_FASTPAY && ./deploy.sh staging`  
  Then restart staging nginx container if needed:  
  `cd /desktop/fastpay/BACKEND && docker compose -f docker-compose.staging.yml -p fastpay-staging restart nginx`
- **Dashboard only (production):**  
  `cd /var/www/fastpay/DASHBOARD_FASTPAY && ./deploy.sh production`  
  Reload host nginx if it serves from that dist.
- **Backend only:**  
  `cd <base>/BACKEND && ./deploy.sh staging` or `./deploy.sh production` (no dashboard build).

---

## References

- **BACKEND/nginx/STAGING_NGINX.md** — Staging nginx layout and apply script.
- **BACKEND/docs/GMAIL_DRIVE_DEPLOY.md** — Gmail/Drive OAuth for staging and production.
