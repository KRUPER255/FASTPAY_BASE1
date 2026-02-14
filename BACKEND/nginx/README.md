# Nginx config layout

Configs are grouped by **environment** under `conf.d/`. Apply scripts copy them to the host’s `/etc/nginx/conf.d/` with a prefix so load order is clear.

## Production and staging both have: dashboard, API, admin, RedPay

| Component   | Production | Staging |
|------------|------------|--------|
| **Dashboard** | fastpaygaming.com (apex) | staging.fastpaygaming.com |
| **API**       | api.fastpaygaming.com | sapi.fastpaygaming.com |
| **Admin**     | admin.fastpaygaming.com | sadmin.fastpaygaming.com |
| **RedPay**    | redpay.fastpaygaming.com | sredpay.fastpaygaming.com |

Same four services in both environments; subdomain convention: **s** prefix = staging (see `.cursor/rules/subdomain-staging-production.mdc`).

## Structure

```
BACKEND/nginx/
├── README.md                 # This file
├── nginx.conf                # Main config (http block; host uses its own)
├── conf.d/
│   ├── production/           # Production server blocks (fastpaygaming.com)
│   │   ├── 00-fastpay.conf   # Upstream + apex (fastpaygaming.com, www) + health
│   │   ├── 01-api.conf       # api.fastpaygaming.com
│   │   ├── 02-owner.conf     # owner.fastpaygaming.com (Guacamole)
│   │   └── 03-api-admin-redpay-welcome.conf  # api, admin, redpay: root = link to join; proxy for app paths; csapay/bropay/hypay/kypay = welcome
│   └── staging/
│       ├── 00-http.conf      # HTTP → HTTPS redirect + ACME
│       ├── 01-dashboard.conf # staging.fastpaygaming.com
│       ├── 02-api.conf       # sapi
│       ├── 03-admin.conf     # sadmin
│       └── 04-redpay.conf    # sredpay
├── html/                     # Static files (deployed to /var/www/...)
│   ├── api-index.html
│   └── welcome/
│       └── index.html
├── deprecated/               # Old configs – do not deploy
├── apply-prod-api-admin-redpay-welcome.sh
├── apply-staging-on-host.sh
├── fix-fastpay-certs-on-host.sh
├── PROD_API_ADMIN_REDPAY_WELCOME.md
├── STAGING_NGINX.md
└── WILDCARD_CERT.md
```

## Deploy (on server)

- **Production (api, admin, redpay, welcome):**  
  `./BACKEND/nginx/apply-prod-api-admin-redpay-welcome.sh`  
  Copies `conf.d/production/03-api-admin-redpay-welcome.conf` + welcome HTML.

- **Staging:**  
  `sudo ./BACKEND/nginx/apply-staging-on-host.sh`  
  Copies all `conf.d/staging/*.conf` and removes old/deprecated staging configs.

Host nginx typically uses `include /etc/nginx/conf.d/*.conf;`. Apply scripts write files with names like `prod-03-api-admin-redpay-welcome.conf` and `staging-00-http.conf` so production vs staging and order are obvious.

## SSL

Wildcard cert for `*.fastpaygaming.com`: see **WILDCARD_CERT.md**.
