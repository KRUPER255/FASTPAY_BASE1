# Staging Nginx – Future-Proof Plan

This describes the **from-scratch** staging nginx layout: one clear architecture, modular configs, and a single place to add new environments later.

## Staging deploy at public URL (tested)

1. **From repo root:** Run full staging deploy with tests and verification:
   ```bash
   ./deploy-all.sh --no-input
   ```
   This builds the dashboard, deploys the backend **with tests**, and runs verification curls (local health, public dashboard, public API). It also runs `run-staging-tests.sh` if present (failures there only produce a warning; deploy still succeeds).

2. **On the staging server** (once, or after nginx config changes): Apply host nginx configs so the public URLs work:
   ```bash
   sudo ./BACKEND/nginx/apply-staging-on-host.sh
   ```
   Or with a custom config directory: `sudo NGINX_CONF_D=/etc/nginx/sites-available ./BACKEND/nginx/apply-staging-on-host.sh`

3. **Result:** Dashboard at https://staging.fastpaygaming.com/, API at https://api-staging.fastpaygaming.com/api/, admin at https://admin-staging.fastpaygaming.com/admin/. Backend test suite passes during deploy; optional `run-staging-tests.sh` provides extra checks.

## Architecture

```
Internet (HTTPS)
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Host Nginx (system nginx on server)                              │
│  - SSL termination (Let's Encrypt)                                │
│  - Reverse proxy only; no static files on host                    │
├──────────────────────────────────────────────────────────────────┤
│  staging.fastpaygaming.com     → proxy_pass http://127.0.0.1:8888 │
│  axisurgent.fastpaygaming.com  → proxy_pass http://127.0.0.1:8888 (→ /axisurgent) │
│  api-staging.fastpaygaming.com → proxy_pass http://127.0.0.1:8001 │
│  admin-staging.fastpaygaming.com → proxy_pass http://127.0.0.1:8001│
└──────────────────────────────────────────────────────────────────┘
       │                                    │
       ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────┐
│ Staging Docker      │          │ Staging Docker       │
│ nginx :8888         │          │ web (Django) :8001   │
│ - Serves dashboard  │          │ - /api/              │
│   at /test/         │          │ - /admin/            │
│ - Proxies /test/api │          │ - /static/, /media/   │
│   to web:8000       │          │                      │
└─────────────────────┘          └─────────────────────┘
```

**Principles**

- **Host nginx**: SSL + reverse proxy only. No `root` for dashboard; all app traffic goes to Docker.
- **One cert path**: `/etc/letsencrypt/live/<domain>/` (certbot default).
- **Modular configs**: One file per concern (HTTP redirect, dashboard, api, admin). Numbered so load order is explicit.
- **Adding another environment** (e.g. preprod): Copy the four `staging-*.conf` files, rename to `preprod-*.conf`, change server_name and upstream ports, obtain certs, reload.

## Config Files (Host Nginx)

These live in `BACKEND/nginx/conf.d/` and are **deployed to the host** (e.g. copied to `/etc/nginx/conf.d/` on the server).

| File | Purpose |
|------|--------|
| `staging-00-http.conf` | Listen 80; ACME challenge for certbot; 301 redirect to HTTPS for all three staging hostnames. |
| `staging-01-dashboard.conf` | HTTPS server for `staging.fastpaygaming.com`; proxy to `http://127.0.0.1:8888`. |
| `staging-04-axisurgent.conf` | HTTPS server for `axisurgent.fastpaygaming.com`; proxy to `http://127.0.0.1:8888`; `/` redirects to `/axisurgent`. |
| `staging-02-api.conf` | HTTPS server for `api-staging.fastpaygaming.com`; proxy to `http://127.0.0.1:8001`. |
| `staging-03-admin.conf` | HTTPS server for `admin-staging.fastpaygaming.com`; proxy to `http://127.0.0.1:8001`. |

**Upstream convention**

- Dashboard: `127.0.0.1:8888` (staging nginx container).
- API/Admin: `127.0.0.1:8001` (staging web container).  
If host nginx runs inside Docker and must reach host ports, use `host.docker.internal` instead of `127.0.0.1` (documented in each config).

## SSL (Let's Encrypt)

