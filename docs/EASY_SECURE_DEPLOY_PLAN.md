# Easy, Secure, Not Breakable Deploy Plan

A plan to make the FastPay deployment process **easy** (simple commands), **secure** (proper secrets handling), and **not breakable** (validation, rollback, error handling).

---

## 1. Easy: Single Command Deploys

### Current State

| Environment | Current Command | Status |
|-------------|----------------|--------|
| Staging | `./deploy.sh staging --no-input` | ✅ Simple |
| Production | `./deploy.sh production --no-input --pull` | ✅ Simple |

### Improvements Needed

**1.1 Pre-flight validation script**
- Check prerequisites before deploy starts
- Clear error messages with fix instructions
- Exit early if critical issues found

**1.2 Unified entry point**
- Keep `./deploy.sh <env>` as single command
- Add `--validate-only` flag to check without deploying
- Add `--help` with clear examples

**1.3 Progress indicators**
- Show current step clearly
- Estimated time remaining
- Success/failure summary at end

---

## 2. Secure: Secrets Protection

### Current Security Issues

| Issue | Location | Risk |
|-------|----------|------|
| Hardcoded passwords | `BACKEND/deploy.sh` (superadmin123), `create_all_admins.sh` (admin123) | ⚠️ Medium |
| Secrets in logs | Env vars exported, might leak in error output | ⚠️ Medium |
| No env validation | Missing SECRET_KEY, DB_PASSWORD not checked before deploy | ⚠️ High |
| .env files not validated | Wrong format, missing required vars | ⚠️ High |

### Security Improvements

**2.1 Remove hardcoded passwords**

- **Staging:** Generate random password on first deploy, store in `.env.staging` (not committed)
- **Production:** Require password via env var or prompt (never hardcode)
- **Scripts:** Use `python manage.py create_super_admin` with `--password` from env or prompt

**2.2 Secrets validation**

Create `BACKEND/scripts/validate-env.sh`:
- Check required vars exist: `SECRET_KEY`, `DB_PASSWORD`, `FIREBASE_DATABASE_URL`, etc.
- Validate format (SECRET_KEY length, DB_PASSWORD not empty)
- Warn if using default/example values
- Exit with error if critical secrets missing

**2.3 Prevent secrets in logs**

- Use `set +x` before loading env files
- Redirect sensitive output to `/dev/null`
- Sanitize error messages (replace secrets with `***`)
- Use `--quiet` flags for commands that might echo secrets

**2.4 Env file permissions**

- Ensure `.env.*` files are `600` (owner read/write only)
- Scripts should `chmod 600` after creating env files
- Warn if env files are world-readable

---

## 3. Not Breakable: Validation & Rollback

### Current Robustness Issues

| Issue | Impact | Fix Needed |
|-------|--------|------------|
| No pre-deploy validation | Deploy fails mid-way, leaves system broken | ✅ Pre-flight checks |
| No rollback mechanism | Can't revert to previous working version | ✅ Rollback script |
| No health check before deploy | Might deploy broken code | ✅ Health check before deploy |
| No atomic operations | Partial deploys leave inconsistent state | ✅ Transaction-like steps |

### Robustness Improvements

**3.1 Pre-flight validation**

Create `scripts/preflight-check.sh`:
- [ ] Docker running
- [ ] Node/npm available
- [ ] Env files exist and valid
- [ ] Required secrets set
- [ ] Disk space sufficient
- [ ] Ports available (8000, 8001, 5432, 6379)
- [ ] Git repo clean (production only)
- [ ] Database accessible
- [ ] Previous deploy healthy (if rolling update)

**3.2 Health check before deploy**

- Check current backend health (`/health/`)
- If unhealthy, warn and ask to fix first
- Option: `--force` to deploy anyway (use with caution)

**3.3 Rollback mechanism**

Create `scripts/rollback.sh <env> [commit]`:
- Save current commit hash before deploy
- On failure, checkout previous commit
- Re-run deploy for that commit
- Restore database backup if needed (optional)

**3.4 Atomic deploy steps**

