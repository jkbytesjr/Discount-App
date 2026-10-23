# Traceability (requirement -> tests -> status)

Test files: `C1` core/test/auth.integration, `C2` core/test/admin.integration, `U` core/src/*.test.ts (lockout, policy, clock), `S` shared/src/*.test.ts, `W1` web/test/api.test.ts, `W2` web/test/admin-api.test.ts, `E` web/e2e/portal.spec.ts (Playwright + axe), `C3` core/test/discounts.integration, `O` core/src/offers.test.ts (TD-6 vectors in shared/test-vectors/matching.json), `W3` web/test/discounts-api.test.ts, `C4` core/test/discovery.integration, `W4` web/test/discovery-api.test.ts, `M` web/e2e/map.spec.ts, `C5` core/test/phase5.integration, `W5` web/test/phase5-api.test.ts, `E5` web/e2e/phase5.spec.ts, `SW` apps/ios/MozCore tests (swift test).

| ID | Tests | Status |
|---|---|---|
| BR-1 | C1 (SQL injection, brute force, sessions, 2FA), W1, W2 (admin 2FA gate) | Done (Turnstile verified by stub only) |
| BR-2 / BR-2.1 | C1, C2 (users CRUD, suspend, force reset, delete, catalogue CRUD), W2, E | Done for web; app-user cards/wallets/avatar later |
| BR-2.2 | C2 (business create/edit/submit), C3, W3, E | Done |
| BR-3 framework | C1 audit, U redaction, C2 audit rows | Framework done; UI + Excel export Phase 5 |
| BR-4 | C1, E (register -> verify -> sign in) | Done |
| BR-5 | S, C1 | Done (POC rules, DEC-007) |
| BR-6 | C2 (3 types, link rules), E | Done except logo upload (DEC-025) |
| BR-12 (approval part) | C2 (approve/reject/suspend), W2, E | Done; stats/reports/broadcasts later (POC scope) |
| Permissions matrix | U policy.test.ts (72 cells + coverage) | Done |
| UX-1 | ui-ux-pro-max searches run; guidance applied; palette kept per UX-2 | Done for Phase 2 screens |
| UX-2 | tokens.css; E axe contrast in light + dark on 9 screens | Done |
| UX-3 | E (shell, tables, drawers, dialogs, empty/loading/error states) | Done for Phase 2 screens |
| UX-4 | apps/web/public/brand/logo.svg | v1 only (PNG/app-icon exports pending) |
| NFR-6 (web) | E axe WCAG 2.2 AA, phone-width scroll check | Passing on current screens |
| NFR-7 | S messages.test.ts (PT = EN keys) | Strings externalised; native review pending |
| IOS-2 (API) | C1 | Done |
| NFR-8 | CI, ESLint rules | Done |
| BR-7 | C3 (restaurant example, scopes, benefits, validation), O (BR-R1 rows), W3 | Done (logo/banner upload waits for BlobStore, DEC-025) |
| BR-8 | C3 (coordinates, radius 50-1000, Mozambique box + admin override, CSV import, tenant isolation), O (geo), W3, E | Done; Google picker unverified without a key (DEC-034); photos and premise merge deferred |
| BR-9 | C3 (create/edit/pause/republish/archive audited, bulk, duplicate, extend, preview, hard delete admin-only), W3 | Done; favourite-update pushes in Phase 8 |
| BR-R1 / R2 / R3 | O (22 TD-6 vectors + unit tests) | Done |
| BR-R11 | C3 (S17 publish blocked, suspend pauses discounts) | Done |
| TD-6 | shared/test-vectors/matching.json via O | TypeScript done; Swift port in Phase 6-7 |
| BR-11 | C4 (S10, S11, S12, S19, S21, chips, bbox, pagination, privacy), W4, M (chips, panel, axe light/dark, 375 px) | Done; Google map not exercised with a live key (list fallback tested); favourites need Phase 7 |
| IOS-6/7/8 API | C4, W4 (nearby, recent, ending soon, geofence sync + ETag/304) | Server side done; iOS client in Phases 6-8 |
| BR-3 (UI + Excel) | C5 (filters, cursor, export, audited export, formula defusing), W5, E5 | Done (admin only, POC) |
| BR-10 | C5 (ingest, idempotency, coarse location, reasons, admin list/export, own history), W5, SW (offline queue) | Done; OPENED within 5 s needs a device check |
| BR-12 (POC) | C5 (admin + business stats, report export), E5 | Done (no charts library, simple SVG line chart) |
| BR-R6 / assumption 11, 18 | C5 (settings ranges, demo mode cooldown) | Done |
| BR-R7 / IOS-7 push | C5 (material vs typo changes, language, opt-out, failure isolation) | Server done; APNs not run against Apple |
| IOS-1 .. IOS-4 | SW (API client, refresh, errors), build; Face ID lock, login/register, profile in the app | App builds and runs in the simulator; no device/XCUITest run yet |
| IOS-5, IOS-6, IOS-7 | C5 (cards, wallets, prefs, favourites), W5, E5 (web), app screens | Built; manual device check pending |
| IOS-8 | SW (S01-S08, S20 on the engine, region planner, queue) | Engine verified; background region monitoring needs a real device walk (S13, S22) |
| TD-6 (Swift) | SW MatchingVectorTests (22 vectors) | Done |
| Others | | Not started |
