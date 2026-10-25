# Moz Discounts (POC)

Source of truth: `docs/SPEC.md` (POC-Profile overrides production sections). Requirement IDs in commits/tests.

## Commands (pnpm via corepack; no global pnpm: use `corepack pnpm ...`)
- `corepack pnpm install` · `typecheck` · `lint` · `test` · `build` · `dev` (http://localhost:3000)
- DB: `.env` at repo root (see `.env.example`); `pnpm --filter @moz/db migrate:dev` / `migrate` / `generate`; `pnpm --filter @moz/seed seed:demo`
- Tests hit the Neon TEST branch when `TEST_DATABASE_URL` is set (DEC-024): `pnpm --filter @moz/db migrate:test`, `pnpm --filter @moz/seed seed:demo:test`.
- iOS: `apps/ios/MozDiscounts.xcodeproj` (regenerate with `python3 apps/ios/tools/make_xcodeproj.py`), logic tests `swift test --package-path apps/ios/MozCore`, simulator build `xcodebuild -project apps/ios/MozDiscounts.xcodeproj -scheme MozDiscounts -destination 'platform=iOS Simulator,name=iPhone 17' build CODE_SIGNING_ALLOWED=NO`.
- Browser tests: `pnpm --filter @moz/web e2e` (builds, starts the app on :3100, runs Playwright + axe). Core logic: `packages/core/src/auth/*`; HTTP: `apps/web/app/api/v1/*` via `lib/http.ts`

- Home page `/` is the marketing site (`apps/web/components/landing.tsx`, copy `lib/landing-content.ts`, CSS `app/landing.css`, all classes `lp-` prefixed; DEC-057). `/privacy` holds the policy and privacy label (`lib/privacy-content.ts`); keep it in step with `docs/app-store-submission.md`.
- Seed: demo-only banks live in `packages/seed/data/extra.json` and are skipped for the test branch (integration tests assert on the base fixtures). Live deploy steps: `docs/runbook.md`.

## Layout
apps/web (Next.js portal + public map + /api/v1) · apps/ios (SwiftUI, Phase 6+) · packages/core (framework-free rules, Clock) · packages/shared (tokens, constants) · packages/seed · docs/

## Rules
- The repo lives at ~/Developer/moz-discounts. Never keep it in iCloud-synced folders such as ~/Documents (DEC-016).
- UI (web and iOS): follow `docs/DESIGN-GLASSMORPHISM.md` (DEC-042); the spec's UX-1/UX-2 palette and ui-ux-pro-max are dropped. Tokens only, strings via `useT()` (PT+EN), axe via e2e.
- Business logic in packages/core; time only via `Clock`, never `Date.now()`.
- Never store PAN/CVV/expiry/last4. Seed data carries `data_origin`; no fake data as real.
- Verify APIs/packages exist before use; report commands actually run.
- Log unspecified choices in docs/decisions-log.md; phase report in docs/plans/phase-N-report.md.
- Tokens only for colours (packages/shared/src/tokens.css). PT default, EN second; strings externalised.
- Push every commit to `origin` (github.com/jkbytesjr/Discount-App, `main`) right after committing.
