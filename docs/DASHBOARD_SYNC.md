# Dashboard apps – sync and roles

**Core:** **DASHBOARD_FASTPAY** is the common reference (core). All main dashboard development and fixes should be done there first.

**Variant:** **DASHBOARD_REDPAY** is the RedPay variant. It shares most code with DASHBOARD_FASTPAY but has RedPay-specific entrypoints and a few differing files (e.g. Gmail/Drive OAuth redirect, dashboard sections, RedPay app shell).

**Legacy/fallback:** **DASHBOARD** is used only when DASHBOARD_FASTPAY is missing (e.g. deploy fallback). It is not the single source of truth.

---

## Scoping (Phase 3)

- **DASHBOARD vs DASHBOARD_FASTPAY:** `diff -rq DASHBOARD/src DASHBOARD_FASTPAY/src` — identical (no output).
- **DASHBOARD_FASTPAY vs DASHBOARD_REDPAY:** A small set of files differ (e.g. `RedPayApp.tsx`, `backend-gmail-api.ts`, `dashboard-sections.ts`, `DeviceSubTabs.tsx`, `DriveSection.tsx`, `GmailSection.tsx`, `DeviceSectionView.tsx`). REDPAY also has `pages/redpay/RedpayDashboard.tsx` only in REDPAY.
- **File counts (TS/TSX):** DASHBOARD 231, DASHBOARD_FASTPAY 231, DASHBOARD_REDPAY 232.

---

## When to sync (Option C – manual)

If you change shared logic in **DASHBOARD_FASTPAY** that should also apply to **DASHBOARD_REDPAY**:

1. **Paths to consider copying or diffing:**  
   `src/lib/*`, `src/component/*`, `src/pages/dashboard/**` (except RedPay-specific entrypoints). The differing files listed above are the ones that are intentionally different (branding, OAuth callback, RedPay dashboard); other changes in FASTPAY may be worth porting to REDPAY.

2. **Process:**  
   - Make the change in DASHBOARD_FASTPAY (core).  
   - For each file you changed, if it is not one of the known differing files, consider copying or merging to DASHBOARD_REDPAY (e.g. `diff` then manual merge).  
   - Run `npm run build` (or `build:check`) in both apps after sync.

3. **Frequency:**  
   Ad hoc when you touch shared areas (auth, api-client, firebase-helpers, sidebar-tabs, shared components). No automated sync; this doc is the single reference for the process.

---

## Future shared codebase (Options A/B)

If you introduce a shared package (A) or monorepo with `packages/dashboard-core` (B), update this doc to point to the new layout and deprecate the manual sync steps above.
