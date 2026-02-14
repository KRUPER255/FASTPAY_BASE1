# FastPay – Public URLs & default staging credentials

**All URLs below point to this VPS** (domain: `fastpaygaming.com` and subdomains). Staging and production are on the same host; nginx and DNS route by subdomain.

## Public URLs

### FastPay dashboard (DASHBOARD_FASTPAY – core)

| Environment | Dashboard | API |
|-------------|-----------|-----|
| **Staging** | https://staging.fastpaygaming.com/ | https://sapi.fastpaygaming.com/api/ |
| **Production** | https://fastpaygaming.com/ | https://api.fastpaygaming.com/api/ |

### RedPay dashboard (DASHBOARD_REDPAY – variant)

| Environment | Dashboard | Notes |
|-------------|-----------|--------|
| **Staging** | https://sredpay.fastpaygaming.com/ | Same VPS; API: https://sapi.fastpaygaming.com/api/ |
| **Production** | https://redpay.fastpaygaming.com/ | This VPS; add nginx server block when RedPay is deployed. |

**Not on this VPS:** `https://owner.fastpaygaming.com/` is a separate deployment (not hosted on this VPS).

### Staging – direct links

- **FastPay login:** https://staging.fastpaygaming.com/login  
- **FastPay dashboard (legacy):** https://staging.fastpaygaming.com/dashboard  
- **FastPay dashboard v2 (5 sections):** https://staging.fastpaygaming.com/dashboard/v2  
- **RedPay staging:** https://sredpay.fastpaygaming.com/  

### Production – direct links

- **Login:** https://fastpaygaming.com/login  
- **Dashboard:** https://fastpaygaming.com/dashboard  
- **Dashboard v2:** https://fastpaygaming.com/dashboard/v2  

---

## Owner credentials (FastPay, Django Admin, RedPay)

Create owner accounts for FastPay, Django Admin, and RedPay. Run once per environment after migrations:

```bash
# In BACKEND directory or inside backend web container:
python manage.py create_owner_credentials
```

Optional args: `--fastpay-email`, `--fastpay-password`, `--fastpay-name`, `--redpay-email`, `--redpay-password`, `--redpay-name`.

**Default users created:**

| System              | Email               | Default password | Access              |
|---------------------|---------------------|------------------|---------------------|
| **FastPay & Django Admin** | owner@fastpay.com   | fastpay123       | Full Admin, /admin/ |
| **RedPay**          | owner@redpay.com    | redpay123        | RedPay dashboard    |

---

## Default staging credentials

Used only for **staging**. Login form is pre-filled with these when the app is built in staging mode.

| Field    | Value                    |
|----------|--------------------------|
| **Email**    | `superadmin@fastpay.com` |
| **Password** | `superadmin123`          |

**One-click:** Open https://staging.fastpaygaming.com/login and click **Sign In** (fields are already filled).

---

## FastPay and RedPay dashboard login users

Create login users for **FastPay** and **RedPay** dashboards (staging or production). Run once per environment after migrations:

```bash
# In BACKEND directory or inside backend web container:
python manage.py create_dashboard_users
```

Optional args: `--fastpay-email`, `--fastpay-password`, `--fastpay-name`, `--redpay-email`, `--redpay-password`, `--redpay-name`.

**Default users created:**

| Dashboard | Email              | Default password  | Access   |
|-----------|--------------------|-------------------|----------|
| **FastPay** | admin@fastpay.com  | FastPayAdmin123   | Full Admin (all dashboards) |
| **RedPay**  | redpay@fastpay.com | RedPayUser123     | RedPay   |

Use these at **/login** on each dashboard (e.g. https://fastpaygaming.com/login, https://redpay.fastpaygaming.com/login). Change passwords after first login if needed.

---

## Backend (create default staging user)

On the server or in Docker:

```bash
python manage.py create_super_admin --email superadmin@fastpay.com --password superadmin123
```

Optional: run this in `deploy.sh` for staging after migrations.