- Build images before stopping containers
- Migrate DB before starting new containers
- Start containers in order (db → redis → web → nginx)
- Health check after each step
- Rollback on any step failure

**3.5 Backup before deploy (production)**

- Database backup before migrations
- Config backup (nginx, env files)
- Restore on failure

---

## 4. Implementation Plan

### Phase 1: Security (High Priority)

1. **Remove hardcoded passwords**
   - Update `BACKEND/deploy.sh` to use env var or prompt
   - Update `create_all_admins.sh` to require password input
   - Generate random password for staging first-time setup

2. **Create env validation script**
   - `BACKEND/scripts/validate-env.sh`
   - Check required vars
   - Validate format
   - Exit with clear errors

3. **Sanitize logs**
   - Add `set +x` before env loading
   - Sanitize error messages
   - Use quiet flags

### Phase 2: Pre-flight Checks (High Priority)

1. **Create preflight script**
   - `scripts/preflight-check.sh <env>`
   - Check all prerequisites
   - Clear error messages

2. **Integrate into deploy**
   - Run preflight before deploy starts
   - Exit early on failure
   - Show fix instructions

### Phase 3: Rollback (Medium Priority)

1. **Create rollback script**
   - `scripts/rollback.sh <env> [commit]`
   - Save commit hash before deploy
   - Restore on failure

2. **Add backup (production)**
   - Database backup before deploy
   - Config backup
   - Restore on failure

### Phase 4: UX Improvements (Low Priority)

1. **Progress indicators**
   - Show current step
   - Estimated time
   - Success summary

2. **Better error messages**
   - Link to docs
   - Suggest fixes
   - Common issues FAQ

---

## 5. New Scripts Needed

### 5.1 `scripts/preflight-check.sh`

```bash
#!/bin/bash
# Pre-flight checks before deploy
# Usage: ./scripts/preflight-check.sh <staging|production>

# Checks:
# - Docker running
# - Node/npm available
# - Env files exist
# - Secrets validated
# - Disk space
# - Ports available
# - Git clean (production)
# - Previous deploy healthy
```

### 5.2 `BACKEND/scripts/validate-env.sh`

```bash
#!/bin/bash
# Validate env file
# Usage: BACKEND/scripts/validate-env.sh <env-file>

# Checks:
# - Required vars exist
# - SECRET_KEY length >= 50
# - DB_PASSWORD not empty
# - FIREBASE_* vars set
# - No default/example values
```

### 5.3 `scripts/rollback.sh`

```bash
#!/bin/bash
# Rollback to previous working version
# Usage: ./scripts/rollback.sh <staging|production> [commit-hash]

# Steps:
# - Checkout previous commit (or specified)
# - Re-run deploy
# - Restore backup if needed
```

### 5.4 `scripts/backup-before-deploy.sh`

```bash
#!/bin/bash
# Backup before production deploy
# Usage: ./scripts/backup-before-deploy.sh

# Backs up:
# - Database (pg_dump)
# - Env files
# - Nginx configs
# - Current commit hash
```

---

## 6. Updated Deploy Flow

### 6.1 Staging Deploy (Enhanced)

```bash
# Single command (with validation)
./deploy.sh staging --no-input

# Behind the scenes:
# 1. Pre-flight checks (preflight-check.sh)
# 2. Env validation (validate-env.sh)
# 3. Health check (current deploy healthy?)
# 4. Save commit hash
# 5. Build & deploy
# 6. Health check (new deploy healthy?)
# 7. Success notification
```

### 6.2 Production Deploy (Enhanced)

```bash
# Single command (with backup & validation)
./deploy.sh production --no-input --pull

# Behind the scenes:
# 1. Pre-flight checks
# 2. Env validation
# 3. Health check (current deploy healthy?)
# 4. Backup (database, configs, commit)
# 5. Save commit hash
# 6. Pull latest code
# 7. Build & deploy
# 8. Health check (new deploy healthy?)
# 9. Success notification
# 10. On failure: rollback + restore backup
```

---

## 7. Security Checklist

Before any deploy:

