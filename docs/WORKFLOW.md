# FastPay workflow

High-level flow: where code lives, how deploy and data work, and the usual day-to-day cycle.

---

## 1. Repo layout (same for staging and production)

```
FASTPAY_BASE/
├── BACKEND/              # Django API, admin, Firebase sync, Celery
│   ├── deploy.sh         # Backend-only deploy (Docker: db, redis, web, nginx, celery)
│   ├── nginx/            # Nginx configs (staging + production)
│   └── .env.staging / .env.production
├── DASHBOARD_FASTPAY/    # Main FastPay dashboard (React/Vite)
├── DASHBOARD_REDPAY/     # RedPay variant (same stack, different branding/routes)
├── deploy.sh             # Single entry: staging or production full deploy
├── scripts/              # setup-*, deploy-production-from-github, sync-from-github, etc.
└── docs/
```

- **Staging** base: Desktop (e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`).
- **Production** base: `/var/www/fastpay`.

Same three apps in both; only the base path and env files differ.

---

## 2. Request flow (what talks to what)

```
User browser
    → https://staging.fastpaygaming.com/  (or production)
    → Host nginx (SSL, proxy)
    → Staging: Docker nginx :8888 (serves FASTPAY_DEPLOY/dist/staging/fastpay)
    → Dashboard (React) calls API

Dashboard (React)
    → https://sapi.fastpaygaming.com/api/  (staging) or https://api.../api/ (prod)
    → Host nginx → Backend (Django) :8001 (staging) or :8000 (prod)
    → Django: REST + Firebase sync, PostgreSQL, Redis, Celery
```

- **Devices / messages / notifications** can come from Firebase (sync to Django) or be created via API/admin.
- **Users** (dashboard login): Django `DashUser`; created via `create_super_admin`, `create_owner_credentials`, or dashboard “Users” / API.

---

## 3. First-time setup (once per environment)

| Step | Staging | Production |
|------|--------|------------|
| 1 | `./scripts/setup-staging-first-time.sh` | `PRODUCTION_BASE=/var/www/fastpay ./scripts/setup-production-first-time.sh` |
| 2 | Edit `BACKEND/.env.staging`, dashboard `.env.staging` (API URL, Firebase, etc.) | Edit `BACKEND/.env.production`, dashboard `.env.production` |
| 3 | Deploy (see below) | Deploy (see below) |
| 4 | `sudo ./BACKEND/nginx/apply-staging-on-host.sh` | Nginx + SSL as per BACKEND/nginx docs |
| 5 | (Optional) `./scripts/generate-fastpay-credentials.sh super-admin` | (Optional) `./scripts/generate-fastpay-credentials.sh owner` |

DB (PostgreSQL + Redis) is created by Docker on first backend deploy.

---

## 4. Deploy workflow (day to day)

**Staging (test changes before production):**

```bash
cd /path/to/repo   # e.g. FASTPAY_BASE or /root/Desktop/FASTPAY_BASE
./deploy-all.sh --no-input [--skip-tests]
# After success: ./deploy-all.sh --push  (optional: push local code to GitHub)
# If public URLs: sudo ./BACKEND/nginx/apply-staging-on-host.sh
```

Dist and config go to `/var/www/FASTPAY_DEPLOY/` on successful deploy. Public URLs only change when FASTPAY_DEPLOY is updated.

**Production (after staging is good):**

```bash
cd /var/www/fastpay
./scripts/deploy-production-from-github.sh
# Then: sudo nginx -t && sudo systemctl reload nginx  (if host serves static)
```

- Staging uses **local code** by default (no git pull unless you pass `--pull`).
- Production script **pulls from GitHub** then builds and deploys.

---

## 5. Develop → Staging → Production (typical cycle)

1. **Develop** in repo (BACKEND or DASHBOARD_FASTPAY / DASHBOARD_REDPAY).
2. **Deploy to staging:**  
   `./deploy.sh staging --no-input`  
   Test at https://staging.fastpaygaming.com/ (and sapi, sadmin, sredpay).
3. **Commit and push** to your branch/main.
4. **Deploy to production:**  
   On server: `cd /var/www/fastpay && ./scripts/deploy-production-from-github.sh`  
   (or use a CI/CD that runs the same).

Optional: **promote from staging** (rsync staging tree to production):  
`STAGING_DIR=/desktop/fastpay PROD_DIR=/var/www/fastpay ./promote-from-staging.sh`

---

## 6. Credentials and users

- **SECRET_KEY:**  
  `./scripts/generate-fastpay-credentials.sh secret-key`  
  (optionally `--write-backend` to patch BACKEND env).
- **Staging dashboard login (super admin):**  
  `./scripts/generate-fastpay-credentials.sh super-admin`  
  → superadmin@fastpay.com / superadmin123 (or your password).
- **Production owner (Django Admin + FastPay + RedPay):**  
  `./scripts/generate-fastpay-credentials.sh owner`  
  → owner@fastpay.com, owner@redpay.com (default passwords in script).

---

## 7. Data and devices

- **Devices** can be synced from Firebase (`sync_device_from_firebase`, `migrate_firebase_user_devices_to_django`, etc.) or created via API/admin.
- **“No devices available”** in the dashboard is normal until devices exist in Django (or Firebase and sync is run).
- Backend uses **PostgreSQL** (Django models) and optionally **Firebase** (sync/read). Env: `FIREBASE_DATABASE_URL`, `FIREBASE_CREDENTIALS_PATH` in BACKEND env.

---

## 8. Quick reference

| Want to… | Command / place |
|----------|------------------|
| Deploy staging | `./deploy-all.sh --no-input` |
| Deploy production (fetch + deploy) | `cd /var/www/fastpay && ./scripts/deploy-production-from-github.sh` |
| Apply staging nginx | `sudo ./BACKEND/nginx/apply-staging-on-host.sh` |
| Create FASTPAY_DEPLOY structure | `sudo ./scripts/create-fastpay-deploy-dirs.sh` |
| Generate SECRET_KEY | `./scripts/generate-fastpay-credentials.sh secret-key` |
| Create staging super admin | `./scripts/generate-fastpay-credentials.sh super-admin` |
| Create production owner users | `./scripts/generate-fastpay-credentials.sh owner` |
| Check DNS | `./scripts/check-dns-a.sh` |
| First-time staging | `./scripts/setup-staging-first-time.sh` |
| First-time production | `PRODUCTION_BASE=/var/www/fastpay ./scripts/setup-production-first-time.sh` |

More detail: [DEPLOY_PROCESS.md](DEPLOY_PROCESS.md), [VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md).
