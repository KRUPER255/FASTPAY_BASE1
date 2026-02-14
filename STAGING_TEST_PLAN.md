# Staging Test Plan

Use this checklist to verify all Phase 2, Phase 3, and tooling changes on **staging** (FASTPAY_BASE, docker-compose.staging.yml, port 8001). Run from the repo root `/root/Desktop/FASTPAY_BASE` unless noted.

**Quick automated run:** from repo root run `./run-staging-tests.sh` (see Automated run below for details).

---

## Automated run

From repo root:

```bash
./run-staging-tests.sh
```

This runs all automatable checks (health endpoints, validate_env, Docker healthcheck, check-server, verify_firebase_connection, health-monitor, docs/config) and prints PASS/SKIP/FAIL. Exit 0 if no failures. Override staging URL with `STAGING_HOST=http://host:port` if needed.

---

## Prerequisites

- [ ] Staging backend and DB are running (e.g. `cd BACKEND && docker compose -f docker-compose.staging.yml up -d`)
- [ ] Staging env is loaded: `BACKEND/.env.staging` exists and has at least `SECRET_KEY`, `ALLOWED_HOSTS`, `DB_*`, `FIREBASE_DATABASE_URL`
- [ ] Dashboard can be built (Node/npm available)

---

## 1. Backend: Health endpoints

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health/` | `200` | |
| 1.2 | `curl -s http://127.0.0.1:8001/health/` | Body is `ok` (text/plain) | |
| 1.3 | `curl -s http://127.0.0.1:8001/api/health/` | `{"status":"ok"}` (JSON) | |
| 1.4 | `curl -s "http://127.0.0.1:8001/api/health/?detailed=1"` | JSON with keys `database`, `firebase`, `redis`; each has `status` (e.g. `healthy`, `not_initialized`) | |
| 1.5 | In 1.4 response, confirm `database.status` is `healthy` when DB is up | `"database":{"status":"healthy"}` | |

---

## 2. Backend: Environment validation

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | `cd BACKEND && python manage.py validate_env --context=production` (no env set) | Exit 1, stderr lists missing vars (e.g. SECRET_KEY, FIREBASE_DATABASE_URL) | |
| 2.2 | `cd BACKEND` then load `.env.staging` (e.g. `set -a && source .env.staging && set +a`) and run `python manage.py validate_env --context=production` | Exit 0, "Environment validation passed." | |
| 2.3 | Same as 2.2 with `--context=staging` | Exit 0 | |

---

## 3. Backend: Docker web healthcheck (staging)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | `cd BACKEND && docker compose -f docker-compose.staging.yml up -d` (if not already up) | Containers start | |
| 3.2 | Wait ~45s, then `docker compose -f docker-compose.staging.yml ps` | `web` service shows "Up (healthy)" or similar (healthcheck passed) | |
| 3.3 | `docker inspect $(docker compose -f docker-compose.staging.yml ps -q web) --format '{{.State.Health.Status}}'` | `healthy` (after start_period) | |

---

## 4. Dashboard: Build and API client

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | `cd DASHBOARD && npm run build -- --mode staging` (or your staging build command) | Build succeeds | |
| 4.2 | In browser: open staging dashboard, go to **API Monitoring** page | Page loads | |
| 4.3 | On API Monitoring page, confirm **System status** widget is visible above the API section | Widget shows "System status" and DB / Firebase / Redis lines (or "Loading…" then status) | |
| 4.4 | Widget shows green/healthy for database (and firebase/redis if configured) or clearly shows "Unable to load" if API unreachable | Behaviour matches backend /api/health/?detailed=1 | |

---

## 5. Dashboard: Retry and timeout (optional)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | In browser DevTools Network tab, throttle to "Offline" and trigger an API call (e.g. list devices), then restore | Request fails or retries; after restore, eventual success or clear error | |
| 5.2 | (Optional) Set `VITE_API_TIMEOUT_MS=5000`, rebuild, and call a slow endpoint | Request aborts or retries within ~5s | |

---

## 6. Scripts: check-server.sh

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | `./check-server.sh` | Script runs without syntax errors | |
| 6.2 | Staging backend on 8001: section "Backend (8000)" may fail; "Staging (8001)" shows OK with 200 | Staging (8001): 200 | |
| 6.3 | Section "Backend detailed health (8000)" appears if backend on 8000 is up; if only staging is up, run `curl -s "http://127.0.0.1:8001/api/health/?detailed=1"` and confirm JSON | Either detailed health block shows database/firebase/redis or curl returns valid JSON | |

---

## 7. Scripts: verify_firebase_connection.sh

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | `cd BACKEND && ./verify_firebase_connection.sh` | Script runs; uses BASE_DIR = parent of BACKEND (FASTPAY_BASE) | |
| 7.2 | Script looks for APK config at `$BASE_DIR/FASTPAY_APK/FASTPAY_BASE/app/google-services.json` and `$BASE_DIR/APK/...` | No wrong path to /opt/FASTPAY (production) | |
| 7.3 | Script uses `DASHBOARD_ENV` and `BACKEND_ENV` under `$BASE_DIR` (DASHBOARD_FASTPAY/.env.production, BACKEND/.env.production) | Correct paths printed or used | |
| 7.4 | If staging compose is used (BASE_DIR contains FASTPAY_BASE), script runs `docker compose -f docker-compose.staging.yml` (or equivalent) | No hardcoded docker-compose or /opt/FASTPAY | |
| 7.5 | If web container is up: "Testing Django Backend Firebase Connection" step runs and reports SUCCESS or ERROR | Firebase init test runs in container | |

---

## 8. Health monitor (optional)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 8.1 | `cd health-monitor && HEALTH_DETAILED_URL=http://127.0.0.1:8001/api/health/?detailed=1 ./health-monitor.sh` | Exit 0 if backend is up and components healthy; exit 1 if any component unhealthy (and Telegram sent if configured) | |
| 8.2 | Unset HEALTH_DETAILED_URL and run `./health-monitor.sh` | Behaviour unchanged (only URL list checked) | |

---

## 9. CI: validate_env in GitHub Actions

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 9.1 | Push a commit that touches `BACKEND/**` (or open a PR) to trigger Backend Tests workflow | Workflow runs | |
| 9.2 | In the run, open the "Validate environment variables" step | Step runs `python manage.py validate_env --context=production` with DB_*, SECRET_KEY, FIREBASE_DATABASE_URL set | |
| 9.3 | Step exits 0 | No env validation failure in CI | |

---

## 10. Docs and config

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 10.1 | `cat FASTPAY_APK/FASTPAY_BASE/FIREBASE_SETUP.md` | File exists and describes Firebase Console, google-services.json, and alignment with Dashboard/Backend | |
| 10.2 | `cat BACKEND/api/utils/FIREBASE_PATHS.md` | File exists and lists canonical vs legacy paths | |
| 10.3 | `grep -E "REDIS_URL|VITE_API_MAX_RETRIES|VITE_API_TIMEOUT" BACKEND/.env.example DASHBOARD_FASTPAY/.env.example` | REDIS_URL in Backend; retry/timeout vars or comments in Dashboard | |

---

## Summary

- **Sections 1–3:** Backend health and env validation on staging.
- **Sections 4–5:** Dashboard build, System status widget, and optional retry check.
- **Sections 6–7:** check-server and verify_firebase_connection with BASE_DIR and staging.
- **Sections 8–9:** Optional health-monitor detailed URL and CI validate_env.
- **Section 10:** Docs and .env.example updates.

Record pass/fail for each row; fix any failures before considering staging fully tested.
