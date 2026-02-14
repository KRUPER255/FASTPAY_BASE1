# Dashboard sync (Option B)

DASHBOARD_FASTPAY and DASHBOARD_REDPAY are kept as **two full copies** (Option B). This doc is the sync checklist so shared behavior stays aligned.

## Roles

- **DASHBOARD_FASTPAY** — Core. Single source of truth for shared behavior; deploy for FastPay URLs.
- **DASHBOARD_REDPAY** — Variant. Same structure; build with `VITE_REDPAY_ONLY=true` for RedPay URLs. When you change shared code, apply the same change in both.

## Sync checklist

When you change any of the following in one dashboard, apply the same change in the other:

- **Auth / API:** `src/lib/auth.ts`, `src/lib/api-client.ts`, `src/lib/validation/`
- **Firebase:** `src/lib/firebase.ts`, `src/lib/firebase-helpers.ts`, `src/lib/firebase-sync.ts`
- **Shared UI:** `src/component/` (e.g. `UnifiedLayout.tsx`, `DeviceSidebar.tsx`, `ui/`), `src/lib/branding.ts`
- **Hooks:** `src/hooks/`
- **Build / deploy:** `vite.config.ts`, `deploy.sh`, `package.json` (dependencies and scripts)
- **Env:** `.env.example` (except RedPay-only vars like `VITE_REDPAY_ONLY` in DASHBOARD_REDPAY)

## RedPay-only differences (do not sync)

- **DASHBOARD_REDPAY** only: `VITE_REDPAY_ONLY=true` in `.env.example` and in `deploy.sh`; `RedPayApp.tsx` and minimal routes used when that env is set; `DASHBOARD_DOCUMENTATION.md`, `Dockerfile`, `nginx.conf` if present only there.

## Verification

Before pushing changes that touch shared code, run:

```bash
./scripts/check-dashboard-sync.sh
```

This builds both dashboards (RedPay with `VITE_REDPAY_ONLY=true`) and runs their test suites. If either build fails, fix before pushing. Options:

- `--build-only` — Skip test steps.
- `--skip-redpay` — Only build and test DASHBOARD_FASTPAY.

CI runs the same checks on push/PR when `DASHBOARD_FASTPAY/**` or `DASHBOARD_REDPAY/**` change (see `.github/workflows/dashboard-build-test.yml`).

## Optional: diff check

To catch accidental drift, you can diff key dirs (e.g. `src/lib`, `src/component`, `src/hooks`, `vite.config.ts`) between DASHBOARD_FASTPAY and DASHBOARD_REDPAY and fail CI or a pre-push hook if differences appear outside an allowlist (e.g. `branding.ts` content, or RedPay-only files).

## References

- [VPS_DEPLOY_STRUCTURE.md](VPS_DEPLOY_STRUCTURE.md) — Build matrix, env, and deploy layout.
- [.cursor/rules/subdomain-staging-production.mdc](../.cursor/rules/subdomain-staging-production.mdc) — Subdomain convention (e.g. `sredpay` = staging RedPay).