- [ ] `.env.*` files have `600` permissions
- [ ] No hardcoded passwords in scripts
- [ ] Secrets validated before deploy
- [ ] Logs sanitized (no secrets exposed)
- [ ] Git repo clean (production)
- [ ] Previous deploy healthy
- [ ] Backup created (production)

---

## 8. Error Handling

### 8.1 Common Failures & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "SECRET_KEY not set" | Missing in .env | Run `validate-env.sh`; add to .env |
| "DB_PASSWORD empty" | Not set | Add to .env |
| "Docker not running" | Docker daemon stopped | `sudo systemctl start docker` |
| "Port 8000 in use" | Another service using port | Stop service or change `WEB_PORT` |
| "Disk space < 1GB" | Low disk space | Free space or expand disk |
| "Previous deploy unhealthy" | Current deploy broken | Fix current deploy first or `--force` |

### 8.2 Rollback Triggers

Automatic rollback on:
- Health check fails after deploy
- Database migration fails
- Container startup fails
- Critical error in deploy script

Manual rollback:
```bash
./scripts/rollback.sh production
# or specific commit:
./scripts/rollback.sh production abc123
```

---

## 9. References

- [docs/CLEAN_DEPLOY_PLAN.md](CLEAN_DEPLOY_PLAN.md) — Clean deploy steps
- [docs/DEPLOY_PROCESS.md](DEPLOY_PROCESS.md) — Full deploy process
- [BACKEND/scripts/](BACKEND/scripts/) — Backend scripts

---

## 10. Detailed Breakdown

Task-by-task breakdown with file-level changes, order, and acceptance criteria.

### 10.1 Phase 1: Security (Detailed)

| # | Task | Files | Changes | Acceptance Criteria |
|---|------|-------|---------|---------------------|
| 1.1 | Remove hardcoded staging password | `BACKEND/deploy.sh` | Replace `--password "superadmin123"` with `--password "${STAGING_SUPERADMIN_PASSWORD:-$(openssl rand -base64 24)}"`; add STAGING_SUPERADMIN_PASSWORD to `.env.staging` (setup script writes it once) | No literal password in deploy.sh |
| 1.2 | Update setup-staging-first-time.sh | `scripts/setup-staging-first-time.sh` | After creating `.env.staging`, append `STAGING_SUPERADMIN_PASSWORD=$(openssl rand -base64 24)` if not present; echo password to stdout once (user must save) | New staging envs get random password |
| 1.3 | Update create_all_admins.sh | `BACKEND/create_all_admins.sh` | Require `--password` or `ADMIN_PASSWORD` env; remove default `admin123`; fail if missing | No default password |
| 1.4 | Update create_super_admin.sh | `BACKEND/create_super_admin.sh` | Require `--password` or `SUPERADMIN_PASSWORD` env; remove default; fail if missing | No default password |
| 1.5 | Create validate-env.sh | `BACKEND/scripts/validate-env.sh` (new) | Script that: sources env file; checks SECRET_KEY (len≥50), DB_PASSWORD (non-empty), DB_NAME, DB_USER; checks FIREBASE_DATABASE_URL, FIREBASE_CREDENTIALS_PATH; warns if contains "changeme" or "example"; exits 1 on failure | Exits 0 only when env valid |
| 1.6 | Sanitize env loading in BACKEND/deploy.sh | `BACKEND/deploy.sh` | Wrap `export $(cat "$ENV_FILE"...)` in `set +x`; redirect to /dev/null; add trap to avoid echoing secrets on error | No secrets in stdout/stderr |
| 1.7 | Env file permissions | `scripts/setup-staging-first-time.sh`, `scripts/setup-production-first-time.sh` | After creating `.env.staging`/`.env.production`, run `chmod 600` on them | Env files are 600 |
| 1.8 | Add validate-env to deploy flow | `BACKEND/deploy.sh` | Before Step 1, run `./scripts/validate-env.sh "$ENV_FILE"`; exit 1 on failure | Deploy fails early if env invalid |

### 10.2 Phase 2: Pre-flight Checks (Detailed)

