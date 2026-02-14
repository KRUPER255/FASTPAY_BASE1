# FASTPAY_BASE

## Deploy (best method)

**Staging (on server):** `./deploy.sh staging --no-input --apply-nginx`  
**Production (on server):** `cd /var/www/fastpay && ./scripts/deploy-production-from-github.sh`  
(or `./deploy.sh production --no-input --pull`)

**First-time setup:** `./scripts/setup-production-first-time.sh` (production) or `./scripts/setup-staging-first-time.sh` (staging). Then edit env files and run the deploy command below.

See **[docs/DEPLOY_PROCESS.md](docs/DEPLOY_PROCESS.md)** for the full flow and options.

## Deploy layout (staging and production)

- **Production** → under **`/var/www`** (canonical: `/var/www/fastpay`).
- **Staging** → on **Desktop** (e.g. `/root/Desktop/FASTPAY_BASE` or `/desktop/fastpay`).

Same directory layout and single entry point (`./deploy.sh`). For workflow, URLs, nginx, and sync:

- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — End-to-end workflow: layout, deploy cycle, credentials, data flow.
- **[docs/VPS_DEPLOY_STRUCTURE.md](docs/VPS_DEPLOY_STRUCTURE.md)** — Target layout, path convention, URLs, nginx, and sync script. **DASHBOARD_FASTPAY** is the core; **DASHBOARD_REDPAY** is the RedPay variant.
