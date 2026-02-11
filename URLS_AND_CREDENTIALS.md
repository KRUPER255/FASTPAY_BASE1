# FastPay – Public URLs & default staging credentials

## Public URLs

| Environment | Dashboard | API |
|-------------|-----------|-----|
| **Staging** | https://staging.fastpaygaming.com/ | https://api-staging.fastpaygaming.com/api/ |
| **Production** | https://fastpaygaming.com/ | https://api.fastpaygaming.com/api/ |

### Staging – direct links

- **Login:** https://staging.fastpaygaming.com/login  
- **Dashboard (legacy):** https://staging.fastpaygaming.com/dashboard  
- **Dashboard v2 (5 sections):** https://staging.fastpaygaming.com/dashboard/v2  

### Production – direct links

- **Login:** https://fastpaygaming.com/login  
- **Dashboard:** https://fastpaygaming.com/dashboard  
- **Dashboard v2:** https://fastpaygaming.com/dashboard/v2  

---

## Default staging credentials

Used only for **staging**. Login form is pre-filled with these when the app is built in staging mode.

| Field    | Value                    |
|----------|--------------------------|
| **Email**    | `superadmin@fastpay.com` |
| **Password** | `superadmin123`          |

**One-click:** Open https://staging.fastpaygaming.com/login and click **Sign In** (fields are already filled).

---

## Backend (create default staging user)

On the server or in Docker:

```bash
python manage.py create_super_admin --email superadmin@fastpay.com --password superadmin123
```

Optional: run this in `deploy.sh` for staging after migrations.

