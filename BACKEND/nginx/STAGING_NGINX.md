# Staging Nginx

**Staging is served by host nginx.** TLS and routing are on the host; no other reverse proxy (e.g. Traefik) is used. This doc describes the staging nginx layout: host nginx proxies to the staging Docker stack (ports 8888, 8001) and serves RedPay static from dist.

**Quick public setup:** See **[STAGING_PUBLIC_SETUP.md](STAGING_PUBLIC_SETUP.md)** for step-by-step nginx + SSL + RedPay dist.

---

## How to deploy staging (quick steps)

**Step 1 — Deploy (from your repo root)**  
Runs with your **local code only** (no git pull unless you add `--pull`):

```bash
./deploy-all.sh --no-input
```

You should see: dashboard build, backend deploy, tests, and verification. If something fails, fix it before continuing.

**Step 2 — Apply nginx on the server**  
Do this on the machine where host nginx runs (once per deploy, or whenever you change nginx configs):

```bash
sudo ./BACKEND/nginx/apply-staging-on-host.sh
```

**Step 3 — Check that it works**

- Open https://staging.fastpaygaming.com/ (FastPay), https://sredpay.fastpaygaming.com/ (RedPay), https://sapi.fastpaygaming.com/api/ (API).
- Optional: run `./scripts/check-dns-a.sh` and `./BACKEND/scripts/check-staging-postdeploy.sh` from repo root.

**Result:** FastPay at https://staging.fastpaygaming.com/, RedPay at https://sredpay.fastpaygaming.com/, API at https://sapi.fastpaygaming.com/api/, admin at https://sadmin.fastpaygaming.com/admin/.

---

## Staging deploy at public URL (detailed)

1. **From repo root:** Run full staging deploy (local code only; add `--pull` to update from GitHub first):
   ```bash
   ./deploy-all.sh --no-input
   ```
   This builds the dashboard, deploys the backend with tests, and runs verification. It also runs `run-staging-tests.sh` if present (failures there only produce a warning; deploy still succeeds).

2. **On the staging server** (once, or after nginx config changes): Apply host nginx so the public URLs work:
   ```bash
   sudo ./BACKEND/nginx/apply-staging-on-host.sh
   ```
   Custom config directory: `sudo NGINX_CONF_D=/etc/nginx/sites-available ./BACKEND/nginx/apply-staging-on-host.sh`

3. **Result:** FastPay at https://staging.fastpaygaming.com/, RedPay at https://sredpay.fastpaygaming.com/, API at https://sapi.fastpaygaming.com/api/, admin at https://sadmin.fastpaygaming.com/admin/.

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
│  sredpay.fastpaygaming.com → root /desktop/fastpay/DASHBOARD_REDPAY/dist + proxy /api,/admin → 8001 │
│  sapi.fastpaygaming.com → proxy_pass http://127.0.0.1:8001 │
│  sadmin.fastpaygaming.com → proxy_pass http://127.0.0.1:8001│
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
- **Modular configs**: One file per concern (HTTP redirect, dashboard, api, admin, redpay). Numbered so load order is explicit.
- **Adding another environment** (e.g. preprod): Copy the five `staging-*.conf` files (excluding deprecated), rename to `preprod-*.conf`, change server_name and upstream ports, obtain certs, reload.

## Config Files (Host Nginx)

These live in `BACKEND/nginx/conf.d/staging/` and are **deployed to the host** as `staging-00-http.conf`, … (e.g. copied to `/etc/nginx/conf.d/` on the server).

| File | Purpose |
|------|--------|
| `00-http.conf` | Listen 80; ACME challenge for certbot; 301 redirect to HTTPS for all staging hostnames (staging, sapi, sadmin, sredpay). Deployed as `staging-00-http.conf`. |
| `01-dashboard.conf` | HTTPS server for `staging.fastpaygaming.com`; proxy to `http://127.0.0.1:8888`. Deployed as `staging-01-dashboard.conf`. |
| `02-api.conf` | HTTPS server for `sapi.fastpaygaming.com`; proxy to `http://127.0.0.1:8001`. Deployed as `staging-02-api.conf`. |
| `03-admin.conf` | HTTPS server for `sadmin.fastpaygaming.com`; proxy to `http://127.0.0.1:8001`. Deployed as `staging-03-admin.conf`. |
| `04-redpay.conf` | HTTPS server for `sredpay.fastpaygaming.com`; root `/desktop/fastpay/DASHBOARD_REDPAY/dist`; proxy `/api/`, `/admin/`, `/static/`, `/media/` to `http://127.0.0.1:8001`. Deployed as `staging-04-redpay.conf`. |

**Upstream convention**

- Dashboard: `127.0.0.1:8888` (staging nginx container).
- API/Admin: `127.0.0.1:8001` (staging web container).  
If host nginx runs inside Docker and must reach host ports, use `host.docker.internal` instead of `127.0.0.1` (documented in each config).

## SSL (Let's Encrypt)

**Staging hostnames (staging, sapi, sadmin, sredpay) use the wildcard cert** for `*.fastpaygaming.com`. Ensure DNS A records for `sapi.fastpaygaming.com`, `sadmin.fastpaygaming.com`, and `sredpay.fastpaygaming.com` point to this VPS. See [WILDCARD_CERT.md](WILDCARD_CERT.md).

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
This copies the 5 staging configs from `conf.d/staging/` to `/etc/nginx/conf.d/` as `staging-00-http.conf` … `staging-04-redpay.conf`, removes old/deprecated staging configs (including `staging-04-axisurgent.conf`, `staging-05-redpay.conf`), runs `nginx -t`, and reloads nginx.

