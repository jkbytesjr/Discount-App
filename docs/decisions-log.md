# Decisions log

| ID | Date | Decision | Reason |
|---|---|---|---|
| DEC-001 | 2026-10-23 | Use pnpm 12.15.0 via `corepack pnpm` (not globally installed) | Avoids global installs; pinned in `packageManager`. |
| DEC-002 | 2026-10-23 | Parent file `/Users/jkbytes/Documents/CLAUDE.md` describes an unrelated voxel game; ignored for this project. Project-level `CLAUDE.md` added. | Spec source-of-truth order puts SPEC.md above it. |
| DEC-003 | 2026-10-23 | Project folder is not a git repo; `git init` done in Phase 0 so per-phase commits are possible. | Spec requires small reviewable changes. |
| DEC-004 | 2026-10-23 | Next.js app has no Tailwind/shadcn yet; added in Phase 2 with the portal shell. | Nothing in Phase 0 needs it. |
| DEC-005 | 2026-10-23 | Environment gaps recorded: no Docker, no PostgreSQL, no full Xcode (only Command Line Tools). | Affects local DB (use a Neon dev branch instead) and all iOS phases (need Xcode.app). |
| DEC-006 | 2026-10-23 | Storage moved from Vercel Blob to Neon Object Storage (bucket `assets`, private) behind `BlobStore` (`apps/web/lib/blob-store.ts`, Files SDK neon adapter). DB is Neon Postgres (`production` branch); app uses pooled `DATABASE_URL`, migrations use `DATABASE_URL_UNPOOLED`. | Neon project provisioned via `neon deploy`; supersedes SPEC Vercel Blob and local Docker Postgres (see DEC-005). |
| DEC-006 | 2026-10-23 | Emails stored lower-case in a plain unique column instead of Postgres `citext`; normalised in code. | Avoids an extension dependency in Prisma; same effect. |
| DEC-007 | 2026-10-23 | POC password rule requires a number (assumption 2), so the spec's AC example `Abcdefg!` now **fails** with NO_NUMBER; `Abcdefg1!` passes. Also kept: max 128, email-local-part check. Skipped: top-10k list, breach check, history. | POC decision overrides BR-5 base rule. |
| DEC-008 | 2026-10-23 | Integration tests run against the Neon dev database using `it-*@mozdiscounts.test` users deleted afterwards; the rate_limits table is cleared. Audit rows they create stay (append-only). Create a Neon branch for tests/CI before the data matters. | No Docker for a local DB. |
| DEC-009 | 2026-10-23 | Seeded admin has no TOTP secret; first login returns a restricted session (`mfaSetupRequired`) and admin sets up 2FA then. Spec says "2FA on" in SD-8. | A committed/known TOTP secret would be insecure. |
| DEC-010 | 2026-10-23 | pnpm build scripts denied for argon2, prisma, @prisma/engines. | argon2 ships prebuilt binaries (verified by hashing); Prisma 7 downloads no engine. |
| DEC-011 | 2026-10-23 | No `RESEND_API_KEY` yet: emails go to `ConsoleMailer` (server log). Turnstile with no secret passes only when APP_ENV is local/test, fails closed otherwise. | Keys not available; Phase 10 sets them. |
| DEC-012 | 2026-10-23 | Locked accounts return 429 `ACCOUNT_LOCKED` (reveals the account exists once it is locked). Failed-attempt counters are keyed by email hash, so unknown emails get the same 429 after 5 attempts. | Spec AC requires a locked response; the counter keeps unknown/known behaviour identical otherwise. |
| DEC-013 | 2026-10-23 | Only the CSP for API responses is set (`default-src 'self'; frame-ancestors 'none'`); nonce-based page CSP comes with the portal UI (Phase 2). | No inline scripts exist yet. |
| DEC-014 | 2026-10-23 | Prisma 7.10.1 (latest stable) with `@prisma/adapter-pg`; migrations use `DIRECT_URL`, runtime uses pooled `DATABASE_URL`. | Prisma 8 is still an RC. |
| DEC-015 | 2026-10-23 | `UserCard`, `UserWallet`, `AlertPreference`, `Favorite` models and the permissions-matrix policy module are added with their features (Phases 2 and 7). Avatar upload waits for `BlobStore` (needs Vercel Blob). `seed:reset` not built: `audit_logs` blocks TRUNCATE by design. | Not needed by Phase 1 tests. |
