# Phase 3 plan: Premises and discounts (POC)

Requirements: BR-7, BR-8, BR-9, BR-R1/R2/R3 (matching, active, ranking), BR-R11 (suspend pauses discounts), TD-6 (matching vectors), SD-5/SD-6 seed.
POC scope: no discount moderation (assumption 4), no staff, opening hours are free text (17), photos/banners/logo upload wait for BlobStore (DEC-025), premise merge deferred.

Order (each step ends green on typecheck + tests):
1. Schema + migration: `Premise`, `Discount`, `DiscountPremise`, `DiscountEligibility`; enums. Coordinates stored as doubles; distance by Haversine in core (PostGIS deferred to Phase 4 when bbox/nearby queries need it, DEC-027).
2. Seed: `premises.json`, `discounts.json` converted from SD-5/SD-6 exactly; `seed:demo` upserts them.
3. Core, framework-free: `geo.ts` (Mozambique bbox, haversine), `offers.ts` (BR-R1 matching, BR-R2 active at instant in Africa/Maputo, BR-R3 ranking), shared vectors `packages/shared/test-vectors/matching.json`.
4. Core services: `premise.ts` (CRUD, CSV import, coordinate validation), `discount.ts` (CRUD, lifecycle DRAFT/PUBLISHED/PAUSED/ARCHIVED + computed EXPIRED, duplicate, extend validity, preview, bulk actions, hard delete admin only), BR-R11 hook in business suspend, daily lifecycle job persisting EXPIRED. Every step audited.
5. Integration tests on the Neon test branch (create -> edit -> pause -> republish -> archive audited; S17 pending business cannot publish; S18 cross-tenant 404 + audit).
6. `/api/v1` routes + HTTP tests.
7. Portal screens (PT+EN, tokens, axe): premises list/editor with Google Maps picker (falls back to manual lat/lng without a key), CSV import, discounts list, 6-step wizard with preview.
8. Playwright journey + axe, traceability, phase report.
