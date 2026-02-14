# Nginx: api, admin, redpay + welcome (csapay, bropay, hypay, kypay)

**Production and staging both have:** dashboard, API, admin, RedPay (different subdomains; staging uses `s` prefix). This file describes the **production** api/admin/redpay and welcome config.

## What’s configured

| Host | Purpose |
|------|--------|
| `api.fastpaygaming.com` | Root `/` = **link to join** page; `/api/`, `/admin/`, etc. proxy to backend at `127.0.0.1:8000` |
| `admin.fastpaygaming.com` | Root `/` = **link to join** page; `/admin/` and rest proxy to backend at `127.0.0.1:8000` |
| `redpay.fastpaygaming.com` | Root `/` = **link to join** page; all other paths proxy to RedPay dashboard at `127.0.0.1:8082` |
| `csapay`, `bropay`, `hypay`, `kypay`.fastpaygaming.com | Welcome page only (static from `/var/www/welcome`) |

Api, admin, and redpay do **not** show a welcome letter at root; they show a **link to join** (to fastpaygaming.com). Only csapay, bropay, hypay, kypay use the welcome page.

SSL uses the wildcard cert: `/etc/letsencrypt/live/fastpaygaming.com/`.

## Apply on the server

1. **Port 80/443**: Ensure host nginx can bind to 80/443 (no other process using those ports).
2. **Backend and RedPay on host ports**: Nginx proxies to `127.0.0.1:8000` (backend) and `127.0.0.1:8082` (RedPay). Ensure the backend and RedPay dashboard containers expose those ports when you run them (e.g. in docker-compose: backend `8000:8000`, redpay-dashboard `8082:80`).
3. From repo root:
   ```bash
   chmod +x BACKEND/nginx/apply-prod-api-admin-redpay-welcome.sh
   ./BACKEND/nginx/apply-prod-api-admin-redpay-welcome.sh
   ```
4. Start nginx (if not already running):
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

## Files

- **Config**: `BACKEND/nginx/conf.d/production/03-api-admin-redpay-welcome.conf` (deployed to `/etc/nginx/conf.d/prod-03-api-admin-redpay-welcome.conf`).
- **Join page** (api, admin, redpay root): `BACKEND/nginx/html/join/index.html` (deployed to `/var/www/join/`). “Link to join” → fastpaygaming.com.
- **Welcome page** (csapay, bropay, hypay, kypay): `BACKEND/nginx/html/welcome/index.html` (deployed to `/var/www/welcome/`). Shows “Welcome to &lt;subdomain&gt;”.

## Subdomain convention

- **Production**: `api`, `admin`, `redpay` (no `s` prefix).
- **Welcome-only**: `csapay`, `bropay`, `hypay`, `kypay` (see `.cursor/rules/subdomain-staging-production.mdc` for `s` = staging).
