# Gmail & Drive OAuth – Staging and Production

How to configure Gmail/Drive login for **staging** and **production** so Connect Gmail / Drive works on your domains.

---

## Quick reference

| Variable | Staging | Production |
|----------|---------|------------|
| **Backend** | | |
| `GOOGLE_CLIENT_ID` | Same or staging OAuth client | Same or production OAuth client |
| `GOOGLE_CLIENT_SECRET` | Same as above | Same as above |
| `GOOGLE_REDIRECT_URI` | `https://sapi.fastpaygaming.com/api/gmail/callback/` | `https://api.your-domain.com/api/gmail/callback/` |
| `DASHBOARD_ORIGIN` | `https://staging.fastpaygaming.com` | `https://your-dashboard-domain.com` |
| **Dashboard** (build-time) | | |
| `VITE_API_BASE_URL` | `https://sapi.fastpaygaming.com` | `https://api.your-domain.com` |

**Rule:** `GOOGLE_REDIRECT_URI` must be the **backend** API callback URL (where Google redirects after sign-in). Add the exact same URL in Google Cloud Console → your OAuth client → **Authorized redirect URIs**.

---

## 1. Backend env files

### Staging (`BACKEND/.env.staging`)

Used by `docker-compose.staging.yml` and `deploy.sh staging`.

```bash
# Google OAuth – callback is the BACKEND URL (API receives the code from Google)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://sapi.fastpaygaming.com/api/gmail/callback/

# Where to send the user after OAuth (dashboard origin, no trailing slash)
DASHBOARD_ORIGIN=https://staging.fastpaygaming.com
```

### Production (`BACKEND/.env.production`)

Used by `deploy.sh production` (and `ENV_FILE=.env.production` in docker-compose).

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://api.your-domain.com/api/gmail/callback/
DASHBOARD_ORIGIN=https://your-dashboard-domain.com
```

- Replace `api.your-domain.com` with your real API host (e.g. `api.fastpaygaming.com`).
- Replace `your-dashboard-domain.com` with the URL users use for the dashboard (e.g. `staging.fastpaygaming.com` for staging, `fastpaygaming.com` or `dashboard.fastpaygaming.com` for production).

---

## 2. Dashboard env files (build-time)

Vite bakes these into the build. Use the correct file for each deploy target. **Use DASHBOARD_FASTPAY** (and **DASHBOARD_REDPAY** for RedPay).

### Staging (`DASHBOARD_FASTPAY/.env.staging`)

Used when you run: `cd DASHBOARD_FASTPAY && ./deploy.sh staging` (or `npm run build -- --mode staging`).

```bash
# Backend API origin (no /api suffix – code adds /api when needed)
VITE_API_BASE_URL=https://sapi.fastpaygaming.com
```

Optional for legacy client-side token exchange only (main flow uses backend):

```bash
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_REDIRECT_URI=https://staging.fastpaygaming.com/auth/google/callback
```

### Production (`DASHBOARD_FASTPAY/.env.production`)

Used when you run: `cd DASHBOARD_FASTPAY && ./deploy.sh production`.

```bash
VITE_API_BASE_URL=https://api.your-domain.com
```

Again, optional for legacy flow:

```bash
VITE_GOOGLE_REDIRECT_URI=https://your-dashboard-domain.com/auth/google/callback
```

---

## 3. Google Cloud Console

One OAuth client can list **multiple** redirect URIs and JavaScript origins (staging + production).

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Edit your OAuth 2.0 Client ID (Web application).

3. **Authorized JavaScript origins** (where the OAuth flow starts – the dashboard):
   - Staging: `https://staging.fastpaygaming.com`
   - Production: `https://your-dashboard-domain.com`  
   No trailing slash. Add both if you use staging and production.

4. **Authorized redirect URIs** (where Google sends the user after sign-in – the backend):
   - Staging: `https://sapi.fastpaygaming.com/api/gmail/callback/`
   - Production: `https://api.your-domain.com/api/gmail/callback/`  
   Must match backend `GOOGLE_REDIRECT_URI` exactly (including trailing slash).

5. Save.

6. **Enable APIs:** In APIs & Services → Library, enable **Gmail API**, **Google Drive API**, and **Google Sheets API** for the same project. The OAuth flow requests Gmail, Drive, and Sheets scopes in a single sign-in; all three APIs must be enabled or consent/API calls can fail.

**Why all three?** The dashboard (JavaScript origin) sends the user to Google; Google then redirects to the backend (redirect URI) with the code. Both must be authorized.

**Single connection:** One "Connect Gmail & Drive" grants Gmail, Drive, and Sheets access. There is no separate Drive or Sheets connect; the same OAuth URL includes all scopes.