**Option B – manual steps:**

1. **Start staging stack** (from repo root):
   ```bash
   cd BACKEND && docker compose -f docker-compose.staging.yml -p fastpay-staging up -d
   ```
   Ensure port 8888 (dashboard) and 8001 (API) are listening.

2. **On the server**, copy the five staging configs to host nginx:
   ```bash
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging/00-http.conf /etc/nginx/conf.d/staging-00-http.conf
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging/01-dashboard.conf /etc/nginx/conf.d/staging-01-dashboard.conf
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging/02-api.conf /etc/nginx/conf.d/staging-02-api.conf
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging/03-admin.conf /etc/nginx/conf.d/staging-03-admin.conf
   sudo cp /path/to/FASTPAY_BASE/BACKEND/nginx/conf.d/staging/04-redpay.conf /etc/nginx/conf.d/staging-04-redpay.conf
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
   - https://staging.fastpaygaming.com/ → FastPay dashboard (redirects to /test/, login).
   - https://sredpay.fastpaygaming.com/ → RedPay dashboard.
   - https://sapi.fastpaygaming.com/api/ → API.
   - https://sadmin.fastpaygaming.com/admin/ → Django admin.

## Verify staging (after deploy)

After every staging deploy, run the post-deploy checks from repo root (on the server or from a machine that can reach the staging URLs):

```bash
./BACKEND/scripts/check-staging-postdeploy.sh
# Optionally, to verify DNS A records point to this VPS:
./scripts/check-dns-a.sh
# Or full DNS (A + AAAA) report: ./BACKEND/scripts/check-dns.sh
```

If any check fails (non-200/302 on key URLs or DNS mismatch), treat the deploy as **failed** and fix before promoting or re-deploying. To verify nginx on the host: `sudo nginx -t && sudo systemctl status nginx`. Local backend health: `curl -s http://127.0.0.1:8001/health/` should return `ok` when the staging stack is up.

## RedPay staging – ready after DNS update

Once **sredpay.fastpaygaming.com** points to this server, make the site ready:

1. **Add certificate (fixes HTTPS)**  
   RedPay staging uses the **wildcard** cert for `*.fastpaygaming.com`. Ensure it exists on the server (see [WILDCARD_CERT.md](WILDCARD_CERT.md)):
   ```bash
   # From repo root on the server – DNS-01: add TXT _acme-challenge.fastpaygaming.com when prompted
   ./BACKEND/scripts/certbot-wildcard-fastpaygaming.sh
   ```
   If the cert already exists, you can skip or run `sudo certbot renew --cert-name fastpaygaming.com`. Certs go to `/etc/letsencrypt/live/fastpaygaming.com/` (used by `staging-04-redpay.conf`).

2. **Apply host nginx** (from repo root, e.g. `/desktop/fastpay`):
   ```bash
   sudo ./BACKEND/nginx/apply-staging-on-host.sh
   ```
   Then: `sudo nginx -t && sudo systemctl reload nginx`

3. **Ensure RedPay dashboard is built** (if not already):
   ```bash
   cd DASHBOARD_REDPAY && npm ci && ./deploy.sh staging
   ```
   This produces `/desktop/fastpay/DASHBOARD_REDPAY/dist` (or your staging base path). Nginx serves this at `https://sredpay.fastpaygaming.com/`.

4. **Ensure staging backend is up** (API at 8001):
   ```bash
   cd BACKEND && ./deploy.sh staging
   ```

5. **Verify**: open https://sredpay.fastpaygaming.com/ — you should see the RedPay dashboard; `/api/` and `/admin/` are proxied to the staging backend.

## Docker Staging (Unchanged)

The staging stack (`docker-compose.staging.yml`) and container nginx config (`nginx/conf.d/staging/`) stay as they are:

- Nginx in Docker listens on 80, mapped to host 8888.
- Serves dashboard from `/usr/share/nginx/html/test` (DASHBOARD_FASTPAY/dist when mounted).
- Proxies `/test/api/` and `/test/admin/` to `web:8000`.

No SSL in Docker; host does SSL and proxies to 8888 and 8001.

## Deprecated Configs

In the repo, old staging configs are in `conf.d.deprecated/` (not loaded). On the **host**, ensure `/etc/nginx/conf.d/` does not contain any of these (they are replaced by the six `staging-0*.conf` files):

- `staging-subdomains.conf`, `staging-subdomain-proxy.conf`, `staging-proxy.conf`, `staging-proxy-ssl.conf`, `staging-standalone.conf`, `acme-staging.conf`, `api-staging-subdomain.conf`, `admin-staging-subdomain.conf`

## Adding Another Environment (e.g. Preprod)

1. Copy the four `staging-*` conf files to `preprod-00-http.conf`, `preprod-01-dashboard.conf`, etc.
2. Replace `staging.fastpaygaming.com` with e.g. `preprod.fastpaygaming.com` (and api/admin subdomains).
3. Replace upstream ports if different (e.g. 8889, 8002).
4. Run certbot for the new domains.
5. Reload nginx.

Same pattern for any future environment.
