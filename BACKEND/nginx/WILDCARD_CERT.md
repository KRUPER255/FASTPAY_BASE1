# Wildcard certificate for fastpaygaming.com and all subdomains

**If fastpaygaming.com, www, api, or owner are failing (cert errors):** run on the server (from repo root):
```bash
sudo ./BACKEND/nginx/fix-fastpay-certs-on-host.sh
```
That copies configs so api and owner use their existing certs, obtains the apex cert (fastpaygaming.com + www) via HTTP-01, and reloads nginx. No DNS required.

---

All `*.fastpaygaming.com` subdomains can use a **single Let's Encrypt wildcard certificate**. One cert covers:

- `fastpaygaming.com`, `www.fastpaygaming.com`
- `api.fastpaygaming.com`
- `staging.fastpaygaming.com`, `sapi.fastpaygaming.com`, `sadmin.fastpaygaming.com`, `sredpay.fastpaygaming.com`
- `owner.fastpaygaming.com`
- Any future subdomain

## Cert path (used by all nginx configs)

- **Full chain:** `/etc/letsencrypt/live/fastpaygaming.com/fullchain.pem`
- **Private key:** `/etc/letsencrypt/live/fastpaygaming.com/privkey.pem`

If your host nginx uses a different base (e.g. `/etc/nginx/ssl`), symlink so this path exists:

```bash
sudo mkdir -p /etc/nginx/ssl/live
sudo ln -s /etc/letsencrypt/live/fastpaygaming.com /etc/nginx/ssl/live/fastpaygaming.com
```

Then in nginx configs you can keep the path as `/etc/letsencrypt/live/fastpaygaming.com/` and add a symlink from `/etc/nginx/ssl/live/fastpaygaming.com` → `/etc/letsencrypt/live/fastpaygaming.com`, or change the configs to `/etc/nginx/ssl/live/fastpaygaming.com/` if you prefer. The repo configs use `/etc/letsencrypt/live/fastpaygaming.com/`.

## Obtaining the wildcard cert (one-time or renewal)

Wildcard certs require **DNS-01** challenge (you add a TXT record for `_acme-challenge.fastpaygaming.com`).

### Option 1: Script (interactive DNS)

From repo root **on the server**:

```bash
./BACKEND/scripts/certbot-wildcard-fastpaygaming.sh
```

1. Certbot will print a line like: **"with the following value: XXXXXXXXX"**
2. At your DNS provider, add a **TXT** record:  
   - Name: `_acme-challenge.fastpaygaming.com` (or `_acme-challenge` if the provider appends the domain).
   - Value: the string certbot showed.
3. Wait 1–2 minutes for DNS to propagate (optional: `dig -t TXT _acme-challenge.fastpaygaming.com +short`).
4. In the same terminal, **press Enter** so certbot continues and validates.

Certs will be written to `/etc/letsencrypt/live/fastpaygaming.com/`. Then run `sudo nginx -t && sudo systemctl reload nginx` and run `./BACKEND/scripts/check-urls-cert.sh` to verify all URLs.

### Option 2: Manual certbot

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.fastpaygaming.com" \
  -d "fastpaygaming.com" \
  --agree-tos \
  -m your-email@example.com
```

When prompted:

1. Add a **TXT** record: `_acme-challenge.fastpaygaming.com` = (value shown by certbot).
2. Wait for DNS propagation (often 1–5 minutes).
3. Press Enter in the certbot terminal to continue.

Certs will be in `/etc/letsencrypt/live/fastpaygaming.com/`.

### Renewal

Renewal also uses DNS-01. Set up a cron or systemd timer, or run manually:

```bash
sudo certbot renew --cert-name fastpaygaming.com
```

If you used the script with a custom `CONFIG_DIR`, use the same `CONFIG_DIR` when renewing, or ensure certbot’s default paths match what nginx uses.

## After obtaining or renewing the cert

1. Test nginx: `sudo nginx -t`
2. Reload nginx: `sudo systemctl reload nginx` (or your reload command)

Once the wildcard cert exists, update nginx configs in `conf.d/` to use `/etc/letsencrypt/live/fastpaygaming.com/` (see comments in each conf file). Until then, configs use per-domain cert paths so existing certs keep working.

### Check all URLs after cert changes

From repo root:

```bash
./BACKEND/scripts/check-urls-cert.sh
```

This curls each fastpaygaming.com HTTPS URL and lists certbot certificates. SSL_verify 0 = cert valid for that host.
