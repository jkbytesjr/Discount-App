# Phase 4 report: Public map and discovery API (POC)

## Built (by requirement)
- **BR-11** public web map at `/map` (no login): Google Maps with marker clustering, filter chips (banks, wallets, card type, segment, category, General offers, Show all), place search (Places Autocomplete), Near me with a 0.5-10 km radius slider, side panel with active offers and eligible cards/wallets, directions and call. A list of places beside the map is always available and is the fallback when the map cannot load.
- Server-side viewport queries with an index on `premises(lat, lng)`; cacheable (`s-maxage`) and paginated by premise id.
- **API for the iOS app** (IOS-6/7/8): `GET /api/v1/map/premises`, `/map/premises/{id}`, `/map/discounts/{id}`, `/map/filters`, `/discounts/nearby`, `/discounts/recent` (`kind=recent|ending`), `/sync/geofences` (nearest 20 premises, compact offers, ETag, 304).
- Visibility is BR-R2 everywhere: published, approved business, active premise, inside validity and weekly schedule. No drafts, expired, future, paused, unapproved or coordinate-less premises on the map.

## Verified (commands run)
- Core discovery tests against the seeded demo data at Wed 13:00 Maputo: 20 tests (S10, S11, S12, S19, S21, chips, bbox, pagination, nearby, recent, ending soon, geofence sync).
- Web public-API tests (`discovery-api.test.ts`) and Playwright `map.spec.ts` (filter + panel + axe light/dark + 375 px). Full-suite totals are recorded in the commit message.

## Bugs found by the tests and fixed
- The test branch held an older seed (card-product rows without an issuer): reseeded dev and test.
- The pagination cursor required a UUID but seeded premise ids are slugs.

## Not verified / left
- Google Maps rendering and clustering with your real key: only the list/fallback path is covered by browser tests (Google is blocked there on purpose).
- Bank/wallet logos (DEC-037), favourites (Phase 7), rate limiting of public endpoints (DEC-040), PostGIS (DEC-027). The p95 < 300 ms target at 50 000 premises was not measured (small dataset only, per the POC).

## Decisions
DEC-037 to DEC-041.