**State parameter:** The backend signs the OAuth `state` (HMAC with `SECRET_KEY`) so the callback can verify it without using session storage. That allows the flow to work when the dashboard and API are on different subdomains (e.g. staging.fastpaygaming.com and sapi.fastpaygaming.com), where the API session cookie is not sent on the callback.

---

## 4. Deploy flow

### Staging (e.g. `deploy-all.sh`)

1. **Dashboard:** Build with staging env so `VITE_API_BASE_URL` points to staging API.
   ```bash
   cd DASHBOARD_FASTPAY && ./deploy.sh staging
   ```
   Uses `DASHBOARD_FASTPAY/.env.staging`.

2. **Backend:** Deploy with staging env.
   ```bash
   cd BACKEND && ./deploy.sh staging
   ```
   Uses `BACKEND/.env.staging` (must include `GOOGLE_REDIRECT_URI` and `DASHBOARD_ORIGIN`).

3. **Host nginx:** If not already done, apply staging config so `staging.fastpaygaming.com` and `sapi.fastpaygaming.com` point to the right ports.
   ```bash
   sudo BACKEND/nginx/apply-staging-on-host.sh
   ```

### Production

1. **Dashboard:** Build with production env.
   ```bash
   cd DASHBOARD_FASTPAY && ./deploy.sh production
   ```
   Uses `DASHBOARD_FASTPAY/.env.production`.

2. **Backend:** Deploy with production env.
   ```bash
   cd BACKEND && ./deploy.sh production
   ```
   Uses `BACKEND/.env.production`.

---

## 5. Checklist

- [ ] **Backend** `GOOGLE_REDIRECT_URI` = full backend callback URL (with `/api/gmail/callback/`).
- [ ] **Backend** `DASHBOARD_ORIGIN` = dashboard origin (no trailing slash).
- [ ] **Dashboard** `VITE_API_BASE_URL` = backend API origin (same host as in `GOOGLE_REDIRECT_URI`, no path).
- [ ] **Google Console** Authorized redirect URIs include both staging and production backend callback URLs.
- [ ] Rebuild dashboard after changing any `VITE_*` variable; restart backend after changing backend env.

---

## 6. How to check (debug)

**See what the backend is using (no secrets):** Open **https://sapi.fastpaygaming.com/api/gmail/oauth-debug/** (or http://localhost:8001/api/gmail/oauth-debug/). The response shows `client_id` and `redirect_uri`. In Google Cloud Console, the **same** Client ID must have that **exact** `redirect_uri` in **Authorized redirect URIs**.

**See the exact error from Google:** When Google shows an error, check the browser address bar (often `?error=...&error_description=...`) or DevTools (F12) → Network → the request to accounts.google.com.

**Common mismatch:** Wrong OAuth client (app uses one Client ID, you edited another in Console), or trailing slash difference, or wrong Google Cloud project.

---

## 7. Post-connect checklist (what to check after Gmail/Drive works)

- **Same email:** The backend links Gmail to the **dashboard user email** (the one you’re logged in as when you click "Connect Gmail"). Verify you’re logged in with that same email when checking the list.
- **Dashboard – Gmail tab:** You should see "Connected" and your Gmail address; the inbox list loads; you can use **Refresh**, **Search**, and open an email.
- **Dashboard – Drive tab:** Same Google account; Drive files and storage info should load.
- **API – status:** `GET /api/gmail/status/?user_email=YOUR_DASHBOARD_EMAIL` should return `"connected": true` and `gmail_email`.
- **API – Gmail list:** `GET /api/gmail/messages/?user_email=YOUR_DASHBOARD_EMAIL&max_results=10` should return `messages` (array of id, subject, from_email, snippet, date).
- **Redirect after OAuth:** You land on the dashboard with the success toast and the Google tab open.
- **Disconnect:** "Disconnect" clears the link for that dashboard user.

---

## 8. Troubleshooting

| Symptom | Check |
|--------|--------|
| "Redirect URI mismatch" from Google | `GOOGLE_REDIRECT_URI` in backend env must match **exactly** the URI in Google Console (including trailing slash). |
| User lands on JSON after Gmail sign-in | Set `DASHBOARD_ORIGIN` in backend env so the backend can redirect to the dashboard. |
| Dashboard "Failed to initialize Gmail auth" | Dashboard build must have correct `VITE_API_BASE_URL` for the environment (staging vs production). Rebuild after changing. |
| "Invalid state parameter" after Google sign-in | Backend uses signed state (no session). Ensure backend `SECRET_KEY` is set and consistent. State expires in 10 min; try again if stale. |
| Drive "Failed to list files" / insufficient scopes | Enable **Google Drive API** in Cloud Console (APIs & Services → Library). Then **disconnect** in the dashboard and **connect again** once so the new token includes Drive scopes. |
| Works locally but not on domain | Ensure you’re not using `localhost` in `GOOGLE_REDIRECT_URI` or `VITE_API_BASE_URL` for the deployed build. |
