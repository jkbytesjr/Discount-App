# Moz Discounts

Find discounts on your bank cards and mobile wallets in Mozambique, and get an alert when you walk past a place that offers one.

This repository is a **proof of concept (POC)** with three parts:

| Part | What it does |
|---|---|
| **Web** (`apps/web`) | A scroll-driven marketing home page (PT/EN) that leads into the portal. Business owners (banks, wallet providers, merchants) manage their profile, premises and discounts. Admins approve businesses, add and manage discounts for any business, manage the catalogue and users, read the audit trail and export it to Excel. A public map shows who offers what, no sign-in needed (Google Maps, with an OpenStreetMap fallback). A public privacy policy and privacy label live at `/privacy`. |
| **REST API** (`apps/web/app/api/v1`) | Everything the portal and the app use, plus the public discovery endpoints (map, nearby, recent offers, geofence sync). |
| **iOS app** (`apps/ios`) | Customers pick their cards and wallets (shown as bank-coloured cards), browse a map that starts at their location, a drag-up drawer with every nearby discount grouped by category, favourite offers and receive proximity alerts. Talks to the live API by default. |

All sample data is fictional and marked "Dados de demonstração / Demo data".

**Live demo:** https://discount-app-rho.vercel.app (Vercel, with its own Neon database; sign-in needs an account the owner has shared with you). The home page is a scroll-driven marketing site that leads into the web application (`/login`, `/register`, `/map`); its source is `apps/web/components/landing.tsx`, with the original static version in `docs/site`.

## Screenshots

| Home | Sign in |
|---|---|
| ![Home](docs/screenshots/01-home.png) | ![Sign in](docs/screenshots/03-login.png) |
| ![Business dashboard](docs/screenshots/04-business-dashboard.png) | ![Discounts](docs/screenshots/05-business-discounts.png) |

![Premises](docs/screenshots/06-business-premises.png)

## Tech stack

- **Web and API:** Next.js 16 (App Router, route handlers), React 19, TypeScript
- **Database:** PostgreSQL on Neon, Prisma 7
- **Business rules:** `packages/core`, plain TypeScript with no framework imports (matching, active-offer rules, alert log, stats, exports)
- **iOS:** SwiftUI, MapKit, CoreLocation, local notifications, Face ID; the logic lives in a Swift package (`apps/ios/MozCore`) that passes the same test vectors as the TypeScript code
- **Email:** Gmail SMTP (`SMTP_USER`/`SMTP_PASS` app password) or Resend; without either, emails are printed to the server log
- **Design:** dark glassmorphism ([`docs/DESIGN-GLASSMORPHISM.md`](docs/DESIGN-GLASSMORPHISM.md)), Montserrat and Manrope, Portuguese first with English
- **Tests:** Vitest, Playwright with axe accessibility checks, XCTest and XCUITest

## Repository layout

```
apps/web         Next.js app: portal, public map, /api/v1
apps/ios         SwiftUI app, MozCore Swift package, UI tests
packages/core    Business rules (framework-free)
packages/db      Prisma schema and migrations
packages/shared  Design tokens, PT/EN strings, test vectors
packages/seed    Demo data (seed:demo)
docs/            Spec, decisions log, phase plans and reports, runbook, UAT checklist, App Store privacy/age-rating answers
docs/site        The original static version of the marketing site (now `apps/web/components/landing.tsx`)
```

## Quick start (web and API)

You need Node 22+, corepack, and a Neon Postgres database (a free project is enough).

```bash
corepack pnpm install
cp .env.example .env            # then fill in the values (see below)
corepack pnpm --filter @moz/db migrate:dev
corepack pnpm --filter @moz/seed seed:demo
corepack pnpm dev               # http://localhost:3000
```

Minimum `.env` values: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `MFA_ENC_KEY`, `SEED_DEMO_PASSWORD`. Everything else is optional:

- `SKIP_EMAIL_VERIFICATION=1` auto-verifies new accounts so you can test without email (ignored outside local and test environments).
- `SMTP_USER` + `SMTP_PASS` (a Gmail app password) or `RESEND_API_KEY` send real emails; without them emails are printed in the server log. `EMAIL_FROM` sets the sender. A new Gmail sender often lands in Spam: a domain with Resend is the proper fix.
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` shows the Google map (restrict the key by HTTP referrer, for example `http://localhost:3000/*`). Without it the map page shows the list of places only.
- To test from a phone on the same Wi-Fi, open `http://<your Mac's IP>:3000`. Private LAN ranges are allowed by default; add others with `DEV_ALLOWED_ORIGINS`.

Never commit `.env`. It is git-ignored.

