# Phase 3 report: Premises and discounts (POC)

## Built (by requirement)
- **BR-7** eligibility rows: card product, all cards of an issuer (type/network filters), any bank card, wallet, any wallet, general; benefits percent, fixed MZN, cashback, 2-for-1, free item, points; min spend and max cap. The restaurant example (BCI Gold 10 %, Absa Wealth 12 %, M-Pesa 5 %, any bank card 3 %) is captured in a test.
- **BR-8** premises: CRUD, category, alert radius 50-1000 m (also a DB CHECK), Mozambique bounding box with admin override, optional coordinates, CSV import (all-or-nothing, line-numbered errors, dry run, 500 rows), Google Maps picker with typed-coordinate fallback.
- **BR-9** discounts: create/edit/publish/pause/republish/archive/restore, duplicate, extend validity, bulk actions, filters (status, text, premise, category, card, wallet, validity), sort, cursor paging, preview in PT/EN (BR-R8 copy), admin-only hard delete; every step audited with before/after.
- **BR-R1/R2/R3** in `packages/core/src/offers.ts`; **TD-6** vectors in `packages/shared/test-vectors/matching.json` (22 cases incl. boundaries at 12:00, 15:00, 23:59/00:00 Maputo).
- **BR-R11**: unapproved business keeps drafts but cannot publish (S17); suspending pauses published discounts.
- Seed: SD-5 (16 premises) and SD-6 (22 discounts) exactly as specified.
- Portal (PT+EN): `/business/premises`, `/business/discounts`, 6-step wizard.
- 19 new route files under `/api/v1` (premises, import, discounts, lifecycle, bulk, preview).
- POC convenience: `SKIP_EMAIL_VERIFICATION=1` auto-verifies new accounts; honoured only when `APP_ENV` is `local` or `test`.

## Verified (commands run)
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test` (Neon test branch): shared 11, core 167, web 23 = 201 passed. Added since that run, and run on their own: skip-verification tests.
- Playwright (production build, Chromium): 9 passed, including the new premises/CSV, wizard publish and bulk-pause journeys, axe WCAG A/AA on 8 new screens, and 375 px no-scroll on the 3 new pages.

## Bugs found by the tests and fixed
- Zod `.partial()` kept the `[]` defaults, so editing a discount's title wiped its premises and cards.
- `2026-02-30` passed date validation (V8 rolls it over).
- Creating a draft navigated `/new` -> `/[id]` and reset the wizard to step 1.
- Hidden `.sr-only` table header cells escaped the table wrapper and made pages scroll sideways on phones; the app shell grid also needed `minmax(0, 1fr)`.
- A session or user deleted mid-request surfaced as a 500; now a 401.

## Not verified / left
- The Google Maps picker has not been exercised with a real key by me (key now in `.env`; please try it and report).
- Premise photos, logo/banner upload (BlobStore, DEC-025), premise merge, admin screens for premises/discounts (DEC-033), favourite-update pushes (Phase 8).
- The OpenAPI spec and CHANGELOG are still not started for any phase.

## Decisions
DEC-027 to DEC-035 in `docs/decisions-log.md`.
