# Dashboard v2 – Navigation check

Use this to verify all 5 sections of the new dashboard (`/dashboard/v2`) by navigation.

## Prerequisites

- **Staging:** The deployed build must include the `/dashboard/v2` route. If you see "No routes matched location \"/dashboard/v2\"" in the console, redeploy the dashboard (e.g. build and copy `dist/` to the server).
- **Local:** Run `npm run dev`. If you don’t have `VITE_FIREBASE_CONFIG` in `.env.local`, the app still loads (placeholder Firebase config); log in with an account that has API access (e.g. `VITE_API_BASE_URL` pointing at staging).

## Pages to check (one by one)

Open the dashboard, then use the top nav to open each section in order:

| # | Section  | What to do | What you should see |
|---|----------|------------|----------------------|
| 1 | **Device**   | Click **Device** (or leave default) | Device sidebar + main area with sub-tabs: Message, Google, Data, Utility, Command, Instruction, Permission |
| 2 | **Bankcard** | Click **Bankcard** | Add bank card section; if a device is selected, bank info and cards list |
| 3 | **Utility**  | Click **Utility** | Sub-tabs: Export, Activation failures, Activity logs, Telegram, Analytics |
| 4 | **API**      | Click **API** | API docs / endpoints section |
| 5 | **Profile**  | Click **Profile** | Profile card, View profile, Reset password, logout |

**Entry URL (after login):** Staging: https://staging.fastpaygaming.com/dashboard/v2 — Local: http://localhost:5173/dashboard/v2  
(Also: https://staging.fastpaygaming.com/ and https://staging.fastpaygaming.com/dashboard redirect to `/dashboard/v2`.)

## Steps

1. **Open the new dashboard**
   - Staging: `https://staging.fastpaygaming.com/dashboard/v2` (after logging in, or go there directly if already logged in).
   - Local: `http://localhost:5173/dashboard/v2` (redirects to `/login` if not authenticated).

2. **Confirm shell and nav**
   - You should see the 5-section nav: **Device** | **Bankcard** | **Utility** | **API** | **Profile**.
   - Default section is **Device** (and device sidebar is visible when Device is selected).

3. **Device**
   - Click **Device** (or leave it selected).
   - Expect: device list in sidebar; main area with device sub-tabs (Message, Google, Data, Utility, Command, Instruction, Permission).
   - Select a device and switch sub-tabs; no console errors.

4. **Bankcard**
   - Click **Bankcard**.
   - Expect: Add bank card section; if a device is selected, bank info and bank cards list.
   - No console errors.

5. **Utility**
   - Click **Utility**.
   - Expect: sub-tabs Export, Activation failures, Activity logs, Telegram, Analytics; each tab content loads.
   - No console errors.

6. **API**
   - Click **API**.
   - Expect: API section (docs/endpoints).
   - No console errors.

7. **Profile**
   - Click **Profile**.
   - Expect: profile card, “View profile”, “Reset password”, logout.
   - No console errors.

8. **Persistence**
   - Switch to **Profile**, refresh the page: selected section should remain **Profile** (stored in `localStorage` under `dashboard-v2-section`).

## Notes

- If staging shows a blank or “no route” for `/dashboard/v2`, redeploy the dashboard so the latest routes are in the built assets.
- Local dev: Firebase is optional for loading the app; set `VITE_FIREBASE_CONFIG` in `.env.local` for real Firebase features.

## Layout theme

To use a different dashboard layout theme (e.g. shadcn), set `VITE_DASHBOARD_LAYOUT_THEME=shadcn` in `.env` or `.env.local` and rebuild. Supported values: `default`, `shadcn`.