### Accounts

Create your own: register on `/register` (business accounts need admin approval), or seed demo data with `seed:demo` if you want sample accounts. The iOS app is for customers only; business and admin accounts use the web portal.

## iOS app

Needs Xcode with the iOS 17 SDK or newer (built and tested with Xcode 27.1).

```bash
cd apps/ios
python3 tools/make_xcodeproj.py        # regenerates MozDiscounts.xcodeproj
open MozDiscounts.xcodeproj            # choose your Team, run on a simulator or phone
swift test --package-path MozCore      # logic tests
```

The app talks to the live site (https://discount-app-rho.vercel.app) by default, so it works on a phone without your Mac running. To test against a local server, set `MOZ_API_BASE_URL` in the target's build settings (or the scheme environment) to `http://<your Mac's IP>:3000`. Local proximity alerts work without a paid Apple account; push notifications need the Apple Developer Program.

UI tests (need the API running and the demo password):

```bash
TEST_RUNNER_MOZ_API_BASE_URL=http://localhost:3000 TEST_RUNNER_MOZ_DEMO_PASSWORD=... \
xcodebuild test -project MozDiscounts.xcodeproj -scheme MozDiscounts \
  -destination 'platform=iOS Simulator,name=iPhone 17' CODE_SIGNING_ALLOWED=NO
```

## Tests and checks

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test                     # shared, core and web (use a separate Neon branch: set TEST_DATABASE_URL)
corepack pnpm --filter @moz/web e2e    # builds, starts the app on :3100, runs Playwright and axe
```

Set `TEST_DATABASE_URL` and `TEST_DIRECT_URL` to a separate Neon branch, then run `pnpm --filter @moz/db migrate:test` and `pnpm --filter @moz/seed seed:demo:test`. Tests never touch your development data when those are set.

## What is in the box

- Business profiles with admin approval; premises with a Google Maps picker and CSV import; discounts with per-card and per-wallet benefits, schedules, a six-step wizard, preview, bulk actions and an audited lifecycle
- Public map with bank, wallet, card-type and category filters and marker clustering; falls back to OpenStreetMap when Google rejects the key
- Demo banks: Absa, BCI, Millennium bim, Moza, Letshego plus Vista Bank, Standard Bank, FNB, Nedbank, Ecobank, UBA, First Capital and Banco Mais (the last eight with illustrative cards, in `packages/seed/data/extra.json`, not seeded into the test branch)
- Customer cards, wallets, alert preferences and favourites; favourite-update pushes; an alert log with Excel export; admin and business statistics and reports
- Security basics: argon2 password hashing, lockout and rate limits, two-factor for admins, nonce-based CSP, append-only audit trail, tenant isolation, formula-injection-safe exports

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md): the requirements this was built from
- [`docs/decisions-log.md`](docs/decisions-log.md): every choice the spec left open
- [`docs/plans/`](docs/plans): plan and report for each phase, plus [`overnight-report.md`](docs/plans/overnight-report.md)
- [`docs/runbook.md`](docs/runbook.md): run locally, deploy steps, security checklist
- [`docs/uat-checklist.md`](docs/uat-checklist.md): scenarios and how each is verified
- [`docs/traceability.md`](docs/traceability.md): requirement to test mapping
- [`docs/app-store-submission.md`](docs/app-store-submission.md): privacy policy URL, App Privacy labels and age-rating answers
- [`docs/design/`](docs/design): reference sheets (bank brand colours)

## Status and known gaps

Working and tested: the web portal, the marketing home page, the API, the public map and the iOS app on the simulator. GitHub CI runs typecheck, lint, tests, build and the browser tests; its Neon test branch must be recreated when it expires. Two map browser tests depend on the weekday (fixtures assume a weekday) and fail on Sundays.

Not yet done or not verified:

- Real-device checks (background alerts while walking, Face ID, the permission prompts) and Apple push delivery
- Reliable email delivery: the live site sends through a Gmail account and messages often land in Spam (needs a domain and Resend). The login captcha (Turnstile) only appears after repeated failed sign-ins and needs Turnstile keys; without them a locked-out account stays blocked until the counters are cleared
- The deployment is manual (`vercel deploy --prod` with a token), not connected to Git; the Google Maps key must allow the Vercel URL as a referrer to show the Google map
- The iOS cards, drawer and privacy-label screens are built and compile but have not been checked on a device
- Profile photo and logo uploads, the email-verification universal link, load and penetration testing

This is a demonstration. A legal review under Mozambican data-protection law is needed before any real launch (see [`docs/privacy-notice.md`](docs/privacy-notice.md)).
