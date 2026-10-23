# Moz Discounts (POC)

Source of truth: `docs/SPEC.md` (POC-Profile overrides production sections). Requirement IDs in commits/tests.

## Commands (pnpm via corepack; no global pnpm: use `corepack pnpm ...`)
- `corepack pnpm install` · `typecheck` · `lint` · `test` · `build` · `dev` (http://localhost:3000)
- DB: `.env` at repo root (see `.env.example`); `pnpm --filter @moz/db migrate:dev` / `migrate` / `generate`; `pnpm --filter @moz/seed seed:demo`
- Tests hit the Neon TEST branch when `TEST_DATABASE_URL` is set (DEC-024): `pnpm --filter @moz/db migrate:test`, `pnpm --filter @moz/seed seed:demo:test`.
- Browser tests: `pnpm --filter @moz/web e2e` (builds, starts the app on :3100, runs Playwright + axe). Core logic: `packages/core/src/auth/*`; HTTP: `apps/web/app/api/v1/*` via `lib/http.ts`

## Layout
apps/web (Next.js portal + public map + /api/v1) · apps/ios (SwiftUI, Phase 6+) · packages/core (framework-free rules, Clock) · packages/shared (tokens, constants) · packages/seed · docs/

## Rules
- Do not keep the repo in iCloud-synced folders (DEC-016).
- UI: tokens only, strings via `useT()` (PT+EN), run axe via e2e; follow docs/decisions-log.md DEC-017..021.
- Business logic in packages/core; time only via `Clock`, never `Date.now()`.
- Never store PAN/CVV/expiry/last4. Seed data carries `data_origin`; no fake data as real.
- Verify APIs/packages exist before use; report commands actually run.
- Log unspecified choices in docs/decisions-log.md; phase report in docs/plans/phase-N-report.md.
- Tokens only for colours (packages/shared/src/tokens.css). PT default, EN second; strings externalised.
