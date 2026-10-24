# Overnight report (2026-10-24): phases 4 to 10

## What now exists
- **Web portal** in the glass design (DEC-042): admin (users, businesses, catalogue, audit trail + Excel, alert log + Excel, settings with demo mode, dashboard stats), business (profile, premises + CSV import + Google picker, discounts wizard, reports + Excel), normal user (cards and wallets, alert preferences, favourites), public map at `/map`.
- **API**: ~100 route files under `/api/v1`, problem+json errors, public discovery with ETag/304 geofence sync and a rate limit.
- **iOS app** (`apps/ios`): MapKit home with filter chips, new-offers carousel and nearby list, offer and premise detail with favourites, alerts inbox, my cards and wallets (bank -> type -> card), alert preferences, profile edit, change password, download my data, language, Face ID lock/login, local proximity alerts from region monitoring, offline event queue, push-token registration. Logic in the `MozCore` Swift package (21 tests, TD-6 vectors).
- **Docs**: `docs/uat-checklist.md`, `docs/runbook.md`, `docs/privacy-notice.md`, decisions DEC-027..053, traceability.

## Verified by running it
- Unit and integration tests, Playwright with axe (contrast, 375 px), `swift test`, and the iOS app in the iPhone 17 simulator against the local API: sign-in, map, entering the Polana spa region produced the S01 alert and TRIGGERED/DELIVERED events reached the server with a rounded location.

## Not verified (needs you, a device or an account)
- Real iPhone: background region monitoring while walking (S13, S22), Face ID, APNs push, "Always" permission flow. The simulator cannot tap system dialogs from my tooling, so permission prompts were not clicked.
- APNs delivery to Apple (`ApnsPushSender` is written, never run), Resend email, Cloudflare Turnstile, Vercel deployment, Google Maps billing limits.
- Montserrat/Manrope are not bundled in the iOS app (system font).
- XCUITest journeys J3-J5 are not automated.
- Phase 10: no deployment was made (needs your Vercel/Neon production setup). The runbook lists the steps.
- Phase 9: k6/ZAP/MobSF skipped by POC scope; no external pen test; performance at 50 000 premises not measured.

## Known gaps against the spec
- IOS-4 profile photo upload (needs BlobStore), IOS-3 universal link for email verification (needs a domain and Apple association file), BR-6 logo upload, premise photos, premise merge, reported-offer queue and broadcasts (POC scope), discount moderation (off in the POC).
