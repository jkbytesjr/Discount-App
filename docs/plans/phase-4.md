# Phase 4 plan: Public map and discovery API (POC)

Requirements: BR-11, plus the API contract IOS-6/IOS-7/IOS-8 will consume (nearby, recent, geofence sync). BR-R2 decides what is visible; BR-R3 ranks.
POC scope: no PostGIS (DEC-027): a plain (lat, lng) index narrows by bounding box in SQL, filters and ranking run in `packages/core`. Favourites need the user-cards tables (Phase 7), so the map is read-only for now. Bank/wallet logos are not available as licensed images, so chips show a monogram and the name (DEC-037).

Order (each step ends green):
1. Migration: index on `premises(lat, lng)`.
2. `packages/core/src/discovery.ts`: one loader for "active offers at time t" (published, approved business, active premise with coordinates, validity and schedule via `isActiveAt`), chip filters (issuer, wallet, card type, segment, category, general), `mapPremises` (bbox), `nearby` (distance, radius 0.5-10 km), `recent` (30-day window, newest first), public `premiseDetail` / `discountDetail`, `geofenceSync` (nearest 20 premises with radius, compact offers for on-device matching, ETag + 304).
3. Public routes under `/api/v1` (no login, cacheable): `map/premises`, `map/premises/{id}`, `map/discounts/{id}`, `discounts/nearby`, `discounts/recent`, `sync/geofences`, `map/filters` (chip data). Detail endpoints live under `/map/` because `/premises/{id}` and `/discounts/{id}` are the owner CRUD routes.
4. Integration tests against the seeded demo data at the fixed instant Wed 2026-11-04 13:00 Maputo: S10, S11, S12, S19, S21, plus bbox, radius, schedule, pagination, ETag/304, privacy (no draft/expired/unapproved leakage).
5. Public page `/map`: Google Map with clustering, logo chips, place search, near me, radius slider, side panel, and an always-available list (works without a key, accessible alternative).
6. Playwright + axe on `/map` (light/dark, 375 px), docs, traceability, phase report, commit and push.
