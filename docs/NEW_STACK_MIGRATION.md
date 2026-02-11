## New Traefik + docker-compose.v2 Stack

This repository now includes a **containerized staging + production stack** driven by Traefik and `docker-compose.v2.yml`. It is designed so all **public URLs** are managed from the VPS via a single reverse proxy.

### 1. Services and public URLs

All services are defined in `docker-compose.v2.yml` at the repo root.

- **Traefik (reverse proxy)**: `traefik`
  - Listens on VPS ports **80** and **443**.
  - Terminates TLS via **Let’s Encrypt** using the `letsencrypt` resolver.
  - Redirects all HTTP → HTTPS.

- **Backend – Staging**: `backend-staging`
  - Django/DRF backend for staging.
  - Public URL: `https://api-staging.fastpaygaming.com/`
  - Traefik router: `backend-staging` (Host rule on `api-staging.fastpaygaming.com`).

- **Backend – Production**: `backend-prod`
  - Django/DRF backend for production.
  - Public URL: `https://api.fastpaygaming.com/`
  - Traefik router: `backend-prod` (Host rule on `api.fastpaygaming.com`).

- **FASTPAY Dashboard – Staging**: `fastpay-dashboard-staging`
  - React/Vite SPA served by nginx in the container.
  - Public URL: `https://staging.fastpaygaming.com/`

- **FASTPAY Dashboard – Production**: `fastpay-dashboard-prod`
  - Public URL: `https://fastpaygaming.com/`

- **REDPAY Dashboard – Staging**: `redpay-dashboard-staging`
  - React/Vite SPA (with `VITE_REDPAY_ONLY=true`) served by nginx.
  - Public URL: `https://redpay-staging.fastpaygaming.com/`

- **REDPAY Dashboard – Production**: `redpay-dashboard-prod`
  - Public URL: `https://redpay.fastpaygaming.com/`

- **Datastores**
  - Staging: `postgres-staging`, `redis-staging` (separate volumes).
  - Production: `postgres-prod`, `redis-prod` (separate volumes).

> **Note:** AXISURGENT and owner/Guacamole endpoints are still served via the legacy host nginx configuration. They can be moved behind Traefik later by adding additional routers and services.

### 2. Required DNS records

Point the following DNS records to the VPS where Traefik runs:

- Production:
  - `fastpaygaming.com` → VPS IP
  - `api.fastpaygaming.com` → VPS IP
  - `redpay.fastpaygaming.com` → VPS IP
- Staging:
  - `staging.fastpaygaming.com` → VPS IP
  - `api-staging.fastpaygaming.com` → VPS IP
  - `redpay-staging.fastpaygaming.com` → VPS IP

Traefik will automatically request/renew TLS certificates for these hostnames using the `TRAEFIK_ACME_EMAIL` you configure.

### 3. Environment variables and build-time configuration

#### 3.1 Traefik

In the shell (or `.env` file used by `docker compose`):

- `TRAEFIK_ACME_EMAIL` – email address used for Let’s Encrypt registration.

#### 3.2 Backends

`backend-staging` and `backend-prod` both use the existing `BACKEND/Dockerfile` and read most configuration from:

- `BACKEND/.env.staging` for staging
- `BACKEND/.env.production` for production

The compose file additionally sets:

- `ENVIRONMENT=staging` for `backend-staging`
- `ENVIRONMENT=production` for `backend-prod`

Ensure these env files define:

- Database credentials for each environment.
- `ALLOWED_HOSTS` including the domains listed above.
- `CORS_ALLOWED_ORIGINS` including the matching dashboard URLs.
- `SECURE_PROXY_SSL_HEADER` and related HTTPS flags are already wired in settings.

#### 3.3 Dashboards

New Dockerfiles were added:

- FASTPAY: `DASHBOARD_FASTPAY/Dockerfile`
- REDPAY: `DASHBOARD_REDPAY/Dockerfile`

They accept build-time args used by Vite:

- `VITE_API_BASE_URL`
- `VITE_BASE_PATH` (defaults to `/`)
- `VITE_REDPAY_ONLY` (REDPAY only, defaults to `true`)

`docker-compose.v2.yml` wires these as:

- Staging:
  - `FASTPAY_STAGING_API_BASE_URL` → defaults to `https://api-staging.fastpaygaming.com`
  - `REDPAY_STAGING_API_BASE_URL` → defaults to `https://api-staging.fastpaygaming.com`
- Production:
  - `FASTPAY_PROD_API_BASE_URL` → defaults to `https://api.fastpaygaming.com`
  - `REDPAY_PROD_API_BASE_URL` → defaults to `https://api.fastpaygaming.com`

You can override these by exporting environment variables before running `docker compose build`.

### 4. Basic usage

From the repo root on the VPS.

#### 4.1 Quick staging deploy steps

1. **Prepare environment**
   - Ensure `BACKEND/.env.staging` exists and is correct (DB, ALLOWED_HOSTS, CORS, secrets).
   - Export `TRAEFIK_ACME_EMAIL` in your shell.
   - (Optional) Export `FASTPAY_STAGING_API_BASE_URL` and `REDPAY_STAGING_API_BASE_URL` if you want to override defaults.
2. **Build images**
   - `docker compose -f docker-compose.v2.yml build backend-staging fastpay-dashboard-staging redpay-dashboard-staging`
3. **Start services**
   - `docker compose -f docker-compose.v2.yml up -d traefik postgres-staging redis-staging backend-staging fastpay-dashboard-staging redpay-dashboard-staging`
4. **Run migrations**
   - `docker compose -f docker-compose.v2.yml run --rm backend-staging python manage.py migrate`
5. **Check URLs**
   - See the verification checklist below for staging URLs to test.

#### 4.2 Quick production deploy steps

1. **Prepare environment**
   - Ensure `BACKEND/.env.production` exists and is correct (DB, ALLOWED_HOSTS, CORS, secrets).
   - Export `TRAEFIK_ACME_EMAIL` in your shell (same or different from staging).
   - (Optional) Export `FASTPAY_PROD_API_BASE_URL` and `REDPAY_PROD_API_BASE_URL` if you want to override defaults.
2. **Build images**
   - `docker compose -f docker-compose.v2.yml build backend-prod fastpay-dashboard-prod redpay-dashboard-prod`
3. **Start services**
   - `docker compose -f docker-compose.v2.yml up -d traefik postgres-prod redis-prod backend-prod fastpay-dashboard-prod redpay-dashboard-prod`
4. **Run migrations**
   - `docker compose -f docker-compose.v2.yml run --rm backend-prod python manage.py migrate`
5. **Check URLs**
   - See the verification checklist below for production URLs to test.

> You can run staging and production stacks at the same time because they use separate networks, DBs, and hostnames.

### 5. Verification checklist

After bringing up the new stack:

- Staging:
  - Open `https://staging.fastpaygaming.com/login` – FASTPAY staging login page loads.
  - Open `https://redpay-staging.fastpaygaming.com/login` – REDPAY staging login page loads.
  - Open `https://api-staging.fastpaygaming.com/health/` – API health check returns OK.
- Production:
  - Open `https://fastpaygaming.com/login` – FASTPAY production login page.
  - Open `https://redpay.fastpaygaming.com/login` – REDPAY production login page.
  - Open `https://api.fastpaygaming.com/health/` – API health check returns OK.

Use `curl -v` if needed to confirm:

- HTTP is redirected to HTTPS.
- Certificates are valid for each hostname.

