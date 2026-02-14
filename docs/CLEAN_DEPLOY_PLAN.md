# Clean & Both Success Deploy Plan

A repeatable plan for clean staging and production deployments with verification so both succeed.

---

## 1. Entry Point

| Environment | Command | Where to run |
|-------------|---------|--------------|
| **Staging** | `./deploy.sh staging --no-input` | From repo root (e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`) |
| **Production** | `./deploy.sh production --no-input --pull` | From `/var/www/fastpay` (or set `PRODUCTION_BASE`) |

---

## 2. Pre-Deploy Checklist (Clean State)

Before deploying either environment, ensure:

| Check | Staging | Production |
|-------|---------|------------|
| **Base path exists** | `/desktop/fastpay` or current repo | `/var/www/fastpay` |
| **Repo is a git clone** | `ls -la .git` | Same |
| **Env files exist** | `BACKEND/.env.staging`, `DASHBOARD_FASTPAY/.env.staging`, `DASHBOARD_REDPAY/.env.staging` | `BACKEND/.env.production`, etc. |
| **Env vars set** | SECRET_KEY, DB_*, FIREBASE_*, STAGING_DASHBOARD_DIST_PATH | SECRET_KEY, DB_*, FIREBASE_*, DASHBOARD_DIST_PATH, ALLOWED_HOSTS, CORS |
| **Docker running** | `docker info` | Same |
| **Node/npm available** | `node -v`, `npm -v` | Same |
| **Scripts executable** | `chmod +x deploy.sh deploy-all.sh deploy-production.sh BACKEND/deploy.sh DASHBOARD_FASTPAY/deploy.sh DASHBOARD_REDPAY/deploy.sh scripts/*.sh` | Same |

**Quick sanity:**
```bash
# From repo root
./scripts/check-dashboard-sync.sh --build-only   # Ensures dashboards build
./scripts/check-dns-a.sh                         # Ensures DNS points to this host (staging)
```

---

## 3. Staging Deploy Flow

### 3.1 One-Command Staging (Recommended)

```bash
cd /desktop/fastpay   # or /root/Desktop/FASTPAY_BASE
./deploy.sh staging --no-input
```

**Optional:** Run on server with nginx apply so public URLs work:
```bash
./deploy.sh staging --no-input --apply-nginx
```

### 3.2 Staging Steps (Manual Equivalent)

| Step | Action | Command |
|------|--------|---------|
| 1 | (Optional) Sync from GitHub | `./scripts/sync-from-github.sh staging` |
| 2 | Full deploy | `./deploy.sh staging --no-input` |
| 3 | Apply host nginx (on server) | `sudo ./BACKEND/nginx/apply-staging-on-host.sh` |
| 4 | Verify | See § 5.1 |

### 3.3 Staging Verification

| Check | Expected |
|-------|----------|
| Backend health | `curl -s http://localhost:8001/health/` → `ok` |
| FastPay dashboard | https://staging.fastpaygaming.com/ → 200/302 |
| RedPay | https://sredpay.fastpaygaming.com/ → 200/302 |
| API | https://sapi.fastpaygaming.com/api/ → 200 |
| Admin | https://sadmin.fastpaygaming.com/admin/ → 200/302 |

**Scripts:**
```bash
./scripts/check-dns-a.sh
./BACKEND/scripts/check-staging-postdeploy.sh
```

---

## 4. Production Deploy Flow

### 4.1 One-Command Production (Recommended)

```bash
cd /var/www/fastpay
./deploy.sh production --no-input --pull
```

**Or** from any clone (syncs into production base then deploys):
```bash
PRODUCTION_BASE=/var/www/fastpay ./scripts/deploy-production-from-github.sh
```

### 4.2 Production Steps (Manual Equivalent)

| Step | Action | Command |
|------|--------|---------|
| 1 | Sync from GitHub | `./scripts/sync-from-github.sh production` |
| 2 | Full deploy | `./deploy.sh production --no-input --pull` |
| 3 | Reload host nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| 4 | Verify | See § 5.2 |

### 4.3 Production Verification

| Check | Expected |
|-------|----------|
| Backend health | `curl -s http://localhost:8000/health/` → `ok` (or your `WEB_PORT`) |
| FastPay | https://fastpaygaming.com/ → 200/302 |
| RedPay | https://redpay.fastpaygaming.com/ → 200/302 |
| API | https://api.fastpaygaming.com/api/ → 200 |

---

## 5. Both Success: Order and Dependencies

To ensure **both** staging and production succeed:

### 5.1 Recommended Order

1. **Deploy staging first.** Staging uses local code; no git pull required. Verifies builds and backend.
2. **Run staging verification.** Fix any failures before touching production.
3. **Deploy production.** Production pulls from GitHub and deploys. If staging passed, production should pass with same code.

### 5.2 Shared Prerequisites (Both Must Have)

- Same Node version (e.g. 20) for dashboard builds
- Same Docker Compose version
- Env files filled with correct secrets and paths
- Firebase credentials at `FIREBASE_CREDENTIALS_PATH`

### 5.3 Environment-Specific Gotchas

| Issue | Staging | Production |
|-------|---------|------------|
| **Port** | Backend on 8001 | Backend on 8000 (or `WEB_PORT`) |
| **Dashboard dist path** | `STAGING_DASHBOARD_DIST_PATH` in BACKEND/.env.staging | `DASHBOARD_DIST_PATH` in BACKEND/.env.production |
| **Host nginx** | Must apply staging config for public URLs | Must reload nginx after deploy |
| **Git** | Staging: local code (no pull) | Production: always pull before deploy |

---

## 6. Common Failure Points and Fixes

| Failure | Likely cause | Fix |
|---------|--------------|-----|
| Dashboard build fails | `npm ci` or `npm run build` error | Run `./scripts/check-dashboard-sync.sh`; fix deps or code |
| Backend health not ok | Django/DB/Redis/Celery down | Check `docker compose -f docker-compose.staging.yml ps`; inspect logs |
| Public URLs 000 / unreachable | Host nginx not applied | Run `sudo ./BACKEND/nginx/apply-staging-on-host.sh` (staging) |
| DNS check fails | Domains not pointing to this VPS | Update DNS A records; wait for propagation |
| Env file missing | First-time setup not done | Run `./scripts/setup-staging-first-time.sh` or `setup-production-first-time.sh` |
| Permission denied on scripts | Scripts not executable | `chmod +x deploy.sh deploy-all.sh deploy-production.sh BACKEND/deploy.sh DASHBOARD_*/deploy.sh scripts/*.sh` |

---

## 7. Clean Deploy Checklist (Summary)

**Before deploy:**
- [ ] Prerequisites met (Docker, Node, env files)
- [ ] Staging base path correct (or production base path)
- [ ] Scripts executable

**Staging:**
- [ ] `./deploy.sh staging --no-input`
- [ ] Backend health ok
- [ ] Public URLs reachable (or apply host nginx)
- [ ] `./BACKEND/scripts/check-staging-postdeploy.sh` passes

**Production:**
- [ ] Staging already passed (recommended)
- [ ] `./deploy.sh production --no-input --pull`
- [ ] Host nginx reloaded
- [ ] Backend health and public URLs ok

---

## 8. References

- [docs/DEPLOY_PROCESS.md](DEPLOY_PROCESS.md) — Full deploy process
- [docs/VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md) — Paths, URLs, nginx
- [BACKEND/nginx/STAGING_NGINX.md](../BACKEND/nginx/STAGING_NGINX.md) — Staging nginx apply
