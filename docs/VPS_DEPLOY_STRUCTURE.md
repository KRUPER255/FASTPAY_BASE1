# VPS deploy structure – staging and production

This doc describes where code and config live on the server for **staging** and **production**, which URLs serve which part of the app after deploy, how to sync from GitHub, and the full deploy process.

**Quick links:** Staging deploy steps (user-friendly) → [§ 6.1 Staging deploy](#61-staging-deploy-user-friendly-steps). Production → [§ 6.4 Production full deploy](#64-production-full-deploy-from-varwwwfastpay).

### Path convention

| Environment | Base location | Canonical path |
| ----------- | -------------- | --------------- |
| **Production** | Under `/var/www` | `/var/www/fastpay/` |
| **Staging** | On Desktop | e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay` |

Same layout (BACKEND/, DASHBOARD_FASTPAY/, DASHBOARD_REDPAY/) in both; only the base path differs.

### FASTPAY_DEPLOY (dist and config storage)

**Public URLs only change when we change FASTPAY_DEPLOY.** Development at FASTPAY_BASE does not affect what is live until a successful deploy runs.

| Path | Purpose |
|------|---------|
| `/var/www/FASTPAY_DEPLOY/` | Central storage for dist and deployed config |
| `dist/staging/{fastpay,redpay}` | Built dashboards for staging (staging.fastpaygaming.com, sredpay) |
| `dist/production/{fastpay,redpay}` | Built dashboards for production (fastpaygaming.com, redpay) |
| `config/staging/backend.env` | Deployed backend config for staging |
| `config/production/backend.env` | Deployed backend config for production |

On successful deploy, `deploy-all.sh` (staging) and `deploy-production.sh` (production) rsync dist and copy backend .env to FASTPAY_DEPLOY. Nginx and Docker serve from there.

---

## Dashboard apps in this repo

- **DASHBOARD_FASTPAY** — **Common reference (core).** Canonical FastPay dashboard; primary build for staging/production (deploy-all.sh); nginx serves its `dist/`.
- **DASHBOARD_REDPAY** — RedPay variant; built and deployed separately (e.g. RedPay domain).

For dashboard development, edit **DASHBOARD_FASTPAY** (core) or **DASHBOARD_REDPAY** (RedPay). See sections below for deploy layout and URLs.

### Build matrix

| Dashboard | Staging env | Production env | Main URL (staging) | Main URL (production) |
| --------- | ----------- | --------------- | ------------------- | ---------------------- |
| **DASHBOARD_FASTPAY** | `.env.staging` (no `VITE_REDPAY_ONLY` or `false`) | `.env.production` (same) | `https://staging.fastpaygaming.com/` | `https://fastpaygaming.com/` |
| **DASHBOARD_REDPAY** | `.env.staging` with `VITE_REDPAY_ONLY=true` | `.env.production` with `VITE_REDPAY_ONLY=true` | `https://sredpay.fastpaygaming.com/` | `https://redpay.fastpaygaming.com/` |

RedPay builds must set **`VITE_REDPAY_ONLY=true`** at build time so the bundle boots the RedPay-only app (login + minimal dashboard). DASHBOARD_REDPAY’s `deploy.sh` sets this when not already set by the env file. For keeping both dashboards in sync when editing shared code, see [docs/DASHBOARD_SYNC.md](DASHBOARD_SYNC.md).

---

## 1. Target layout

### Production (VPS)

Base path: **`/var/www/fastpay/`**

```
/var/www/fastpay/
├── BACKEND/                    # Backend app, deploy.sh, .env.production, Docker Compose
│   └── nginx/                  # Nginx configs (see “Where is nginx?” below)
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
│   └── nginx/                  # Nginx configs (see “Where is nginx?” below)
├── DASHBOARD_FASTPAY/          # FastPay dashboard source + dist/ + .env.staging
└── DASHBOARD_REDPAY/           # RedPay dashboard source + dist/ + .env.staging
```

Same three directories; env files use `.env.staging` (and optionally `.env.redpay` for RedPay staging).

### Where is nginx?

**In the repo:** Nginx configs live under **`BACKEND/nginx/`** (same for both environments). That folder is not a separate top-level app; it sits inside BACKEND.

```
BACKEND/
├── nginx/
│   ├── nginx.conf              # Main config (used by Docker nginx container)
│   ├── conf.d/
│   │   ├── production/         # Production server blocks (fastpaygaming.com, api, admin, redpay)
│   │   └── staging/            # Staging server blocks (staging, sapi, sadmin, sredpay)
│   ├── html/                   # Static HTML (api index, welcome, join)
│   ├── apply-staging-on-host.sh   # Copy staging configs to host nginx
│   ├── apply-prod-api-admin-redpay-welcome.sh
│   └── README.md, STAGING_NGINX.md, ...
├── deploy.sh
├── docker-compose.yml
├── docker-compose.staging.yml
└── ...
```

**At runtime there are two nginx roles:**

| Role | Where | Purpose |
|------|--------|--------|
| **Docker nginx (staging)** | Container started by `docker-compose.staging.yml` (inside BACKEND) | Serves FastPay/RedPay from mounted `FASTPAY_DEPLOY/dist/staging/{fastpay,redpay}`, listens on port 8888. |
| **Host nginx** | System nginx on the server (`/etc/nginx/`) | Terminates SSL and proxies public hostnames (staging.fastpaygaming.com, sapi, sadmin, sredpay, and production api/admin/redpay) to the right backends (e.g. 8888, 8001) or serves static from `FASTPAY_DEPLOY/dist/`. Configs are **copied** from `BACKEND/nginx/conf.d/staging` or `conf.d/production` using the apply scripts. |

### Summary table

| Environment | Base path           | BACKEND               | DASHBOARD_FASTPAY           | DASHBOARD_REDPAY            |
| ----------- | ------------------- | --------------------- | --------------------------- | --------------------------- |
| Production  | `/var/www/fastpay/` | `BACKEND/`            | `DASHBOARD_FASTPAY/`        | `DASHBOARD_REDPAY/`         |
| Staging     | `/desktop/fastpay/` | `BACKEND/`            | `DASHBOARD_FASTPAY/`        | `DASHBOARD_REDPAY/`         |

---

## 2. URLs after deploy – which URL shows what

**All URLs below point to this VPS** (domain `fastpaygaming.com` and its subdomains). Staging and production live on the same host; nginx and DNS distinguish by subdomain. Adjust only if you use a different domain.

After deploy, use these URLs to reach each part of the app:

### Staging

| URL | What it serves |
| ----- | ----------------- |
| `https://staging.fastpaygaming.com/` | FastPay dashboard (DASHBOARD_FASTPAY build) |
| `https://sredpay.fastpaygaming.com/` | RedPay dashboard (host nginx serves from `/var/www/FASTPAY_DEPLOY/dist/staging/redpay`) |
| `https://sapi.fastpaygaming.com/api/` | Backend API |
| `https://sadmin.fastpaygaming.com/admin/` | Django admin |

### Production

| URL | What it serves |
| ----- | ----------------- |
| `https://fastpaygaming.com/` (and `www`) | FastPay dashboard (DASHBOARD_FASTPAY build) |
| `https://api.fastpaygaming.com/api/` | Backend API |
| `https://api.fastpaygaming.com/admin/` (or admin subdomain) | Django admin |
| `https://redpay.fastpaygaming.com/` (or your RedPay domain) | RedPay dashboard (if deployed) |

**Note:** `https://owner.fastpaygaming.com/` is not on this VPS; it is a separate deployment.

---

## 3. Nginx – where the built dashboard is served from

- **Production:** Main FastPay dashboard is served from `root /var/www/fastpay/DASHBOARD_FASTPAY/dist`. If RedPay has its own vhost, use `root /var/www/fastpay/DASHBOARD_REDPAY/dist` for that server block.
- **Staging:** FastPay dashboard is served by the staging nginx container, which mounts **`/desktop/fastpay/DASHBOARD_FASTPAY/dist`** (set via `STAGING_DASHBOARD_DIST_PATH` in BACKEND env). Host nginx proxies `staging.fastpaygaming.com` to that container (port 8888). RedPay staging is served directly by host nginx from **`/desktop/fastpay/DASHBOARD_REDPAY/dist`** at `sredpay.fastpaygaming.com` (see `BACKEND/nginx/conf.d/staging/04-redpay.conf`, deployed as `staging-04-redpay.conf`).

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

| Environment | Base path           | BACKEND env (edit in repo) | Deployed config (updated on deploy) |
| ----------- | ------------------- | -------------------------- | ----------------------------------- |
| Production  | `/var/www/fastpay/` | `BACKEND/.env.production`  | `FASTPAY_DEPLOY/config/production/backend.env` |
| Staging     | `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay/` | `BACKEND/.env.staging` | `FASTPAY_DEPLOY/config/staging/backend.env` |

Dashboard env: `DASHBOARD_FASTPAY/.env.{staging|production}` and `DASHBOARD_REDPAY/.env.{staging|production}` (build-time only; values baked into dist).

Set `FASTPAY_DEPLOY_BASE=/var/www/FASTPAY_DEPLOY` in BACKEND `.env.staging` and `.env.production`. Create structure: `sudo ./scripts/create-fastpay-deploy-dirs.sh`.

---

## 6. Complete deploy process

### 6.1 Staging deploy (user-friendly steps)

**Where to run:** From your staging repo root (e.g. `/desktop/fastpay` or your clone). Staging uses **local code only**—no git pull unless you choose to.

**Before you start (first time only):**
- Docker and Docker Compose installed.
- Env files exist: `BACKEND/.env.staging`, `DASHBOARD_FASTPAY/.env.staging`, `DASHBOARD_REDPAY/.env.staging` (copy from `.env.example` in each folder and fill in).
- Create FASTPAY_DEPLOY structure: `sudo ./scripts/create-fastpay-deploy-dirs.sh`. In `BACKEND/.env.staging` set `FASTPAY_DEPLOY_BASE=/var/www/FASTPAY_DEPLOY`.

**Option A — One command (recommended)**

From the repo root:

```bash
./deploy-all.sh --no-input
```

This will:
1. Build the FastPay dashboard (and RedPay if present).
2. Deploy the backend (Django, DB, Redis, nginx in Docker) using your local code.
3. Run tests and show verification results.

Then **on the server** (so the public URLs work), run once or after nginx config changes:

```bash
sudo ./BACKEND/nginx/apply-staging-on-host.sh
```

**Option B — Step by step**

| Step | What to do | Command |
|------|------------|--------|
| 1 | (Optional) Update code from GitHub | `./scripts/sync-from-github.sh staging` or `git pull origin main` |
| 2 | Build FastPay dashboard | `cd DASHBOARD_FASTPAY && npm ci && ./deploy.sh staging` |
| 3 | Build RedPay dashboard (if you use it) | `cd DASHBOARD_REDPAY && npm ci && ./deploy.sh staging` |
| 4 | Deploy backend (local code only) | `cd BACKEND && ./deploy.sh staging --no-input` |
| 5 | On the server: apply host nginx | `sudo ./BACKEND/nginx/apply-staging-on-host.sh` |
| 6 | Verify | See “Verify” below |

**Verify after deploy**

- Local backend: `curl -s http://localhost:8001/health/` → should print `ok`.
- In browser: https://staging.fastpaygaming.com/ (FastPay), https://sredpay.fastpaygaming.com/ (RedPay), https://sapi.fastpaygaming.com/api/ (API).
- Automated checks run automatically at end of `deploy-all.sh`. Or run manually (from repo root):  
  `./BACKEND/scripts/check-staging-postdeploy.sh`. If any fail, deploy is treated as failed.

**Useful options for deploy-all.sh**

- `./deploy-all.sh --no-input` — Non-interactive; no prompts.
- `./deploy-all.sh --skip-tests` — Skip backend tests (faster).
- `./deploy-all.sh --pull` — Update from GitHub first, then deploy (otherwise staging uses local code only).
- `./deploy-all.sh dashboard` — Only build dashboards (no backend).
- `./deploy-all.sh backend` — Only deploy backend (no dashboard build).

---

### 6.2 First-time setup (per environment)

**One-command first-time setup (recommended):**

- **Staging (on Desktop):**  
  `./scripts/setup-staging-first-time.sh`  
  (or `STAGING_BASE=/path/to/staging ./scripts/setup-staging-first-time.sh` from any clone)
- **Production (under /var/www):**  
  `PRODUCTION_BASE=/var/www/fastpay ./scripts/setup-production-first-time.sh`  
  (run from any clone; or on server: clone once then `cd /var/www/fastpay && ./scripts/setup-production-first-time.sh`)

These scripts: create base dir, clone repo (if needed), create `.env.staging` / `.env.production` from `.env.example`, set dashboard dist paths, make deploy scripts executable, and create `/var/www/certbot` for production. **Database (PostgreSQL + Redis)** is created automatically by Docker on first deploy. After setup, edit the env files with real secrets, then run the deploy script.

**Manual equivalent – Staging (base: `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`):**

1. Create base dir and get code (or clone the monorepo).
2. Create FASTPAY_DEPLOY structure: `sudo ./scripts/create-fastpay-deploy-dirs.sh`
3. Env files: copy and fill from `.env.example` in each project: `BACKEND/.env.staging`, `DASHBOARD_FASTPAY/.env.staging`, `DASHBOARD_REDPAY/.env.staging`.
4. In `BACKEND/.env.staging` set `FASTPAY_DEPLOY_BASE=/var/www/FASTPAY_DEPLOY`.
5. (Optional) Host nginx: `sudo BACKEND/nginx/apply-staging-on-host.sh`; see **BACKEND/nginx/STAGING_NGINX.md**.

**Manual equivalent – Production (base: `/var/www/fastpay`):**

1. Create base dir: `sudo mkdir -p /var/www/fastpay && cd /var/www/fastpay`
2. Get code: run `./scripts/sync-from-github.sh production` from repo root (or clone).
3. Env files: create from `.env.example`: `BACKEND/.env.production`, `DASHBOARD_FASTPAY/.env.production`, `DASHBOARD_REDPAY/.env.production`.
4. In `BACKEND/.env.production` set `FASTPAY_DEPLOY_BASE=/var/www/FASTPAY_DEPLOY`.
5. Nginx: install configs from BACKEND/nginx; SSL as per BACKEND/nginx docs.

### 6.3 Staging full deploy (reference)

Manual equivalent of deploy-all for staging (from `/desktop/fastpay`):

1. (Optional) Sync: `./scripts/sync-from-github.sh staging` or `git pull origin main`
2. Build FastPay: `cd DASHBOARD_FASTPAY && npm ci && ./deploy.sh staging`
3. Build RedPay (if used): `cd DASHBOARD_REDPAY && npm ci && ./deploy.sh staging`
4. Deploy backend: `cd BACKEND && ./deploy.sh staging [--no-input] [--skip-tests]` (staging always uses local code)
5. On server: `sudo ./BACKEND/nginx/apply-staging-on-host.sh`
6. Verify: `curl -s http://localhost:8001/health/`, open https://staging.fastpaygaming.com/. Post-deploy checks (DNS, HTTP, browser console) run automatically at end of deploy; or run `./BACKEND/scripts/check-staging-postdeploy.sh` manually.

### 6.4 Production full deploy (from `/var/www/fastpay`)

**One command (fetch from GitHub then deploy):**

```bash
cd /var/www/fastpay && ./scripts/deploy-production-from-github.sh
```

Optional: `--branch NAME`, `--tag TAG`, `--commit SHA`, `--skip-tests`, `--skip-redpay`, `dashboard` / `backend` / `all`. See `scripts/deploy-production-from-github.sh` for usage.

**Manual steps (equivalent):**

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
   Backend health, API URL, and dashboard URLs. Run `./BACKEND/scripts/check-production-postdeploy.sh` for automated checks.

### 6.5 Partial redeploys

- **Dashboard only (staging):**  
  `cd /desktop/fastpay/DASHBOARD_FASTPAY && ./deploy.sh staging`  
  Then restart staging nginx container if needed:  
  `cd /desktop/fastpay/BACKEND && docker compose -f docker-compose.staging.yml -p fastpay-staging restart nginx`
- **Dashboard only (production):**  
  `cd /var/www/fastpay/DASHBOARD_FASTPAY && ./deploy.sh production`  
  Reload host nginx if it serves from that dist.
- **Backend only:**  
  `cd <base>/BACKEND && ./deploy.sh staging` or `./deploy.sh production` (no dashboard build).

### 6.6 Post-deploy checks (automated)

Staging and production post-deploy scripts run DNS, HTTP status, and **browser console** checks:

- **Staging:** `./BACKEND/scripts/check-staging-postdeploy.sh`
- **Production:** `./BACKEND/scripts/check-production-postdeploy.sh`

**Single production check (no deploy):** From repo root, `./scripts/check-production-ready.sh` runs preflight plus post-deploy checks for a quick production “freshen up”. Use `PRODUCTION_BASE=/var/www/fastpay` when run from another clone.

The browser console check uses Playwright (headless Chromium) to load dashboard URLs and fail if any JavaScript console errors or uncaught exceptions occur (e.g. `VITE_API_BASE_URL is not set`).

**One-time setup for browser checks:** From repo root, run once per environment:

```bash
cd BACKEND/scripts/deploy-checks && npm install && npx playwright install chromium
```

The post-deploy scripts will auto-install on first run if Node is available. If Node/Playwright is not installed, the browser check is skipped with a warning. Use `SKIP_BROWSER_CHECK=1` to skip explicitly.

---

## References

- **BACKEND/nginx/STAGING_NGINX.md** — Staging nginx layout and apply script.
- **BACKEND/docs/GMAIL_DRIVE_DEPLOY.md** — Gmail/Drive OAuth for staging and production.
