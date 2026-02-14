# Public staging – nginx setup

Use this when you want **https://staging.fastpaygaming.com**, **https://sapi.fastpaygaming.com**, etc. (host nginx in front of the staging Docker stack).

## Prerequisites

- Staging deploy already done: `./deploy.sh staging --no-input [--skip-tests]`
- Host nginx installed on the same machine
- DNS A records for **staging**, **sapi**, **sadmin**, **sredpay**.fastpaygaming.com → this server’s IP

## 1. SSL (Let’s Encrypt)

One-time, on the server:

```bash
sudo mkdir -p /var/www/certbot
sudo ./BACKEND/scripts/certbot-staging.sh
# or wildcard: sudo ./BACKEND/scripts/certbot-fastpay-and-staging.sh
```

When prompted, add the TXT record for `_acme-challenge.fastpaygaming.com` at your DNS provider. Cert path used by the configs:

- `/etc/letsencrypt/live/fastpaygaming.com/fullchain.pem`
- `/etc/letsencrypt/live/fastpaygaming.com/privkey.pem`

(If you use a different cert path, edit the `ssl_certificate*` lines in `BACKEND/nginx/conf.d/staging/*.conf` before applying.)

## 2. Apply staging nginx configs

From the **repo root** on the server (e.g. `/root/Desktop/FASTPAY_BASE`):

```bash
sudo ./BACKEND/nginx/apply-staging-on-host.sh
```

This copies the 5 staging configs into your nginx config dir (e.g. `/etc/nginx/conf.d/`), runs `nginx -t`, and reloads nginx.

## 3. RedPay static (sredpay.fastpaygaming.com)

The **sredpay** vhost serves files from **/var/www/sredpay-dist**. After each RedPay dashboard build, sync the dist there:

```bash
sudo mkdir -p /var/www/sredpay-dist
sudo rsync -a --delete "$(pwd)/DASHBOARD_REDPAY/dist/" /var/www/sredpay-dist/
```

Or from repo root:

```bash
sudo ./BACKEND/nginx/sync-redpay-staging-dist.sh
```

(Optional: add that to your deploy or run it once after `./deploy.sh staging`.)

## 4. Dashboard API URL (public)

The FastPay dashboard must call the **public** API so the browser can reach it:

- In **DASHBOARD_FASTPAY/.env.staging** set:  
  `VITE_API_BASE_URL=https://sapi.fastpaygaming.com`
- Rebuild and deploy:  
  `cd DASHBOARD_FASTPAY && npm run build -- --mode staging`  
  (or run full staging deploy again)

## 5. Verify

- https://staging.fastpaygaming.com/ → FastPay dashboard (“Backend connected”)
- https://sapi.fastpaygaming.com/api/ → API (e.g. health)
- https://sadmin.fastpaygaming.com/admin/ → Django admin
- https://sredpay.fastpaygaming.com/ → RedPay dashboard (after step 3)

## Troubleshooting

- **502 Bad Gateway**: Backend or staging nginx not running. Check:  
  `docker compose -f BACKEND/docker-compose.staging.yml -p fastpay-staging ps`
- **Certificate errors**: Ensure certbot step completed and paths in the configs match.
- **Cannot reach backend** on login: Ensure `VITE_API_BASE_URL=https://sapi.fastpaygaming.com` and you rebuilt the dashboard; hard-refresh the page.
