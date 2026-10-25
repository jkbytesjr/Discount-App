# Runbook (POC)

## Run locally
1. `corepack pnpm install`; copy `.env.example` to `.env`; set `DATABASE_URL`/`DIRECT_URL` (Neon), `TEST_*` for the test branch, `JWT_SECRET`, `MFA_ENC_KEY`, `SEED_DEMO_PASSWORD`.
2. `corepack pnpm --filter @moz/db migrate:dev`, then `corepack pnpm --filter @moz/seed seed:demo`.
3. `corepack pnpm dev` -> http://localhost:3000. Set `SKIP_EMAIL_VERIFICATION=1` (local/test only) or `RESEND_API_KEY` for real email.
4. Google Maps: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (restrict by HTTP referrer, e.g. `http://localhost:3000/*`, and cap the daily quota).

Demo accounts (password = `SEED_DEMO_PASSWORD`): `admin@`, `absa.owner@`, `marisco.owner@`, `pending.owner@`, `ana@`, `bruno@`, ... `@mozdiscounts.test`. The admin must set up 2FA on first login.

## iOS app
`cd apps/ios`; `python3 tools/make_xcodeproj.py` regenerates `MozDiscounts.xcodeproj`. Open it in Xcode, pick your Team under Signing, run on the simulator (API at `http://localhost:3000`) or a phone (set `MOZ_API_BASE_URL` in the target build settings to your Mac's LAN address or the Vercel URL). Logic tests: `swift test --package-path apps/ios/MozCore`. UI tests: see DEC-054 (needs the API running and the demo password). Push needs the paid Apple Developer Program; local proximity alerts work without it.

## Deploy the POC (as done for https://discount-app-rho.vercel.app)
1. Vercel project with Root Directory `apps/web` (no Git link yet). `apps/web/vercel.json` sets the install/build commands (`cd ../.. && corepack pnpm ...`, `prisma generate` before the build) and the daily purge cron. Set `ENABLE_EXPERIMENTAL_COREPACK=1`. Hobby plan is non-commercial only (ADR 0002).
2. Production env vars: `APP_ENV=poc`, `APP_URL=https://<project>.vercel.app`, `DATABASE_URL` (pooled) and `DIRECT_URL`, `JWT_SECRET`, `MFA_ENC_KEY` (32 bytes, base64), `CRON_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`; email: `SMTP_USER` + `SMTP_PASS` (Gmail app password) + `EMAIL_FROM`, or `RESEND_API_KEY`; optional `TURNSTILE_SECRET_KEY` + site key, `APNS_*`, `PRIVACY_CONTACT_EMAIL`. Never set `SKIP_EMAIL_VERIFICATION`. Sensitive values are stored as Vercel "sensitive" variables; use the REST API without a `teamId` parameter or the dashboard.
3. Database: use a Neon branch separate from local development (the live site uses the `live` branch). For a branch created schema-only, baseline the migrations with `prisma migrate resolve --applied <name>` for each, then `migrate deploy`. Seed with `APP_ENV=poc SEED_DEMO_PASSWORD=<new live password> pnpm --filter @moz/seed seed:demo` (re-runnable; it also loads `extra.json` banks). Check the host in `DATABASE_URL` before migrating or seeding: a quoted `&` in an unquoted `.env` once sent a run to the wrong database.
4. Deploy: `VERCEL_TOKEN=... npx vercel@latest deploy --prod --yes` from the repo root. Revoke the token afterwards.
5. Smoke test: `/` (landing), `/map`, `/privacy`, register + verify (check Spam), sign in, admin 2FA setup, publish an offer.
6. Google Maps: add `https://<project>.vercel.app/*` to the key's HTTP referrers; until then the map falls back to OpenStreetMap.
7. Keep-warm: `.github/workflows/keep-warm.yml` pings the site every 5 minutes so the Neon free-tier compute does not suspend (first request after idle otherwise takes about 4 s).
8. A locked-out login (captcha required but no Turnstile keys): delete the `login:*` rows in `rate_limits` and zero `failed_login_count` for the user.

## Backups and recovery
Neon restore window on the free plan; `seed:demo` rebuilds the demo data at any time. Audit rows are append-only (trigger).

## Security checklist before showing it to others
- Rotate `JWT_SECRET`/`MFA_ENC_KEY` for the deployed environment; never reuse local values.
- Keep `SKIP_EMAIL_VERIFICATION` unset outside local/test (it is ignored there anyway).
- Add an IP rate limit or Vercel firewall rule for the public discovery endpoints (DEC-040).
- Restrict the Google key by referrer; set billing alerts.
