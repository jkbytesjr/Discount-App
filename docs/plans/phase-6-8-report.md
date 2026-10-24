# Phases 6 to 8 report: iOS app (POC)
Built (see `docs/plans/overnight-report.md`): MozCore package, SwiftUI app with glass design, onboarding with permission priming, auth (login, register, check email, forgot), card and wallet capture, preferences, home map with filters, offers, favourites, alerts inbox, region monitoring and local alerts, offline queue, push registration, Face ID, profile.
Verified: `swift test` (21 tests incl. TD-6 vectors and S01-S08, S20), simulator run with an end-to-end alert and event ingestion.
Left: real-device checks, APNs, XCUITest, universal link, profile photo, bundled fonts.
