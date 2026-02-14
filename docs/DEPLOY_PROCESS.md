# FastPay – Structured Deploy Process (Staging & Production)

This document is the **single reference** for how to deploy FastPay: same structure for both environments, with clear steps and verification.

---

## Best method (recommended flow)

**Staging (on the server where you want public URLs):**
```bash
cd /path/to/repo   # e.g. /desktop/fastpay or FASTPAY_BASE
./deploy.sh staging --no-input --apply-nginx
```
If nginx apply needs sudo password, run once: `sudo ./BACKEND/nginx/apply-staging-on-host.sh`

**Production (on the production server):**
```bash
cd /var/www/fastpay
./deploy.sh production --no-input --pull
sudo nginx -t && sudo systemctl reload nginx   # if host nginx serves static
```

Use the same layout (BACKEND/, DASHBOARD_FASTPAY/, DASHBOARD_REDPAY/) and the single entry point `./deploy.sh`; only the environment and options differ.

---

## 1. Quick reference

| Item | Staging | Production |
|------|---------|-------------|
| **Base path** | **Desktop** (e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`) | **/var/www** (canonical: `/var/www/fastpay`; or set `PRODUCTION_BASE`) |
| **One command** | `./deploy.sh staging --no-input` | `./deploy.sh production --no-input --pull` |
| **Backend env** | `BACKEND/.env.staging` | `BACKEND/.env.production` |
| **Dashboard env** | `DASHBOARD_FASTPAY/.env.staging`, `DASHBOARD_REDPAY/.env.staging` | `DASHBOARD_FASTPAY/.env.production`, `DASHBOARD_REDPAY/.env.production` |
| **Sync script** | `./scripts/sync-from-github.sh staging` | `./scripts/sync-from-github.sh production` |
| **After deploy (public URLs)** | Apply host nginx on server: `sudo ./BACKEND/nginx/apply-staging-on-host.sh` — or run deploy on server with `--apply-nginx` | `sudo nginx -t && sudo systemctl reload nginx` (if host serves static) |
| **Backend compose project** | `fastpay-staging` | `fastpay-production` |
| **Backend DB / env** | Dedicated DB and credentials in `.env.staging`; loaded and exported for compose. | Same: dedicated DB and credentials in `.env.production`; loaded and exported for compose. Use `WEB_PORT` in `.env.production` if port 8000 is in use (e.g. `WEB_PORT=8002`). |

**Entry point:** From repo root, use **`./deploy.sh <staging|production> [target] [options]`**.  
Target: `all` (default), `dashboard`, or `backend`.

**Path convention (same layout, different base):** **Production** lives under **/var/www** (canonical: `/var/www/fastpay`). **Staging** lives on **Desktop** (e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`). Same layout (BACKEND/, DASHBOARD_FASTPAY/, DASHBOARD_REDPAY/) in both. See [VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md).

---

## 2. Prerequisites (per server)

- **Docker** and **Docker Compose** (v2 or `docker-compose`)
- **Node.js** and **npm** (for dashboard build)
- Repo present at the environment base path (see table above)

---

## 3. One-time setup

Use the **first-time setup scripts** to create the base dir, clone the repo, create env files from `.env.example`, set dashboard paths, and make scripts executable. Database (PostgreSQL + Redis) is created by Docker on first deploy.

### 3.1 Staging

**Recommended:** From any clone (e.g. your Desktop repo):
```bash
./scripts/setup-staging-first-time.sh
```
Or for a specific path: `STAGING_BASE=/desktop/fastpay ./scripts/setup-staging-first-time.sh`

