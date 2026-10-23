# Phase 1 report: Identity

## Built (by requirement)
- **BR-1** Argon2id (m=19456,t=2,p=1); zod strict schemas on every body; Prisma only, raw SQL via tagged template (ESLint bans `*Unsafe`); per-IP (20/15 min) and per-email (5/15 min) limits in Postgres; progressive lockout 15 min doubling to 24 h with email; Turnstile after 3 failures (web); generic credential errors + dummy hash for unknown accounts; web cookie session (HttpOnly, SameSite=Lax, Secure + `__Host-` outside local, idle 30 min, absolute 12 h, CSRF header); iOS JWT 15 min + rotating 30-day refresh with reuse detection; log out / log out everywhere; security headers; TOTP 2FA mandatory for admin.
- **BR-2 (API)** profile, change password, change email with re-verification, devices list/revoke, delete (anonymise), 2FA.
- **BR-3 framework** append-only `audit_logs` (DB trigger blocks UPDATE/DELETE/TRUNCATE), secret redaction.
- **BR-4** registration, 24 h single-use hashed tokens, resend 3/h, unverified login blocked with resend option, daily purge cron (`/api/v1/cron/purge`).
- **BR-5** shared rules (POC variant, DEC-007), enforced by the API.
- **IOS-2 (API)** device upsert, login events with coarse location (~100 m), new-device email.
- Seed: `pnpm seed:demo` (14 issuers, 2 networks, 19 card products, 3 wallets, 20 categories, 14 businesses, 16 demo accounts), idempotent, refuses production.
- Neon: migrations `init` and `audit_append_only` applied (schema in packages/db/prisma).

## Verified (commands run)
`pnpm typecheck` OK · `pnpm lint` OK (and a probe file proved the Date.now/new Date()/`$queryRawUnsafe` rules fire) · `pnpm test`: shared 8, core 38 (Clock 3 + unit 5 + integration 30), web 10 = **56 passed, 0 failed** · `pnpm build` OK (17 API routes) · live smoke test over HTTP with curl against `next dev`: security headers present, Ana iOS login returns tokens, Inês blocked with `EMAIL_NOT_VERIFIED`, admin web login sets cookie and returns `mfaSetupRequired`.

## Not verified / left
- Real emails (no Resend key: console mailer) and real Turnstile (no keys): both code paths exist but ran only against stubs.
- Tests hit the shared Neon dev DB, not a branch (DEC-008). Full suite takes about 3 minutes (Argon2 + network latency).
- Email-change and account-delete flows have no dedicated test yet; business approval, avatar, admin/user management UI are Phase 2+.
- Sending account-locked emails etc. uses PT/EN templates not yet reviewed by a native speaker.
- Neon pooled-connection `sslmode` produces a pg deprecation warning (harmless now; set `sslmode=verify-full` in the URL to silence it).
- Nothing committed (no git commit made).

## New decisions
DEC-006 to DEC-015 in docs/decisions-log.md.

## Questions for Jai (batched)
1. Commit now? I haven't run `git commit`; recommended: one commit per phase.
2. Create a second Neon **branch** for tests/CI? Recommended before Phase 2.
3. Resend and Turnstile keys when you are ready (not blocking Phase 2).