| # | Task | Files | Changes | Acceptance Criteria |
|---|------|-------|---------|---------------------|
| 2.1 | Create preflight-check.sh | `scripts/preflight-check.sh` (new) | Script with: check_docker, check_node, check_env_files, check_disk_space (≥1GB), check_ports (8000/8001/5432/6379), check_git_clean (production only), check_health (optional). Each check prints OK or FAIL + fix hint. Exit 1 if any critical FAIL | Script exits 0 when all pass |
| 2.2 | Implement check_docker | `scripts/preflight-check.sh` | `docker info >/dev/null 2>&1`; FAIL: "Docker not running. Run: sudo systemctl start docker" | |
| 2.3 | Implement check_node | `scripts/preflight-check.sh` | `node -v` and `npm -v`; FAIL: "Node/npm not found. Install Node 20 LTS." | |
| 2.4 | Implement check_env_files | `scripts/preflight-check.sh` | For staging: BACKEND/.env.staging, DASHBOARD_FASTPAY/.env.staging, DASHBOARD_REDPAY/.env.staging. For production: .env.production. Call validate-env.sh. FAIL: "Missing env files. Run setup-*-first-time.sh" | |
| 2.5 | Implement check_disk_space | `scripts/preflight-check.sh` | `df -BG .`; require ≥1GB free. FAIL: "Low disk space. Free at least 1GB." | |
| 2.6 | Implement check_ports | `scripts/preflight-check.sh` | For staging: 8001, 8888; for production: 8000 (or WEB_PORT). Use `ss -tlnp` or `netstat`. FAIL if port in use by non-fastpay process | |
| 2.7 | Implement check_git_clean | `scripts/preflight-check.sh` | Production only: `git status --porcelain`; warn if dirty (optional FAIL) | |
| 2.8 | Implement check_health | `scripts/preflight-check.sh` | curl localhost:8001/health (staging) or :8000/health (production); FAIL: "Backend unhealthy. Fix current deploy first or use --force." | |
| 2.9 | Integrate preflight into deploy | `deploy-all.sh`, `deploy-production.sh` | At start, run `./scripts/preflight-check.sh staging` or `production`; exit 1 on failure. Add `--skip-preflight` to bypass. Add `--force` to skip health check | Deploy runs preflight first |
| 2.10 | Add --validate-only to deploy.sh | `deploy.sh` | If `--validate-only`, run preflight + validate-env, print "Validation OK", exit 0 | `./deploy.sh staging --validate-only` works |

### 10.3 Phase 3: Rollback & Backup (Detailed)

| # | Task | Files | Changes | Acceptance Criteria |
|---|------|-------|---------|---------------------|
| 3.1 | Save commit before deploy | `deploy-all.sh`, `deploy-production.sh` | At start: `PRE_DEPLOY_COMMIT=$(git rev-parse HEAD)`; write to `./.last-deploy-commit` or `BACKEND/.last-deploy-commit` | Commit saved before any changes |
| 3.2 | Create backup-before-deploy.sh | `scripts/backup-before-deploy.sh` (new) | For production: pg_dump to `backups/db-YYYYMMDD-HHMMSS.sql`; copy BACKEND/.env.production to `backups/env-*.bak`; copy nginx conf.d to `backups/nginx-*.tar`; write `git rev-parse HEAD` to `backups/commit-*.txt` | Backup dir created with timestamp |
| 3.3 | Create rollback.sh | `scripts/rollback.sh` (new) | Usage: `./scripts/rollback.sh <staging|production> [commit]`. If no commit: read from .last-deploy-commit or backups/commit-*.txt. Checkout commit. Re-run deploy (no --pull for staging). Option: restore DB from backup (manual step documented) | Rollback restores previous commit and redeploys |
| 3.4 | Integrate backup into production deploy | `deploy-production.sh` | Before Step 1 (pull), run `./scripts/backup-before-deploy.sh`; exit 1 on failure | Production deploy creates backup first |
| 3.5 | Add failure trap for rollback | `deploy-all.sh`, `deploy-production.sh` | On trap/ERR: if deploy failed after commit change, prompt "Run ./scripts/rollback.sh <env> to revert" or auto-rollback with `--auto-rollback-on-failure` | User informed or auto-rollback on failure |