Then:
1. Edit `BACKEND/.env.staging` (SECRET_KEY, DB_*, FIREBASE_*, `STAGING_DASHBOARD_DIST_PATH` is set by the script).
2. Edit `DASHBOARD_FASTPAY/.env.staging` and `DASHBOARD_REDPAY/.env.staging` (VITE_API_BASE_URL, VITE_FIREBASE_CONFIG).
3. (Optional) Telegram: add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_IDS` to `BACKEND/.env.staging`.

### 3.2 Production

**Recommended:** From any clone or on the server:
```bash
PRODUCTION_BASE=/var/www/fastpay ./scripts/setup-production-first-time.sh
```
On the server after a one-time clone: `cd /var/www/fastpay && ./scripts/setup-production-first-time.sh`

Then:
1. Edit `BACKEND/.env.production` (SECRET_KEY, DB_PASSWORD, FIREBASE_*, ALLOWED_HOSTS, CORS, etc.).
2. Edit `DASHBOARD_FASTPAY/.env.production` and `DASHBOARD_REDPAY/.env.production`.
3. Place Firebase credentials at the path set in `FIREBASE_CREDENTIALS_PATH`.
4. Ensure nginx (host or Docker) is configured to serve from `DASHBOARD_FASTPAY/dist` (see [VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md) and BACKEND/nginx docs).

---

## 4. Deploy steps (same structure for both)

Use the **single entry point** from repo root:

```bash
./deploy.sh <staging|production> [target] [options]
```

### 4.1 Staging deploy

| Step | Action | Command / note |
|------|--------|------------------|
| 1 | (Optional) Sync code | `./scripts/sync-from-github.sh staging` or `./deploy.sh staging --pull` |
| 2 | Full deploy | `./deploy.sh staging --no-input` |
| 3 | Apply host nginx (for public URLs) | **On the staging server:** `sudo ./BACKEND/nginx/apply-staging-on-host.sh` — or run deploy on the server with `./deploy.sh staging --no-input --apply-nginx` (script will try to apply nginx automatically) |
| 4 | Verify | See § 5.1 |

**Why public URLs need this:** Staging containers listen on localhost (8888, 8001). Public URLs (staging.fastpaygaming.com, sapi, sadmin, sredpay) only work when **host nginx** on the server is configured to proxy to those ports. The deploy script can apply nginx for you when run on the server; otherwise run the apply script once after deploy.

**Partial deploys:**

- Dashboard only: `./deploy.sh staging dashboard --no-input`
- Backend only: `./deploy.sh staging backend --no-input [--skip-tests]`

**Useful options:** `--skip-tests`, `--skip-redpay`, `--skip-notify`, `--dry-run`, `--apply-nginx` (apply host nginx on this machine; default is to try once), `--skip-apply-nginx` (don’t try), `--require-public-urls` (exit with error if public URL checks fail).

### 4.2 Production deploy

| Step | Action | Command / note |
|------|--------|------------------|
| 1 | Sync code (recommended) | `./scripts/sync-from-github.sh production` or use `--pull` in step 2 |
| 2 | Full deploy | `./deploy.sh production --no-input --pull` |
| 3 | Reload host nginx (if used) | `sudo nginx -t && sudo systemctl reload nginx` |
| 4 | Verify | See § 5.2 |

**Partial deploys:**

- Dashboard only: `./deploy.sh production dashboard`
- Backend only: `./deploy.sh production backend --no-input [--skip-tests]`

**Useful options:** `--skip-tests`, `--skip-redpay`, `--dry-run`.

---

## 5. Verification

### 5.1 Staging

- Backend health: `curl -s http://localhost:8001/health/` → `ok`
- FastPay dashboard: https://staging.fastpaygaming.com/
- RedPay: https://sredpay.fastpaygaming.com/
- API: https://sapi.fastpaygaming.com/api/
- Admin: https://sadmin.fastpaygaming.com/admin/

Post-deploy checks (DNS, HTTP, browser console) run automatically at end of `deploy-all.sh`. To run manually: `./BACKEND/scripts/check-staging-postdeploy.sh`. Use `--skip-postdeploy-checks` to skip. Use `--push` to push deploy changes to GitHub after success.

### 5.2 Production

- Backend health: `curl -s http://localhost:8000/health/` (or your API port) → `ok`
- FastPay: https://fastpaygaming.com/
- RedPay: https://redpay.fastpaygaming.com/
- API: https://api.fastpaygaming.com/api/

Optional scripts (from repo root):

- `./BACKEND/scripts/check-production-postdeploy.sh` — DNS, HTTP, and browser console checks.
- `./scripts/check-production-ready.sh` — Single command that runs preflight + post-deploy checks (no deploy). Use for a quick production “freshen up”. Options: `--skip-preflight`, `--skip-postdeploy`; supports `PRODUCTION_BASE` and `SKIP_BROWSER_CHECK=1`.

Both staging and production post-deploy scripts include a headless browser check that loads dashboard URLs and fails on JS console errors. One-time setup: `cd BACKEND/scripts/deploy-checks && npm install && npx playwright install chromium`. See [VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md) § 6.6.

---

## 6. Rollback

1. Check out the previous commit (or the desired tag/commit).
2. Re-run the full deploy for that environment:
   - Staging: `./deploy.sh staging --no-input`
   - Production: `./deploy.sh production --no-input --pull`

If only the dashboard broke, rebuild and redeploy dashboard only; if only backend, redeploy backend only.

---

## 7. Staging → Production promotion

To copy code from staging tree to production tree (e.g. before production deploy):

```bash
# From production base or with PROD_DIR set
./promote-from-staging.sh [--dry-run] [--no-delete]
```

Defaults: staging = current repo directory (where the script lives), production = `/var/www/fastpay`. Override with `STAGING_DIR` and `PROD_DIR`.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for details.

---

## 8. Related docs

- **[DEPLOYMENT.md](../DEPLOYMENT.md)** — Full deployment guide (env files, backend options, health monitor).
- **[VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md)** — Base paths, URLs, nginx, sync script.
- **BACKEND/nginx/STAGING_NGINX.md** — Staging nginx layout and apply script.
- **.cursor/rules/subdomain-staging-production.mdc** — Subdomain convention (`s` prefix = staging).
