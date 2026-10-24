# Runbook (POC)

## Run locally
1. `corepack pnpm install`; copy `.env.example` to `.env`; set `DATABASE_URL`/`DIRECT_URL` (Neon), `TEST_*` for the test branch, `JWT_SECRET`, `MFA_ENC_KEY`, `SEED_DEMO_PASSWORD`.
2. `corepack pnpm --filter @moz/db migrate:dev`, then `corepack pnpm --filter @moz/seed seed:demo`.
3. `corepack pnpm dev` -> http://localhost:3000. Set `SKIP_EMAIL_VERIFICATION=1` (local/test only) or `RESEND_API_KEY` for real email.
4. Google Maps: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (restrict by HTTP referrer, e.g. `http://localhost:3000/*`, and cap the daily quota).

Demo accounts (password = `SEED_DEMO_PASSWORD`): `admin@`, `absa.owner@`, `marisco.owner@`, `pending.owner@`, `ana@`, `bruno@`, ... `@mozdiscounts.test`. The admin must set up 2FA on first login.

## iOS app
`cd apps/ios`; `python3 tools/make_xcodeproj.py` regenerates `MozDiscounts.xcodeproj`. Open it in Xcode, pick your Team under Signing, run on the simulator (API at `http://localhost:3000`) or a phone (set `MOZ_API_BASE_URL` in the target build settings to your Mac's LAN address or the Vercel URL). Logic tests: `swift test --package-path apps/ios/MozCore`. UI tests: see DEC-054 (needs the API running and the demo password). Push needs the paid Apple Developer Program; local proximity alerts work without it.

## Deploy the POC (Phase 10, needs Jai's accounts)
1. Vercel: import the GitHub repo (personal account), root `apps/web`, framework Next.js; Hobby plan is non-commercial only (see ADR 0002).
2. Env vars on Vercel: everything in `.env.example` (production values), `APP_ENV=poc`, `APP_URL=https://<project>.vercel.app`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `TURNSTILE_SECRET_KEY` + site key, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (referrer-restricted to the Vercel URL), optional `APNS_*`. Do not set `SKIP_EMAIL_VERIFICATION`.
3. `pnpm --filter @moz/db migrate` then `pnpm --filter @moz/seed seed:demo` against the Neon `production` branch.
4. Smoke test: register + verify, owner publishes, map shows it, admin audit export downloads.
5. Daily cron (`vercel.json`) calls `/api/v1/cron/purge` with `Authorization: Bearer $CRON_SECRET`.

## Backups and recovery
Neon restore window on the free plan; `seed:demo` rebuilds the demo data at any time. Audit rows are append-only (trigger).

## Security checklist before showing it to others
- Rotate `JWT_SECRET`/`MFA_ENC_KEY` for the deployed environment; never reuse local values.
- Keep `SKIP_EMAIL_VERIFICATION` unset outside local/test (it is ignored there anyway).
- Add an IP rate limit or Vercel firewall rule for the public discovery endpoints (DEC-040).
- Restrict the Google key by referrer; set billing alerts.