### 10.4 Phase 4: UX (Detailed)

| # | Task | Files | Changes | Acceptance Criteria |
|---|------|-------|---------|---------------------|
| 4.1 | Step labels | `deploy-all.sh`, `deploy-production.sh`, `BACKEND/deploy.sh` | Ensure every step prints `[1/7]`, `[2/7]` etc. | Steps numbered |
| 4.2 | Success summary | `deploy-all.sh`, `deploy-production.sh` | At end: "Deploy complete. Backend: OK. Dashboard: OK. API: OK." with URLs | Clear success message |
| 4.3 | Error messages with docs link | All deploy scripts | On failure: "See docs/DEPLOY_PROCESS.md and docs/EASY_SECURE_DEPLOY_PLAN.md" | Errors reference docs |
| 4.4 | --help for deploy.sh | `deploy.sh` | Add `--help` that prints usage, examples, flags | `./deploy.sh --help` works |

### 10.5 Dependency Order

```text
Phase 1 (Security):
  1.1 → 1.2 (deploy.sh uses STAGING_SUPERADMIN_PASSWORD; setup creates it)
  1.5 → 1.6, 1.8 (validate-env exists before integrate)
  1.3, 1.4 independent
  1.7 independent
  1.8 depends on 1.5

Phase 2 (Pre-flight):
  2.1–2.8 (implement all checks in preflight-check.sh)
  2.9 depends on 2.1
  2.10 depends on 2.9

Phase 3 (Rollback):
  3.1 independent
  3.2 independent
  3.3 depends on 3.1 or 3.2 (needs commit/backup)
  3.4 depends on 3.2
  3.5 depends on 3.1

Phase 4 (UX):
  4.1–4.4 independent
```

### 10.6 File Touch Map

| File | Phase | Action |
|------|-------|--------|
| `BACKEND/deploy.sh` | 1, 2, 3 | Modify (password, validate-env, preflight, commit save, trap) |
| `scripts/setup-staging-first-time.sh` | 1 | Modify (STAGING_SUPERADMIN_PASSWORD, chmod 600) |
| `scripts/setup-production-first-time.sh` | 1 | Modify (chmod 600) |
| `BACKEND/create_all_admins.sh` | 1 | Modify (require password) |
| `BACKEND/create_super_admin.sh` | 1 | Modify (require password) |
| `BACKEND/scripts/validate-env.sh` | 1 | Create |
| `scripts/preflight-check.sh` | 2 | Create |
| `deploy-all.sh` | 2, 3, 4 | Modify (preflight, commit save, trap, UX) |
| `deploy-production.sh` | 2, 3, 4 | Modify (preflight, commit save, trap, backup, UX) |
| `deploy.sh` | 2, 4 | Modify (--validate-only, --help) |
| `scripts/backup-before-deploy.sh` | 3 | Create |
| `scripts/rollback.sh` | 3 | Create |
| `.gitignore` | 3 | Add `.last-deploy-commit`, `backups/` |

### 10.7 Acceptance Criteria Summary

- **Phase 1:** `./deploy.sh staging --no-input` runs without hardcoded passwords; `validate-env.sh` fails on bad env; env files are 600.
- **Phase 2:** `./scripts/preflight-check.sh staging` passes/fails correctly; `./deploy.sh staging --validate-only` exits 0 when valid.
- **Phase 3:** Production deploy creates backup; `./scripts/rollback.sh production` reverts and redeploys.
- **Phase 4:** Deploy output shows numbered steps and success summary; `./deploy.sh --help` prints usage.

---

## 11. Success Metrics

After implementing this plan:

- **Easy:** Single command deploy (`./deploy.sh <env>`)
- **Secure:** No secrets in logs, env validation, no hardcoded passwords
- **Not breakable:** Pre-flight checks, rollback, health checks, atomic operations