**All fastpaygaming.com subdomains use a single wildcard cert.** See [WILDCARD_CERT.md](WILDCARD_CERT.md).

One-time (from repo root, on the server):

```bash
./BACKEND/scripts/certbot-wildcard-fastpaygaming.sh
```

You will add a TXT record for `_acme-challenge.fastpaygaming.com` at your DNS provider when prompted. The cert is stored at:

- `/etc/letsencrypt/live/fastpaygaming.com/fullchain.pem`
- `/etc/letsencrypt/live/fastpaygaming.com/privkey.pem`

All staging configs (and production, api, owner) point at this path.

## Enabling Staging on the Host (result checklist)

**Option A – script on the server (after repo is on the server):**
```bash
# From repo root (FASTPAY_BASE):
sudo ./BACKEND/nginx/apply-staging-on-host.sh

# Or from the nginx folder:
cd BACKEND/nginx
sudo ./apply-staging-on-host.sh
```
Script path in repo: `BACKEND/nginx/apply-staging-on-host.sh`
This copies the 4 `staging-0*.conf` files to `/etc/nginx/conf.d/`, removes old staging configs there, runs `nginx -t`, and reloads nginx.

**Option B – manual steps:**

1. **Start staging stack** (from repo root):
   ```bash
   cd BACKEND && docker compose -f docker-compose.staging.yml -p fastpay-staging up -d
   ```
   Ensure port 8888 (dashboard) and 8001 (API) are listening.

2. **On the server**, copy the four staging configs to host nginx:
   ```bash
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging-00-http.conf /etc/nginx/conf.d/
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging-01-dashboard.conf /etc/nginx/conf.d/
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging-04-axisurgent.conf /etc/nginx/conf.d/
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging-02-api.conf /etc/nginx/conf.d/
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging-03-admin.conf /etc/nginx/conf.d/
   ```
   Remove any old staging configs from `/etc/nginx/conf.d/` (staging-subdomains, staging-subdomain-proxy, acme-staging, api-staging-subdomain, admin-staging-subdomain, etc.).

3. **ACME**: Ensure `/var/www/certbot` exists for certbot:
   ```bash
   sudo mkdir -p /var/www/certbot
   ```

4. **Obtain wildcard cert** (if not already done): see [WILDCARD_CERT.md](WILDCARD_CERT.md). From repo root: `./BACKEND/scripts/certbot-wildcard-fastpaygaming.sh`

5. **Test and reload nginx**:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

6. **Verify result**:
   - https://staging.fastpaygaming.com/ → dashboard (redirects to /test/, login).
   - https://axisurgent.fastpaygaming.com/ → AXISURGENT page (redirects to /axisurgent).
   - https://api-staging.fastpaygaming.com/api/ → API.
   - https://admin-staging.fastpaygaming.com/admin/ → Django admin.

## Docker Staging (Unchanged)

The staging stack (`docker-compose.staging.yml`) and container nginx config (`nginx/conf.d.staging/staging-standalone.conf`) stay as they are:

- Nginx in Docker listens on 80, mapped to host 8888.
- Serves dashboard from `/usr/share/nginx/html/test` (DASHBOARD/dist).
- Proxies `/test/api/` and `/test/admin/` to `web:8000`.

No SSL in Docker; host does SSL and proxies to 8888 and 8001.

## Deprecated Configs

In the repo, old staging configs are in `conf.d.deprecated/` (not loaded). On the **host**, ensure `/etc/nginx/conf.d/` does not contain any of these (they are replaced by the four `staging-0*.conf` files):

- `staging-subdomains.conf`, `staging-subdomain-proxy.conf`, `staging-proxy.conf`, `staging-proxy-ssl.conf`, `staging-standalone.conf`, `acme-staging.conf`, `api-staging-subdomain.conf`, `admin-staging-subdomain.conf`

## Adding Another Environment (e.g. Preprod)

1. Copy the four `staging-*` conf files to `preprod-00-http.conf`, `preprod-01-dashboard.conf`, etc.
2. Replace `staging.fastpaygaming.com` with e.g. `preprod.fastpaygaming.com` (and api/admin subdomains).
3. Replace upstream ports if different (e.g. 8889, 8002).
4. Run certbot for the new domains.
5. Reload nginx.

Same pattern for any future environment.
