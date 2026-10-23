# Moz Discounts — Master Requirements Specification Prompt

> **How to use this file.** Paste the whole file into Claude Code (VS Code extension or CLI) at the root of an empty repository, or save it as `docs/SPEC.md` and tell Claude Code: *"Read docs/SPEC.md and follow the `<Execution-Plan>` phase by phase."* Everything inside the XML-style tags is the specification. Requirement IDs (BR-x, UX-x, IOS-x, NFR-x) are stable: use them in commit messages, PR titles, tests and the traceability matrix.
>
> Version 1.2 · 23 Oct 2026 · Owner: Jai · Items marked **[ASSUMPTION]** were not in the original brief and should be confirmed or changed before or during Phase 0.
>
> **New in v1.2:** the first build is a **low-cost proof of concept**. `<POC-Profile>` sets a free-tier stack (one Next.js app on Vercel, Neon Postgres with PostGIS, Resend, MapKit on iOS) and every item in `<Assumptions-To-Confirm>` now has a POC decision and a before-production note.
>
> **New in v1.1:** rules for Claude Code to prevent hallucination, a glossary, hard constraints, a permissions matrix, precise business rules for matching and alerts, a screen inventory, key user journeys, a test-data simulation section with 22 scenarios and expected results, and a seed dataset of Mozambican banks, wallets, premises and discounts with each record's source marked.

---

<Role>

You are a senior full-stack engineering team working inside Claude Code and VS Code: a solution architect, a TypeScript backend engineer, a React/Next.js frontend engineer, a Swift/SwiftUI iOS engineer, a QA automation engineer, a security engineer and a DevOps engineer. You plan before you code, write tests alongside features, keep changes small and reviewable, and never weaken a security control to make something "work".

</Role>

<Context>

Moz Discounts is a product that consolidates every discount, offer and reward that banks, mobile-money wallet providers and businesses make available in **Mozambique**. A registered user tells the app which bank cards and mobile wallets they hold. When the user walks close to a restaurant, spa, hotel, supermarket or any other premise stored in the backend, the iOS app immediately alerts them, based on GPS location, that discounts, offers or rewards are available at that premise for **their** card or wallet, or general offers open to everyone. The goal is that users never miss an offer they are entitled to.

The product has two parts:

1. **Backend web application** (API + web portal) used by administrators and business users (banks, wallet providers, merchants) to capture and manage discounts, premises and GPS locations, and by anyone to browse discounted locations on a map.
2. **iOS mobile app** used by normal users to register, capture their cards and wallets, see nearby discounts on a map, favourite offers and receive proximity alerts.

</Context>

<Purpose>

Produce, from this single specification, a plan and then the working software to **plan, develop, test and host** the Moz Discounts backend web application and iOS app using Claude Code and VS Code. Every requirement below must be implemented, tested and traceable to its ID.

</Purpose>

<Instructions-For-Claude-Code>

These rules exist to prevent misinterpretation and hallucination. They apply to every phase and override your own defaults.

**Source of truth, in order:** (1) Jai's explicit instructions in the current conversation, (2) this specification, where `<POC-Profile>` and the POC decisions in `<Assumptions-To-Confirm>` override the production-target sections, (3) accepted ADRs in `docs/adr/`, (4) official documentation of the tools in use, (5) your own judgement. When two sources conflict, follow the higher one and record the conflict in `docs/decisions-log.md`.

1. **Do not invent requirements.** Build only what a requirement ID in this spec asks for. If something is needed but not specified (a field, an error message, a default), choose the simplest option that is consistent with this spec, log it in `docs/decisions-log.md` as `DEC-nnn — decided by Claude Code — <reason>`, and continue.
2. **Stop and ask** only when a gap changes scope, cost, security, privacy, legal exposure or the user experience in a way Jai would notice. Batch questions once per phase, each with a recommended default, and keep working on everything that does not depend on the answer.
3. **Do not guess APIs.** Before using any library, SDK, CLI flag or Apple/Google API, confirm it exists in the installed version (type definitions, `--help`, official docs). Never write a method name you have not verified. Let the compiler and tests prove it.
4. **Verify packages before installing.** Check the exact package name on npm / Swift Package Index, its maintenance status and licence. Pin exact versions in lockfiles. Record any non-obvious dependency in an ADR. Use the latest stable versions available at build time and write them in `docs/adr/0001-stack.md`; the versions in this spec are minimums.
5. **Never fabricate data as real.** All seed and test data carries a `data_origin` flag (see `<Seed-Data>`). Illustrative offers must never be described as real offers, shown in production, or attributed to a real business as fact. Do not scrape bank, wallet or merchant websites.
6. **Never claim something works without running it.** Report the commands you ran and a short summary of their output (tests passed/failed, coverage, lint). If a check could not run, say so.
7. **No fake implementations in production code.** No stubbed services, hard-coded responses, `TODO` without an issue reference, or commented-out security controls. Mocks live only in test code.
8. **Ambiguous wording is resolved by `<Glossary>` and `<Business-Rules>`.** If a term is not defined there, add a definition in `docs/decisions-log.md` before using it.
9. **Platform limits are facts to design around, not to ignore.** For iOS background location, region-monitoring limits, notification limits and App Store rules, read the current Apple documentation and write a small spike test before building the feature.
10. **Do not change this spec silently.** Propose spec changes as a diff in `docs/spec-changes.md` and wait for Jai's approval on anything that alters a requirement.
11. **Finish every phase with a report** in `docs/plans/phase-N-report.md`: what was built (by requirement ID), how it was verified, what is left, and new decisions made.

</Instructions-For-Claude-Code>

<Glossary>

Use these meanings everywhere: code, UI copy, tests and docs. UI copy uses the Portuguese/English labels; code uses the identifier.

| Term (UI) | Identifier | Meaning |
|---|---|---|
| Offer / Discount (Oferta / Desconto) | `Discount` | A benefit a business publishes. "Offer", "discount" and "reward" in the brief all map to this one entity; the kind of benefit is `benefit_type`. |
| Reward (Recompensa) | `benefit_type = POINTS or CASHBACK` | A discount whose benefit is points or cashback rather than a price reduction. |
| Business (Empresa) | `Business` | An organisation account: a bank, a mobile wallet provider or a merchant. |
| Business user | `BUSINESS_OWNER`, `BUSINESS_STAFF` | A person who works on a business account in the web portal. |
| Normal user / App user (Utilizador) | `USER` | A consumer using the iOS app. |
| Issuer (Banco emissor) | `Issuer` | A bank that issues cards. |
| Wallet provider (Carteira móvel) | `WalletProvider` | M-Pesa, e-Mola, mKesh. A wallet is a product, not a bank. |
| Card product | `CardProduct` | One specific card a bank offers: issuer + network + type + segment, e.g. "Absa Wealth Visa Credit". |
| Card type | `card_type` | `DEBIT`, `CREDIT` or `PREPAID`. |
| Card segment | `segment` | The bank's customer tier printed on or attached to the card: Classic, Gold, Platinum, Premier, Prestige, Wealth, Private, Business, Student, etc. |
| Premise (Estabelecimento) | `Premise` | A physical place with GPS coordinates where an offer can be used. An offer can have zero premises (online offer) or many. |
| Eligibility | `DiscountEligibility` | One rule saying who gets the benefit (a card product, any card of a bank, any card, a wallet, any wallet, or everyone) and how much. |
| Personalised alert | `match = PERSONAL` | An alert for an offer that matches a card or wallet the user saved. |
| General alert | `match = GENERAL` | An alert for an offer that does not need a specific card or wallet, or for cards/wallets the user does not hold but opted into. |
| Favourite (Favorito, heart) | `Favorite` | A discount the user hearted. Always alerts and always sends update pushes (IOS-7). |
| Alert (Alerta) | `AlertEvent` | A **local** notification the app shows when the user enters a premise's alert radius. |
| Push notification | `PushNotification` | A notification the **server** sends through APNs (favourite updates, broadcasts). |
| Alert radius | `alert_radius_m` | Distance around a premise that triggers an alert. Default 150 m. |
| Close proximity (map) | `nearby_radius_m` | Area shown by default on the home map and nearby list. Default 2 km, user can zoom out. |
| Recently introduced | `recent` | Offers published in the last 30 days, newest first, maximum 20 on the home carousel. |
| Active offer | `isActive()` | See `<Business-Rules>` rule BR-R2. Only active offers appear in the app, on the map or in alerts. |

</Glossary>

<Constraints>

**Must**

- Use Mozambican conventions: MZN currency, `Africa/Maputo` time, Portuguese default with English, `+258` phone numbers.
- Keep the API as the only place where business rules run; web and iOS call it. The iOS alert engine re-implements only the matching rules, from the shared spec in `packages/shared`, and is tested against the same test vectors (`packages/shared/test-vectors/matching.json`).
- Support iOS 17 and later on iPhone; latest two versions of Safari, Chrome, Edge and Firefox on the web.
- Keep precise user location on the device. The server only receives premise-level events and coarse (≈100 m) location.
- Comply with Google Maps Platform terms (attribution, restricted keys, no bulk storage of Places content beyond what the terms allow). Premise coordinates set by a business on the map are our own data.
- Comply with App Store Review Guidelines for location, notifications, account deletion and privacy labels.

**Must not**

- Collect or store card numbers (PAN), CVV, PIN, expiry dates or wallet PINs. A user only picks card products from the catalogue.
- Track location continuously in the background or sell/share location data.
- Ship illustrative or synthetic seed data to production, or show it there.
- Build SQL by string concatenation, or disable a security control to make a test pass.
- Add analytics or advertising SDKs that track users across apps (no IDFA, no App Tracking Transparency prompt in v1).
- Add features that are not traced to a requirement ID without Jai's approval.

</Constraints>

<POC-Profile>

**This build is a proof of concept.** Where this section and `<Assumptions-To-Confirm>` differ from `<Technical-Architecture>`, `<Hosting-And-DevOps>`, `<Testing-Strategy>` or `<Non-Functional-Requirements>`, follow this section and the "POC decision" column. Those other sections describe the production target and stay as the long-term design. All functional requirements (BR, UX, IOS, business rules, security basics in BR-1 and BR-5, and the constraints) still apply, except items the POC decisions explicitly defer.

### POC stack and hosting

| Need | POC choice | Cost |
|---|---|---|
| Web portal, public map, REST API | One Next.js app (App Router; API under `/api/v1` route handlers) on **Vercel Hobby** | Free (personal, non-commercial use); Vercel Pro about US$20/month when used commercially |
| Business logic | `packages/core` (plain TypeScript, no framework imports), used by the API route handlers | — |
| Database | **Neon** free plan: Postgres with the PostGIS extension, Prisma ORM, pooled connection string for serverless | Free |
| Rate limits, lockouts, sessions | Postgres tables (no Redis) | Free |
| Background work | No queue. Offer expiry is computed at read time (BR-R2). Favourite-update pushes are sent right after the save using Next.js `after()`. One daily **Vercel Cron** job purges unverified accounts and old tokens. Excel exports are generated in the request, capped at 10 000 rows. | Free |
| File storage (logos, photos, avatars) | **Vercel Blob** | Free allotment |
| Email | **Resend** free plan; Mailpit locally | Free |
| Bot protection | Cloudflare Turnstile | Free |
| Web map | Google Maps JavaScript API + Places Autocomplete, with daily quota caps and a billing alert at US$1 | Free within monthly free usage |
| iOS map | Apple MapKit | Free |
| Push | APNs (token-based key) sent directly from the API | Free, needs Apple Developer Program |
| iOS distribution | Free provisioning on Jai's iPhone first; TestFlight once the Apple Developer Program is active | US$99/year |
| Error tracking | Sentry free plan (web, API, iOS) | Free |
| CI | GitHub Actions for web/API; iOS tests run locally on the Mac | Free minutes |
| Domain | `<project>.vercel.app` | Free |

### POC repository layout

```
apps/web        Next.js app: portal, public map, /api/v1
apps/ios        SwiftUI app (Xcode project)
packages/core   business rules, matching, validation (zod), policies
packages/shared types, password rules, i18n strings, test vectors
packages/seed   seed:demo, seed:synthetic (small only), seed:geocode
docs/           ADRs, decisions log, phase plans and reports, traceability
```

### POC environments

- `local`: Docker Compose with Postgres + PostGIS and Mailpit only. Blob uploads go to a local folder.
- `preview`: one Vercel preview deployment per pull request, using a Neon database branch.
- `poc`: the Vercel production deployment of `main`, with the `seed:demo` data and the demo ribbon. There is no separate staging.

### POC phase changes

- Phase 0 adds `docs/adr/0002-poc-hosting.md` with each provider's current free-plan limits and the date checked.
- Phase 5 builds only the BR-12 items kept in assumption 1.
- Phase 9 runs the POC testing scope in assumption 21.
- Phase 10 becomes "Deploy POC": connect the repo to Vercel, create the Neon project, set environment variables, run migrations and `seed:demo`, smoke-test journeys J1–J6, distribute the iOS app to Jai's phone (and TestFlight once available). No Terraform and no App Store submission.

### Upgrade path (do not build now)

Keep these doors open so the POC can grow without a rewrite: business logic in `packages/core`; all time through the `Clock` service; all storage behind small interfaces (`BlobStore`, `Mailer`, `PushSender`, `RateLimiter`) with one POC implementation each; standard Postgres SQL so the database can move to RDS or a Neon paid plan.

</POC-Profile>



<Application-Name>

# Moz Discounts

- Bundle ID **[ASSUMPTION]**: `mz.mozdiscounts.app`
- Web domains **[ASSUMPTION]**: `mozdiscounts.co.mz` (public site and map), `app.mozdiscounts.co.mz` (portal), `api.mozdiscounts.co.mz` (API)
- Tagline **[ASSUMPTION]**: "Never miss a discount on your card."

</Application-Name>

<Market-Context>

| Item | Value |
|---|---|
| Country | Mozambique |
| Currency | Metical, `MZN` (format `1 250,00 MT`) |
| Time zone | `Africa/Maputo` (CAT, UTC+2, no daylight saving). Store all timestamps in UTC, display in local time. |
| Languages **[ASSUMPTION]** | Portuguese (pt-MZ) as default, English (en) as second language. All UI strings must be externalised from day one. |
| Phone format | `+258` followed by 9 digits |
| Main cities for seed data | Maputo, Matola, Beira, Nampula, Inhambane, Vilankulo, Pemba, Tete |
| Connectivity | Mobile data can be slow or intermittent: the app must cache data and degrade gracefully offline. |

**Catalogue:** the banks, card products, mobile wallets, premises and demo offers to load are defined in `<Seed-Data>`. Use only those; do not add others from memory.

- Premise categories: Restaurant, Café & Bakery, Bar & Lounge, Hotel & Resort, Spa & Wellness, Hair & Beauty Salon, Supermarket & Grocery, Fuel Station, Pharmacy, Fashion & Retail, Electronics, Travel Agency, Airline, Car Rental, Entertainment & Cinema, Gym & Fitness, Health & Clinic, Education, Online, Other. Admin can add more.

</Market-Context>

<Personas-And-Roles>

| Role | Who | Where they work | Summary of rights |
|---|---|---|---|
| `ADMIN` (backend administrator) | Moz Discounts staff | Web portal | Manages every functionality of the backend (BR-2.1). |
| `BUSINESS_OWNER` | Bank, wallet provider or merchant representative who registered the business | Web portal | Manages their business profile, products, premises, discounts, team members and reports. |
| `BUSINESS_STAFF` **[ASSUMPTION]** | Colleague invited by a business owner | Web portal | Same as owner for discounts and premises, cannot delete the business or manage team. |
| `USER` (normal app user) | Consumer | iOS app (and read-only public web map) | Registers, manages profile, cards, wallets, favourites and alert preferences. |
| Anonymous visitor | Anyone | Public web map | Browses discounted locations (BR-11). No personal alerts. |

Authorisation is **role-based plus ownership-based**: a business user can only ever read or change records that belong to their own business. Enforce this in the API layer (guards/policies) and with database-level checks in queries; never rely on the UI hiding buttons.

</Personas-And-Roles>

<Permissions-Matrix>

✔ = allowed · Own = only records of their own business or their own account · ✖ = denied (API returns 404 for other tenants' records, 403 for role-level denial).

| Action | ADMIN | BUSINESS_OWNER | BUSINESS_STAFF | USER | Anonymous |
|---|---|---|---|---|---|
| View public map and published offers | ✔ | ✔ | ✔ | ✔ | ✔ |
| Manage own profile, password, avatar, devices, 2FA | ✔ | ✔ | ✔ | ✔ | ✖ |
| Manage own cards, wallets, favourites, alert preferences | ✖ | ✖ | ✖ | ✔ | ✖ |
| Create a business profile | ✔ | ✔ (one per account) | ✖ | ✖ | ✖ |
| Edit business profile | ✔ | Own | ✖ | ✖ | ✖ |
| Invite/remove team members | ✔ | Own | ✖ | ✖ | ✖ |
| Create/edit premises | ✔ | Own | Own | ✖ | ✖ |
| Create/edit discounts (draft) | ✔ | Own | Own | ✖ | ✖ |
| Publish/pause/archive discounts | ✔ | Own, only if business is APPROVED | Own, only if business is APPROVED | ✖ | ✖ |
| Hard delete any record | ✔ | ✖ | ✖ | ✖ | ✖ |
| Approve/reject/suspend businesses | ✔ | ✖ | ✖ | ✖ | ✖ |
| Manage catalogue (issuers, card products, wallets, categories) | ✔ | Request only | Request only | ✖ | ✖ |
| View business stats | ✔ (all) | Own | Own | ✖ | ✖ |
| View alert logs | ✔ (all, personal data) | Own, aggregated and pseudonymised | Own, aggregated and pseudonymised | Own history | ✖ |
| View/export audit trail | ✔ (all) | Own business | ✖ | ✖ | ✖ |
| Send push broadcasts | ✔ | ✖ | ✖ | ✖ | ✖ |
| Change system settings | ✔ | ✖ | ✖ | ✖ | ✖ |
| Report an incorrect offer | ✖ | ✖ | ✖ | ✔ | ✖ |

Implement this table as a single policy module with one test per cell.

</Permissions-Matrix>


<Backend-Web-Application>

# Product Requirements

The numbering below keeps Jai's original numbering. Each requirement has acceptance criteria (AC) that must become automated tests.

### BR-1 Secure authentication

The web application must have authentication to log in with password safety and mechanisms to prevent SQL injection and brute-force attacks.

- Passwords hashed with **Argon2id** (memory ≥ 19 MiB, iterations ≥ 2, parallelism 1, per OWASP guidance). Never log, email or return a password.
- All database access through the ORM with parameterised queries. Raw SQL is only allowed through tagged-template parameterised APIs (e.g. Prisma `$queryRaw` with template literals), never string concatenation. Add a lint rule and a code-review checklist item that bans `$queryRawUnsafe` and string-built SQL.
- Every request body, query string and path parameter validated with a schema (zod) before reaching business logic; unknown fields rejected.
- Brute-force protection, all of:
  - Rate limit per IP and per account on `/auth/*` (e.g. 5 attempts per 15 min per account, 20 per 15 min per IP), stored in Redis.
  - Progressive lockout: after 5 failed attempts lock the account for 15 minutes, doubling up to 24 hours; email the user when locked.
  - Bot challenge (Cloudflare Turnstile **[ASSUMPTION]**) after 3 failed attempts on the web.
  - Generic error messages ("Email or password is incorrect") so attackers cannot enumerate accounts. Same response time for existing and non-existing accounts.
- Sessions:
  - Web portal: HTTP-only, `Secure`, `SameSite=Lax` session cookie (server-side session in Redis or rotating refresh token), idle timeout 30 min, absolute timeout 12 h, CSRF token on state-changing requests.
  - iOS app: short-lived JWT access token (15 min) + rotating refresh token (30 days) with reuse detection; refresh tokens stored hashed in the database and revocable per device.
- **[ASSUMPTION]** Optional TOTP two-factor authentication, **mandatory for `ADMIN`** and recommended for business users.
- Security headers: HSTS, CSP (no inline scripts except nonce-based), X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none.
- "Log out of all devices" for every user.
- **AC:** SQL injection payloads in every input field return 400/422 and never alter data (automated test with a payload list); the 6th wrong password within 15 minutes returns 429/locked; a locked account cannot log in even with the right password until the lock expires; passwords in the DB are Argon2id hashes.

### BR-2 Modules for user types and user management

The application must have modules for normal users, business users and backend administrators. Every module must include user settings, profile settings, password settings and other user-related management (name, email change with re-verification, phone, language, time zone display, profile picture, notification preferences, active sessions/devices, 2FA, delete account).

- **BR-2.1 Admin:** can manage **all** functionalities of the backend:
  - Users: list, search, filter, view, create, edit, suspend, reactivate, force password reset, delete (soft delete + anonymise).
  - Businesses: approve/reject business registrations, verify, suspend, edit, transfer ownership.
  - Catalogue (master data): issuers (banks, wallet providers), card networks, card products (type + segment), wallet products, premise categories, icons/images.
  - Discounts and premises of any business: view, edit, unpublish, delete, moderate.
  - Alerts: view alert logs (BR-10), send broadcast push notifications **[ASSUMPTION]**.
  - Audit trail viewing and export (BR-3).
  - System settings: geofence radius default, alert cooldown, password policy, email templates, feature flags, legal texts (terms, privacy policy).
  - Dashboards (BR-12).
- **BR-2.2 Business user:** can add their bank or wallet (or merchant business) and its associated discounts, the GPS locations of the premises where those discounts are offered, which discount applies to which card or wallet, and all related details (see BR-6 to BR-9).
- **BR-2.3 Normal app user:** can register, add their various bank cards and wallets, choose a profile picture, change password settings and set alert and notification preferences. Primarily delivered in the iOS app; the same API must back it.
- **AC:** each role sees only its own navigation; an API call by a business user to another business's resource returns 404 (not 403, to avoid leaking existence); admin can perform every CRUD listed above.

### BR-3 Audit trail

The application must keep an audit trail of all actions: who did it, when, and what was done. It must be exportable to Excel.

- Record for every create, update, delete, publish/unpublish, approve/reject, login success, login failure, logout, password change/reset, role change, export, settings change and permission-denied event.
- Fields: `id`, `occurred_at` (UTC), `actor_user_id`, `actor_email` (snapshot), `actor_role`, `business_id` (if any), `action` (e.g. `discount.update`), `entity_type`, `entity_id`, `summary` (human-readable), `changes` (JSON diff: before → after, with secrets and passwords redacted), `ip_address`, `user_agent`, `device_id`, `request_id`, `result` (success/failure).
- Append-only: no update or delete through the application; database role used by the app has `INSERT`/`SELECT` only on this table. Retention **[ASSUMPTION]**: 7 years, older records archived to cold storage.
- Admin UI: paginated table with filters (date range, actor, role, business, action, entity, result) and full-text search; detail drawer showing the diff.
- Business owners see the audit trail of their own business only **[ASSUMPTION]**.
- **Export to Excel (.xlsx)** of the current filtered view, generated server-side (ExcelJS), streamed for large exports, with a header row, frozen header, auto-filter, column widths, dates formatted in `Africa/Maputo`. Exports above 50 000 rows run as a background job and are emailed as a time-limited download link. Every export is itself audited.
- **AC:** editing a discount produces an audit row with correct before/after values; an export opens in Excel and matches the filtered on-screen rows.

### BR-4 Self-registration with email verification

Normal users and business users must be able to register for the corresponding profile using email and password. The email must be validated by sending an email asking the user to click a link to activate the account.

- Registration form: account type (user or business, on web; user only on iOS), name, email, password, confirm password, accept terms and privacy policy, language.
- Verification email with a single-use, random (≥ 32 bytes), hashed-at-rest token, valid 24 hours. Clicking it activates the account and opens the app (universal link) or the portal.
- "Resend verification email" with rate limit (3 per hour).
- Unverified accounts cannot log in (clear message with resend option); unverified accounts older than 7 days are purged **[ASSUMPTION]**.
- Business accounts, after email verification, enter **Pending approval** until an admin approves the business profile **[ASSUMPTION — prevents fake banks/merchants publishing offers]**. While pending they can prepare drafts but cannot publish.
- Forgot password: same token mechanism, valid 1 hour, invalidates all sessions after reset.
- Transactional email provider **[ASSUMPTION]**: Amazon SES (or Postmark/Resend), with SPF, DKIM and DMARC configured; branded HTML templates in PT and EN.
- **AC:** a new account cannot log in before clicking the link; an expired or reused link shows a friendly error and offers resend.

### BR-5 Password policy

Passwords must be at least **8 characters** and contain an uppercase letter, a lowercase letter and a special character.

- Interpretation: Jai wrote "8 digit"; this spec reads it as **minimum 8 characters**.
- **[ASSUMPTION, recommended]** also require at least one number, allow up to 128 characters, allow spaces and Unicode, reject the 10 000 most common passwords and passwords found in the Have I Been Pwned range API (k-anonymity), and reject passwords containing the user's email local part.
- Same validation rules shared in one package and applied in web UI, iOS UI and API (the API is the source of truth).
- Live strength meter and checklist in the UI.
- Prevent reuse of the last 5 passwords **[ASSUMPTION]**.
- **AC:** `Abcdefg!` passes the base rule, `abcdefg!` and `ABCDEFG1` fail; the API rejects weak passwords even if the client is bypassed.

### BR-6 Business profiles

Business users must be able to create a business profile. A business profile can be a **bank**, a **mobile wallet provider** or an **individual business** (merchant) that offers general discounts.

- Fields: business type, legal name, trading name, NUIT (tax number) **[ASSUMPTION]**, logo (PNG/JPG/SVG, max 2 MB, auto-resized), brand colour, description, website, contact email/phone, head-office address, social links, verification documents (optional upload for admin approval).
- A bank profile links to one issuer in the catalogue; a wallet provider profile links to one wallet product; a merchant has neither.
- Team management: owner invites staff by email (BR-2).
- **AC:** each of the three business types can be created, edited and submitted for approval.

### BR-7 Business capture: name, logo, cards, wallets and discount percentages

A business user must be able to capture their business name, business logo, and the debit, credit or prepaid card and card segment, or mobile wallet, on which discounts are offered. Example: a restaurant owner captures the restaurant name, GPS location, the bank cards or mobile wallets they give discounts for, and the discount percentage for **each card of each bank** and **each wallet**, or chooses to give a discount for **any bank** or **any mobile wallet**.

- Eligibility options per discount (one or more rows):
  - Specific card product (issuer + network + type + segment), e.g. *Absa Wealth Visa Credit*.
  - All cards of one issuer, optionally filtered by card type (e.g. all BCI debit cards).
  - Any bank card (any issuer), optionally filtered by network or type.
  - Specific mobile wallet (e.g. M-Pesa).
  - Any mobile wallet.
  - General offer: everyone, no card or wallet needed.
- Each eligibility row carries its own benefit: percentage discount (0.01–100 %), fixed amount off (MZN), cashback %, buy-X-get-Y, free item, or loyalty points **[ASSUMPTION: percentage required by brief, others optional]**, plus optional minimum spend and maximum discount cap.
- Banks and wallet providers capture their card products/wallet products from the admin catalogue; if a product is missing they request it and admin approves it.
- **AC:** the restaurant example can be fully captured: seed discounts `d-02` and `d-03` at Restaurante Marisco da Baía (BCI Gold 10 %, Absa Wealth 12 % on weekday lunches; any M-Pesa 5 % and any bank card 3 % every day).

### BR-8 Linking card/wallet types to premises with Google Maps

The application must allow each card type or wallet type to be linked to a specific premise (spa, resort, restaurant, supermarket, fuel station, travel agency, hair salon, etc.) where discounts apply, with the option to choose the GPS location through a **Google Maps** interface, and to state which discounts apply plus a specific comment about the discount. Example: link the **Absa Wealth** card to **Hotel Polana Spa** with **15 %** discount and the GPS location of Hotel Polana.

- Premise fields: name, category (from catalogue), address, city/province, GPS latitude/longitude, alert radius in metres (default 150 m, range 50–1 000 m), opening hours, phone, photos (up to 5), status.
- Location picker: Google Maps JavaScript API with Places Autocomplete search, draggable pin, "use my current location", and manual lat/long entry; reverse-geocode to fill the address. Validate coordinates fall inside Mozambique's bounding box (with an admin override for online/cross-border offers).
- A premise can be owned by a merchant **or** referenced by a bank/wallet provider: e.g. Absa can create the "Hotel Polana Spa" premise for its own offer even if the hotel itself is not on the platform. Admin can merge duplicate premises **[ASSUMPTION]**.
- Discount link fields: premise(s), eligibility rows (BR-7), title, description, specific comment / terms and conditions, valid from / valid to, days of week and time windows (e.g. weekdays 12:00–15:00), redemption instructions (e.g. "show card at till"), promo code (optional), image/banner, status.
- One discount can be linked to many premises (e.g. a supermarket chain's 40 branches) with bulk import of premises via CSV/Excel **[ASSUMPTION]**.
- **AC:** the Absa Wealth / Hotel Polana Spa example can be created via the map picker and appears on the public map and in the app at the correct coordinates.

### BR-9 Discount management (CRUD)

The business user or bank must be able to manage the list of all their discounts in a CRUD format.

- List view: search, filters (status, premise, category, card/wallet, validity), sort, pagination, bulk actions (publish, unpublish, archive, duplicate, extend validity).
- Create, read, update, delete (soft delete with archive; hard delete only by admin).
- Lifecycle: `DRAFT` → (`PENDING_REVIEW` if moderation enabled **[ASSUMPTION]**) → `PUBLISHED` → `EXPIRED` (automatic at `valid_to`) / `PAUSED` / `ARCHIVED`.
- Duplicate an existing discount as a starting point.
- Preview exactly how the discount appears in the iOS app card and notification.
- Any change to a published discount triggers update notifications to users who favourited it (IOS-7).
- Per-discount stats: impressions, alerts sent, alerts opened, favourites (BR-10/BR-12).
- **AC:** full create → edit → pause → republish → archive flow works and each step is audited.

### BR-10 Alert log

The application must capture a log of all alerts opened by all users when they come close to a premise that offers discounts.

- Log every alert lifecycle event: `TRIGGERED` (geofence entry reported), `DELIVERED` (notification shown), `OPENED` (user tapped it), `DISMISSED`, `DETAIL_VIEWED`, `SUPPRESSED` (cooldown, quiet hours or preference) with reason.
- Fields: user id, device id, premise id, discount id(s), event type, timestamp, distance from premise in metres, coarse device location (rounded to ~100 m) **[ASSUMPTION — privacy]**, app version, OS version.
- Admin sees all logs; a business sees aggregated and pseudonymised logs for its own premises/discounts only (no personal data) **[ASSUMPTION]**.
- Exportable to Excel like BR-3.
- **AC:** tapping a proximity notification in the app creates an `OPENED` row within 5 seconds when online, and is queued and sent later when offline.

### BR-11 Public web map of discounted locations

The application must offer a web view of all discounted locations in Google Maps format with icon- or image-based filters for each type of card, bank or wallet in the area.

- Full-screen Google Map with marker clustering; markers styled by premise category icon.
- Filter bar of **logo chips**: each bank logo, each wallet logo, card-type chips (debit/credit/prepaid), segment chips, category icons, "General offers" and "Show all". Multiple selection allowed.
- Search by place or area, "near me", radius slider.
- Clicking a marker opens a side panel with the premise, its active discounts and the eligible card/wallet images.
- Public (no login) read-only; logged-in users can favourite.
- Server-side geospatial queries by viewport bounding box (PostGIS), paginated, cached.
- **AC:** selecting the Absa logo chip shows only premises with an active Absa-eligible discount.

### BR-12 Analytics, reporting and moderation **[ASSUMPTION — item 12 was empty in the brief; this fills it]**

- **Admin dashboard:** active users, new registrations, users by card/wallet, businesses by type and approval status, published discounts, alerts triggered/delivered/opened, open rate, top premises, top discounts, map heat-map of alert density.
- **Business dashboard:** for their own discounts: impressions, alerts delivered, alerts opened, open rate, favourites, trend over time, comparison by premise and by card product. Export to Excel.
- **Moderation queue:** admin approves business profiles and (if enabled) discounts before they go live; rejection requires a reason that is emailed to the business.
- **Reporting/flagging:** app users can report an incorrect or expired discount; reports appear in the admin queue.
- **Notifications centre:** admin-configurable email templates and push broadcast (segmented by card/wallet, city).

# UI UX Requirements

### UX-1 Use the ui-ux-pro-max skill

Use the **ui-ux-pro-max-skill** to refine the look and feel of the application.

- In Phase 0 install it in Claude Code (it is a community skill: `nextlevelbuilder/ui-ux-pro-max-skill` on GitHub **[ASSUMPTION — verify the source and review its contents before installing]**) and run it on every new screen before marking the screen done.
- If the skill is unavailable, apply the design direction in UX-2 to UX-4 manually and run the design checklist in `<Quality-Gates>`.

### UX-2 Luxurious, clean typography and palette

Fonts and colour palette must feel luxurious with clean aesthetics and layout.

Proposed design tokens **[ASSUMPTION — starting point for the skill to refine]**:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#0E1525` | `#F5F2EC` | Primary text |
| `--canvas` | `#F8F6F1` (ivory) | `#0B111D` | App background |
| `--surface` | `#FFFFFF` | `#141C2B` | Cards, panels |
| `--gold` | `#B8955A` (champagne gold) | `#D4B47A` | Accent, primary buttons, highlights |
| `--emerald` | `#1F6F5C` | `#3FA58A` | Savings / discount values, success |
| `--slate` | `#5B6475` | `#9AA3B2` | Secondary text |
| `--line` | `#E6E1D6` | `#253047` | Borders, dividers |
| `--danger` | `#B3413B` | `#E06A63` | Errors |

- Typography: **Playfair Display** (or Fraunces) for display headings and big discount numbers; **Inter** for UI text and tables; tabular numerals for figures. On iOS use **New York** (serif) for headings and **SF Pro** for UI to respect platform conventions and Dynamic Type.
- Generous white space, 8-pt spacing grid, 12–16 px corner radius, soft shadows, thin 1 px gold rules as accents, no clutter.
- Full light and dark mode. WCAG 2.2 AA contrast for all text (verify gold-on-ivory combinations; use gold for large text/accents only).

### UX-3 SaaS layout

The web layout must resemble a modern Software-as-a-Service application.

- Collapsible left sidebar navigation with icons, top bar with global search, notifications bell, language switch and avatar menu.
- Dashboard home with KPI cards and charts; data tables with filters, column chooser, inline status badges, bulk actions; drawers and modals for create/edit; breadcrumb; toast notifications; empty states with clear calls to action; skeleton loaders.
- Responsive down to tablet and mobile widths; the public map is mobile-first.
- Component library **[ASSUMPTION]**: shadcn/ui on Tailwind CSS, themed with the tokens above; charts with Recharts or Tremor; tables with TanStack Table.

### UX-4 Logo

The logo must be a flat-design pictorial representation of discounts.

- Concept **[ASSUMPTION]**: a flat price tag whose hole is a map pin, with a % sign in the tag body, in champagne gold on ink (and reversed). It joins "discount" and "location" in one mark.
- Deliver as SVG (master), PNG at 16/32/180/512/1024 px, iOS app icon set (1024 px, no transparency), favicon, and monochrome version. Wordmark "Moz Discounts" in the display font.
- Claude Code should produce the SVG in code and the export script; final artwork can be refined by a designer.

</Backend-Web-Application>

<iOS-Mobile-App>

# Login Requirements

Target **[ASSUMPTION]**: iOS 17+, iPhone first (iPad compatible layout), Swift 5.10+/Swift 6, SwiftUI, Swift Concurrency, MVVM with a lightweight dependency container, Swift Package Manager.

### IOS-1 Face ID login

The app must allow Face ID login when the user enables it in app settings.

- Offer "Enable Face ID" after the first successful password login and in Settings → Security.
- Implementation: store the refresh token in the Keychain with `SecAccessControl` `.biometryCurrentSet` and `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`; unlock it via `LocalAuthentication`, then exchange it for an access token. Falls back to device passcode only if the user chooses; always falls back to password.
- If biometrics change (new face enrolled) the item is invalidated and the user must log in with password.
- `NSFaceIDUsageDescription` text in PT and EN.
- **AC:** with Face ID enabled, a cold start reaches the home screen after a successful Face ID scan with no password typed.

### IOS-2 Backend credential verification and device/login registration

The app must verify user ID and password against the backend and register the phone details and location details of each login.

- On each login send: device id (identifierForVendor), device model, iOS version, app version, locale, push token, and (if location permission is granted) coarse location of login (rounded) **[ASSUMPTION: coarse, for security and privacy]**.
- Backend stores a `login_events` row and maintains a `devices` list; users see their active devices and can revoke them.
- New-device login sends a security email to the user **[ASSUMPTION]**.
- **AC:** each login creates a login event visible to admin and to the user under "Devices".

### IOS-3 Registration with complex password

The app must let users tap Register, submit their email and a complex password (BR-5), and complete email verification (BR-4) via a universal link that opens the app.

### IOS-4 Profile management

Users must be able to manage their profile: name, profile image (camera or photo library, cropped, compressed, uploaded to object storage), email (with re-verification), phone, language, password change, forgot password, Face ID toggle, devices, delete account (App Store requirement), and download "my data" **[ASSUMPTION]**.

### IOS-5 Cards and wallets capture and onboarding

A registered user must be able to capture each bank card (bank, card type, segment/product) and each mobile wallet, so that when they are near a premise where that card or wallet gives a discount they get a **personalised** alert. They can also opt in to general alerts for other banks and wallets.

- **Never store or ask for the card number (PAN), CVV, PIN or expiry date.** The user picks from the catalogue: bank → network → type (debit/credit/prepaid) → product/segment (shown as card images). Optional nickname and optional last 4 digits for the user's own recognition **[ASSUMPTION]**. Wallet: provider (M-Pesa, e-Mola, mKesh); no wallet number needed **[ASSUMPTION]**. This keeps the product out of PCI DSS scope.
- Very user-friendly UI: visual carousel of card images per bank, search, big tap targets, one card at a time, "Add another" at the end.
- Onboarding journey after registration:
  1. Welcome and value proposition (3 short screens).
  2. Permission priming for notifications, then location ("While Using", then upgrade to "Always" with a clear explanation of why background location is needed for proximity alerts).
  3. "Add your first card" and "Add your first wallet" steps, each **skippable**.
  4. Alert preferences: personalised only / personalised + general offers / all offers.
- If the user **skips** card and wallet capture, they receive alerts for **all** available cards, wallets and general offers.
- If they do not skip, capture at least one card and one wallet, then offer "add more later" which is always available under **Menu → My cards & wallets** (add, edit, remove, reorder).
- Alert preferences screen: personalised vs general; per-bank and per-wallet toggles for general alerts; categories of interest; quiet hours; maximum alerts per day; alert radius preference (within admin limits).
- **AC:** a user holding only an Absa Wealth card receives an alert at Hotel Polana Spa for the 15 % offer and does not receive a BCI-only alert unless they enabled general alerts.

### IOS-6 Home map view with card/wallet filters

The home page must show a map of the user's current location with all discounts in close proximity. Tapping a marker opens the discount details. The map can be filtered by card images of the bank or the mobile wallet, or "Show all"; when filtered it only shows discounts applicable to that card.

- Map SDK **[ASSUMPTION]**: Google Maps SDK for iOS for parity with the web (alternative: Apple MapKit, which is free and native; decide in Phase 0).
- Clustered markers with category icons; a horizontal filter strip of the user's own card and wallet images first, then "General", then "Show all", then other banks/wallets.
- Bottom sheet list of nearby discounts sorted by distance; marker → detail screen with premise photo, discount value, eligible cards, terms, validity, opening hours, "Directions" (opens Apple/Google Maps), "Call", share, favourite.
- Recenter button; search by area; data fetched by viewport and cached for offline use.

### IOS-7 Recent discounts cards and favourites (heart)

The home page must show cards of the most recently introduced discounts from business users. The user can tap a heart to like/favourite a discount; the app will then always alert them for that offer and notify them of any update to it.

- Horizontal "New offers" carousel (and "Ending soon" **[ASSUMPTION]**) above or below the map, personalised to the user's cards first.
- Favourited discounts: proximity alerts always fire for them (bypass "personalised only" filter, still respect quiet hours), and any change (value, validity, terms, new premise, pause, expiry) sends a push notification via APNs.
- "Favourites" tab listing all hearted discounts with their status.
- **AC:** when a business edits a favourited discount, the user gets a push notification within 1 minute.

### IOS-8 Proximity alert engine **[ASSUMPTION — technical design needed to meet the product goal]**

- iOS can monitor at most **20 regions** per app. The app therefore:
  1. Downloads (and caches) relevant premises for the user's area.
  2. Monitors the nearest ≤ 19 premises as circular regions (iOS 17 `CLMonitor` with `CircularGeographicCondition`) plus one larger "refresh" region around the user; leaving the refresh region or a significant-location-change event recomputes the nearest set.
  3. On entry, evaluates matching discounts **locally** against the user's cards, wallets, preferences and favourites and shows a **local notification** immediately (works with poor connectivity), then reports the event to the backend (BR-10).
- Rules: cooldown per premise (default 12 h, admin-configurable), daily cap, quiet hours, only discounts valid at that moment (date, weekday, time window, premise opening hours).
- Rich notification: title "15 % off at Hotel Polana Spa", body "With your Absa Wealth card · valid until 31 Dec", bank logo thumbnail, actions "View" and "Not now".
- Battery: no continuous GPS in background; rely on region monitoring and significant-change service. Target < 3 % battery per day from the app in normal use.
- If the user grants only "While Using" location, alerts work only in the foreground and the app shows a gentle banner explaining how to enable background alerts.
- Test with Xcode GPX routes walking past seeded premises in Maputo.

</iOS-Mobile-App>

<Business-Rules>

These rules remove ambiguity in alerts, matching and lifecycle. Each rule ID must have unit tests.

**BR-R1 Matching.** An eligibility row matches a user when any of these is true (the user's saved cards and wallets are `C` and `W`):

| Scope | Matches when |
|---|---|
| `GENERAL` | always |
| `CARD_PRODUCT` | `C` contains that card product |
| `ISSUER_ANY` | `C` contains any card of that issuer that also passes the optional `card_type` and `network` filters |
| `ANY_BANK_CARD` | `C` is not empty and at least one card passes the optional filters |
| `WALLET` | `W` contains that wallet provider |
| `ANY_WALLET` | `W` is not empty |

Then apply the user's alert mode: `PERSONALISED` keeps personal matches and `GENERAL`-scope offers; `PERSONALISED_PLUS_GENERAL` also keeps offers for the issuers/wallets the user ticked in general alerts; `ALL` (or a user with no cards and no wallets) keeps everything. Favourited discounts are always kept.

**BR-R2 Active offer.** A discount is active at instant `t` when all are true: status is `PUBLISHED`; the business is `APPROVED`; `valid_from ≤ t`; `t < valid_to` (a `valid_to` date without time means the end of that day, 23:59:59 in `Africa/Maputo`); `t` falls in the schedule's weekdays and time windows in `Africa/Maputo` (empty schedule = always); and, for premise alerts, the premise is `ACTIVE`. Opening hours are shown but do not block alerts **[ASSUMPTION]**.

**BR-R3 Ranking.** When several offers apply at one premise or in a list: favourites first, then personal matches, then general; within a group, `PERCENT` and `CASHBACK` by value descending, then `FIXED` by amount descending, then other types; ties broken by newest `published_at`.

**BR-R4 One alert per premise entry.** One notification per premise entry, showing the best offer (BR-R3) and "+N more offers" when there are more.

**BR-R5 Suppression order.** Evaluate in this order and log the first reason that applies: `ALERTS_DISABLED` → `NO_MATCH` → `NOT_ACTIVE` → `QUIET_HOURS` → `COOLDOWN` (same premise within 12 h) → `DAILY_CAP` (default 5 alerts per day). Favourites skip `NO_MATCH` and `DAILY_CAP` but not `QUIET_HOURS` or `COOLDOWN`.

**BR-R6 Defaults (admin-configurable in `SystemSetting`).**

| Setting | Default | Allowed range |
|---|---|---|
| Alert radius per premise | 150 m | 50–1 000 m |
| Cooldown per premise | 12 h | 1–72 h |
| Daily alert cap per user | 5 | 1–20 |
| Nearby map radius | 2 km | 0.5–10 km |
| "Recent" window | 30 days | 7–90 days |
| Favourite-update push debounce | 60 s | 0–600 s |
| Unverified account purge | 7 days | 1–30 days |
| Verification link validity | 24 h | fixed |
| Password reset link validity | 1 h | fixed |

**BR-R7 Favourite update pushes.** A push is sent to users who favourited a discount when its benefit value, validity dates, schedule, terms, eligibility rows, premises or status change. Edits within the debounce window are merged into one push. Typo-only changes to the description do not trigger a push **[ASSUMPTION]**.

**BR-R8 Notification copy (templates, PT default / EN).**

| Event | PT | EN |
|---|---|---|
| Proximity, personal | **{benefit} no {premise}** · Com o seu {card_or_wallet}. Válido até {date}. | **{benefit} at {premise}** · With your {card_or_wallet}. Valid until {date}. |
| Proximity, general | **Oferta perto de si: {benefit} no {premise}** · {short_terms} | **Offer near you: {benefit} at {premise}** · {short_terms} |
| More offers suffix | + {n} outras ofertas | + {n} more offers |
| Favourite updated | **{premise}: oferta actualizada** · {change_summary} | **{premise}: offer updated** · {change_summary} |
| Favourite expiring (48 h before) | **A sua oferta favorita termina em breve** · {benefit} no {premise} até {date} | **Your favourite offer ends soon** · {benefit} at {premise} until {date} |

`{benefit}` renders as "15% de desconto" / "15% off", "500 MT de desconto" / "500 MT off", "5% cashback", "2 por 1" / "2 for 1".

**BR-R9 Catalogue changes.** Card products and wallet providers are never hard-deleted while users or eligibility rows reference them; they are deactivated and hidden from new selections.

**BR-R10 Account deletion.** Personal data is anonymised within 30 days; audit rows keep a pseudonymous actor id; alert events are kept only in aggregated form.

**BR-R11 Business approval.** `PENDING_APPROVAL` businesses can create drafts and premises but cannot publish. Rejected businesses can edit and resubmit. Suspending a business pauses all its published discounts immediately.

</Business-Rules>

<Screen-Inventory>

Build exactly these screens in v1. Each needs loading, empty, error and success states in PT and EN.

**Web: public**
Landing page · Public map (BR-11) · Premise detail panel · Discount detail · Login · Register (user or business) · Check your email · Email verified · Forgot password · Reset password · Terms · Privacy policy.

**Web: business portal**
Dashboard (BR-12) · Business profile (BR-6) · Team · Premises list · Premise editor with Google Maps picker (BR-8) · Premises CSV import · Discounts list (BR-9) · Discount editor wizard: 1 basics, 2 premises, 3 eligibility and benefit per card/wallet (BR-7), 4 schedule and validity, 5 preview, 6 publish · Discount stats · Audit trail (own business) · Account settings (profile, password, 2FA, sessions).

**Web: admin portal**
Dashboard · Users · User detail · Businesses and approval queue · Business detail · Catalogue: issuers, card networks, card products, wallet providers, premise categories · Discounts moderation · Reported offers queue · Alert logs · Audit trail with Excel export · Push broadcasts · Email templates · System settings · Account settings.

**iOS** (tab bar: Home · Favourites · Alerts · Profile)
Splash · Onboarding (3 value screens) · Notification permission priming · Location permission priming (While Using, then Always) · Login · Register · Check your email · Forgot password · Enable Face ID prompt · Add card flow (bank → card type → card product grid with images → optional nickname/last 4 → done/add another) · Add wallet flow · Alert preferences · Home (map + filter strip + "New offers" carousel + nearby bottom sheet) · Discount detail · Premise detail · Favourites · Alerts inbox (history of alerts and pushes) · Profile · My cards & wallets · Settings: security (password, Face ID, devices), notifications, language, privacy (my data, delete account) · Report an offer · Background-alerts-off banner.

</Screen-Inventory>

<Key-User-Journeys>

Each journey becomes one end-to-end test.

- **J1 Merchant to published offer (web):** owner of "Restaurante Marisco da Baía" registers as business → verifies email → creates merchant profile with logo → submits → admin approves → owner adds premise on Av. Marginal with the map picker → creates discount `d-02` (BCI Gold 10 %, Absa Wealth 12 %, weekdays 12:00–15:00) and discount `d-03` (any M-Pesa 5 %, any bank card 3 %, every day) → previews → publishes → both appear on the public map.
- **J2 Bank-owned offer at a third-party premise (web):** Absa business user creates premise "Hotel Polana Serena – Spa" → links Absa Wealth card at 15 % with comment "Mostre o cartão na recepção do spa" → publishes.
- **J3 User onboarding (iOS):** Ana registers → verifies → enables Face ID → grants notifications and Always location → adds Absa Wealth Visa Credit → skips wallet → chooses "Personalised only" → lands on Home with the map centred on her location.
- **J4 Walk-by alert (iOS):** Ana walks along Av. Julius Nyerere (GPX `polana-walk.gpx`) → enters the 150 m radius of the Polana spa → gets "15% de desconto no Hotel Polana Serena – Spa · Com o seu Absa Wealth" → taps it → detail opens → `TRIGGERED`, `DELIVERED`, `OPENED` events reach the API.
- **J5 Favourite update (iOS + web):** Bruno hearts the Marisco da Baía offer → owner changes BCI Gold from 10 % to 15 % → Bruno gets a push within 60 s.
- **J6 Admin audit export (web):** admin filters the audit trail to last 7 days and "discount.update" → exports → the .xlsx rows match the screen.

</Key-User-Journeys>


<Technical-Architecture>

> **Production target.** For the current POC build, `<POC-Profile>` overrides this section.

**[ASSUMPTION]** stack chosen for a small team building with Claude Code; change in Phase 0 if Jai prefers otherwise.

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo: `apps/api`, `apps/web`, `apps/ios`, `packages/shared` (zod schemas, password rules, types), `packages/ui` |
| API | Node.js 22 LTS, TypeScript (strict), NestJS, REST + OpenAPI 3.1 (generated), versioned under `/v1` |
| Database | PostgreSQL 16 + **PostGIS** (geospatial queries, `geography(Point,4326)`, GiST indexes) |
| ORM / migrations | Prisma (parameterised queries; raw SQL only for PostGIS via tagged templates) |
| Cache, rate limits, queues | Redis 7 + BullMQ (emails, exports, push fan-out, expiry jobs) |
| Web portal + public map | Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui, TanStack Query/Table, Google Maps JS API with `@googlemaps/markerclusterer`, next-intl |
| iOS | SwiftUI, Swift Concurrency, Core Location (`CLMonitor`), UserNotifications, LocalAuthentication, Keychain, Google Maps SDK or MapKit, OpenAPI-generated client (swift-openapi-generator) |
| Files | S3-compatible object storage + CDN; images resized (sharp) to WebP/AVIF; virus scan on uploads **[ASSUMPTION]** |
| Email | Amazon SES (or Postmark) |
| Push | APNs direct (token-based .p8 auth) |
| Bot protection | Cloudflare Turnstile |
| Observability | Structured JSON logs (pino) with request IDs, OpenTelemetry traces, Sentry for web/API/iOS crash reporting, uptime checks |
| Excel | ExcelJS (streaming writer) |

Architecture rules:

- API is the single source of truth for business rules; web and iOS are clients.
- All IDs are UUIDv7. All money in integer minor units (centavos) with currency `MZN`. All percentages as decimal(5,2).
- Soft delete (`deleted_at`) for business data; audit trail append-only.
- Geospatial: `GET /v1/discounts/nearby?lat&lng&radius` and `GET /v1/map/premises?bbox=` use PostGIS `ST_DWithin` / `ST_MakeEnvelope` with GiST indexes; p95 < 300 ms for 50 000 premises.
- Background jobs: expire discounts at `valid_to`, purge unverified accounts, fan-out favourite update pushes, generate large exports.

</Technical-Architecture>

<Data-Model>

Core entities (Prisma models; snake_case tables). Claude Code must produce the full schema, an ER diagram (Mermaid) in `docs/`, and seed data.

| Entity | Key fields |
|---|---|
| `User` | id, email (unique, citext), password_hash, role, status (PENDING_VERIFICATION, ACTIVE, SUSPENDED, DELETED), first_name, last_name, phone, avatar_url, locale, email_verified_at, mfa_secret (encrypted), failed_login_count, locked_until, created_at, updated_at, deleted_at |
| `PasswordHistory` | user_id, password_hash, created_at |
| `EmailToken` | id, user_id, type (VERIFY, RESET, EMAIL_CHANGE, INVITE), token_hash, expires_at, used_at |
| `Session` / `RefreshToken` | id, user_id, device_id, token_hash, family_id, expires_at, revoked_at, last_used_at, ip |
| `Device` | id, user_id, vendor_id, model, os_version, app_version, push_token, biometrics_enabled, last_seen_at, revoked_at |
| `LoginEvent` | id, user_id, device_id, success, failure_reason, ip, user_agent, coarse_lat, coarse_lng, occurred_at |
| `Business` | id, type (BANK, WALLET_PROVIDER, MERCHANT), legal_name, trading_name, nuit, logo_url, brand_color, description, website, contact_email, contact_phone, address, issuer_id (nullable), wallet_provider_id (nullable), status (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, SUSPENDED), approved_by, approved_at |
| `BusinessMember` | business_id, user_id, role (OWNER, STAFF), invited_at, accepted_at |
| `Issuer` (bank) | id, name, short_name, logo_url, country |
| `CardNetwork` | id, name (Visa, Mastercard, …), logo_url |
| `CardProduct` | id, issuer_id, network_id, card_type (DEBIT, CREDIT, PREPAID), segment, name (e.g. "Absa Wealth Visa Credit"), image_url, active |
| `WalletProvider` | id, name (M-Pesa, e-Mola, mKesh), operator, logo_url, active |
| `PremiseCategory` | id, name_pt, name_en, icon, sort_order |
| `Premise` | id, owner_business_id, name, category_id, address, city, province, location geography(Point,4326), alert_radius_m, opening_hours (JSON), phone, photos, status |
| `Discount` | id, business_id, title, description, terms, redemption_instructions, promo_code, image_url, valid_from, valid_to, schedule (JSON: weekdays + time windows), status, published_at, version |
| `DiscountPremise` | discount_id, premise_id |
| `DiscountEligibility` | id, discount_id, scope (CARD_PRODUCT, ISSUER_ANY, ANY_BANK_CARD, WALLET, ANY_WALLET, GENERAL), card_product_id, issuer_id, card_type, network_id, wallet_provider_id, benefit_type (PERCENT, FIXED, CASHBACK, BOGO, FREE_ITEM, POINTS), benefit_value, min_spend, max_discount, comment |
| `UserCard` | id, user_id, card_product_id (or issuer_id + card_type + segment if product unknown), nickname, last4 (optional), created_at |
| `UserWallet` | id, user_id, wallet_provider_id, nickname |
| `AlertPreference` | user_id, mode (PERSONALISED, PERSONALISED_PLUS_GENERAL, ALL), general_issuer_ids, general_wallet_ids, category_ids, quiet_hours_start, quiet_hours_end, max_per_day, radius_m |
| `Favorite` | user_id, discount_id, created_at |
| `AlertEvent` | id, user_id, device_id, premise_id, discount_ids, event_type, suppression_reason, distance_m, coarse_lat, coarse_lng, app_version, occurred_at |
| `PushNotification` | id, user_id, type (PROXIMITY, FAVOURITE_UPDATE, BROADCAST), payload, sent_at, apns_id, status |
| `DiscountReport` | id, user_id, discount_id, reason, comment, status |
| `AuditLog` | see BR-3 |
| `SystemSetting` | key, value (JSON), updated_by, updated_at |

Provenance and extra fields: `Issuer`, `CardProduct`, `WalletProvider`, `Business`, `Premise` and `Discount` also carry `data_origin` (`REAL`, `SEED_VERIFIED`, `SEED_ILLUSTRATIVE`, `SYNTHETIC`; production accepts only `REAL`), `source_url` and `source_checked_at`. `Premise` has `location_approx` (boolean) and nullable coordinates (a premise without coordinates never triggers alerts). `Discount` has `is_online` (no premise required, never triggers alerts). `DiscountEligibility` has `value_text` (localised) for `FREE_ITEM` benefits, `value_mzn` for `FIXED`, and `min_spend_mzn` / `max_discount_mzn`.

Matching rule (shared, unit-tested; full detail in `<Business-Rules>` BR-R1): a discount eligibility matches a user if scope is `GENERAL`; or `CARD_PRODUCT` and the user holds that product; or `ISSUER_ANY` and the user holds any card of that issuer (respecting card_type/network filters); or `ANY_BANK_CARD` and the user holds any card (respecting filters); or `WALLET` and the user holds that wallet; or `ANY_WALLET` and the user holds any wallet. Users with no cards and no wallets, or with mode `ALL`, match everything. Favourites always match.

</Data-Model>

<API-Outline>

Generate the full OpenAPI spec; minimum endpoints (all under `/v1`):

- **Auth:** `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify`
- **Me:** `GET/PATCH /me`, `POST /me/avatar`, `POST /me/change-password`, `POST /me/change-email`, `GET/DELETE /me/devices/{id}`, `GET/PUT /me/alert-preferences`, `GET/POST/PATCH/DELETE /me/cards`, `GET/POST/PATCH/DELETE /me/wallets`, `GET/POST/DELETE /me/favorites`, `GET /me/export`, `DELETE /me`
- **Catalogue (public read, admin write):** `/issuers`, `/card-networks`, `/card-products`, `/wallet-providers`, `/premise-categories`
- **Business:** `POST /businesses`, `GET/PATCH /businesses/{id}`, `POST /businesses/{id}/submit`, `/businesses/{id}/members`, `/businesses/{id}/premises` (CRUD + CSV import), `/businesses/{id}/discounts` (CRUD + publish/pause/archive/duplicate), `/businesses/{id}/stats`
- **Discovery:** `GET /map/premises?bbox&filters`, `GET /discounts/nearby?lat&lng&radius&filters`, `GET /discounts/recent`, `GET /discounts/{id}`, `GET /premises/{id}`, `GET /sync/geofences?lat&lng` (compact payload for the iOS alert engine, with ETag)
- **Alerts:** `POST /alerts/events` (batch, idempotent by client event id)
- **Reports:** `POST /discounts/{id}/reports`
- **Admin:** `/admin/users`, `/admin/businesses` (approve/reject), `/admin/discounts` (moderate), `/admin/audit-logs` (+ `/export.xlsx`), `/admin/alert-events` (+ export), `/admin/settings`, `/admin/broadcasts`, `/admin/dashboard`
- Conventions: cursor pagination, RFC 9457 problem+json errors, `Idempotency-Key` header on POSTs from mobile, ETags on catalogue and geofence sync.

</API-Outline>

<Non-Functional-Requirements>

- **NFR-1 Security:** OWASP ASVS 4.0 Level 2 as baseline; OWASP Top 10 and OWASP MASVS for iOS. TLS 1.2+ everywhere, certificate pinning optional **[ASSUMPTION]**. Secrets only in a secrets manager, never in the repo. Encrypt sensitive columns (MFA secrets) at application level. Least-privilege DB roles. Dependency scanning and secret scanning in CI. Uploaded files validated by magic bytes, re-encoded, size-limited.
- **NFR-2 Privacy and compliance:** comply with Mozambique's Electronic Transactions Law (Lei n.º 3/2017) and apply GDPR-grade practice (consent, purpose limitation, data minimisation, right to access and delete) **[ASSUMPTION — confirm with local legal counsel]**. Location data minimised: precise location stays on the device; the server only receives coarse location and premise-level events. Privacy policy and Apple App Privacy "nutrition label" prepared. No PAN/CVV ever stored (no PCI DSS scope).
- **NFR-3 Performance:** API p95 < 300 ms for reads, < 800 ms for writes; web map interactive < 2.5 s LCP on 4G; iOS cold start < 2 s; proximity notification within 10 s of entering the radius when the OS wakes the app.
- **NFR-4 Availability:** 99.5 % monthly for API **[ASSUMPTION]**; daily automated backups with point-in-time recovery (7 days), restore tested quarterly; RPO 15 min, RTO 4 h.
- **NFR-5 Scalability:** design for 100 000 users, 2 000 businesses, 50 000 premises, 20 000 active discounts in year one, horizontally scalable stateless API.
- **NFR-6 Accessibility:** WCAG 2.2 AA on web; iOS VoiceOver labels, Dynamic Type, sufficient contrast, 44 pt touch targets.
- **NFR-7 Localisation:** PT and EN for all UI, emails and push notifications; MZN formatting; dates in local format.
- **NFR-8 Maintainability:** TypeScript strict, ESLint + Prettier, SwiftLint + SwiftFormat, conventional commits, ADRs in `docs/adr/`, README per app, generated API docs.

</Non-Functional-Requirements>

<Testing-Strategy>

| Level | Tooling | Scope / target |
|---|---|---|
| Unit | Vitest (shared, web), Jest (NestJS), XCTest (iOS) | Business rules: password policy, eligibility matching, schedule/validity evaluation, cooldown logic, audit diffing. ≥ 85 % line coverage on `packages/shared` and API services. |
| Integration | Supertest + **Testcontainers** (real PostgreSQL/PostGIS + Redis) | Every endpoint: happy path, validation errors, authz (cross-tenant access returns 404), audit rows written. |
| Security | SQL-injection and XSS payload suites, brute-force/lockout tests, OWASP ZAP baseline scan in CI, `pnpm audit`, Semgrep, gitleaks, MobSF scan for the iOS build | Must pass with no High/Critical findings before release. |
| Contract | OpenAPI schema validation of responses; generated iOS client compiles against the current spec | Breaking changes fail CI. |
| E2E web | Playwright | Registration + email verification (using Mailpit locally), login/lockout, business onboarding → approval → create premise via map picker → create discount → publish → appears on public map, audit export downloads a valid .xlsx. |
| E2E iOS | XCUITest + GPX location simulation | Onboarding with and without skipping cards, Face ID (simulator enrolment), map filter by card, favourite, proximity alert fires when walking a GPX route past Hotel Polana. |
| Performance | k6 | Nearby and bbox queries at 200 RPS with 50 000 premises seeded meet NFR-3. |
| Accessibility | axe-core in Playwright; Xcode Accessibility Inspector | No serious/critical violations. |
| UAT | Checklist per requirement ID in `docs/uat.md` | Signed off by Jai. |

- Test data, simulation tools and expected results are defined in `<Test-Data-Simulation>` and `<Seed-Data>`.
- Every requirement ID must map to at least one automated test; maintain `docs/traceability.md` (requirement → tests → status).

</Testing-Strategy>

<Test-Data-Simulation>

Goal: anyone can recreate the same realistic data, walk the same routes and get the same expected results, on a laptop, in CI and in staging.

### TD-1 Data generation tooling

- Package `packages/seed` with three commands:
  - `pnpm seed:demo` loads the hand-written demo dataset in `<Seed-Data>` (deterministic, idempotent, safe to re-run).
  - `pnpm seed:synthetic --profile=<small|medium|load>` adds generated data on top, using `@faker-js/faker` with a **fixed random seed `20261023`** and curated Mozambican name, street and neighbourhood lists in `packages/seed/data/lists/` (do not rely on Faker's Brazilian or Portuguese addresses).
  - `pnpm seed:reset` truncates and re-seeds. Refuses to run unless `APP_ENV` is `local`, `test` or `staging`.
- Every seeded row has `data_origin` = `SEED_VERIFIED`, `SEED_ILLUSTRATIVE` or `SYNTHETIC`. The production migration pipeline fails if any such row exists in production.
- Non-production web and iOS builds show a small "Dados de demonstração / Demo data" ribbon.

| Profile | Users | Businesses | Premises | Discounts | Alert events | Use |
|---|---|---|---|---|---|---|
| `small` | 50 | 20 | 200 | 300 | 5 000 | Local development, CI E2E |
| `medium` | 5 000 | 300 | 5 000 | 8 000 | 500 000 | Staging, dashboards, UAT |
| `load` | 100 000 | 2 000 | 50 000 | 20 000 | 5 000 000 | k6 performance tests (NFR-3, NFR-5) |

Generation rules:

- Premise coordinates are sampled inside land-only polygons for each city (stored as GeoJSON in `packages/seed/data/cities/`), never in the sea or across the border. City weights: Maputo 45 %, Matola 15 %, Beira 12 %, Nampula 10 %, others 18 %.
- Category mix: restaurants 25 %, supermarkets 12 %, cafés 10 %, hair & beauty 10 %, fuel 8 %, pharmacy 7 %, retail 8 %, hotels & spas 8 %, others 12 %.
- Eligibility mix per discount: 1–4 rows; 40 % specific card product, 15 % any card of an issuer, 10 % any bank card, 20 % specific wallet, 5 % any wallet, 10 % general.
- Benefit values: percentages drawn from {3, 5, 7, 10, 12, 15, 20, 25, 30}; fixed amounts from {100, 250, 500, 1 000} MT.
- Validity: 70 % active now, 10 % expired, 10 % future, 10 % without end date. Status: 85 % published, 5 % draft, 5 % paused, 5 % archived.
- User wallets: M-Pesa 70 %, e-Mola 35 %, mKesh 10 % (a user can hold several); 0–4 cards per user; 15 % of users skip card and wallet capture.
- Alert funnel for synthetic events: delivered 92 % of triggered, opened 18 % of delivered, detail viewed 70 % of opened.

### TD-2 Time simulation

- All code reads time from an injected `Clock` service, never `Date.now()` or `Date()` directly (enforce with a lint rule).
- In `test` env only, the API accepts header `X-Test-Now: <ISO-8601>`; the iOS app accepts launch argument `-UITestNow <ISO-8601>`. Both are compiled out of production builds, and a CI check asserts they are absent.

### TD-3 Location simulation

- GPX routes in `apps/ios/TestSupport/GPX/` (walking speed ≈ 1.4 m/s, one point every 5 s):
  - `polana-walk.gpx`: along Av. Julius Nyerere past Hotel Polana Serena (enters and leaves the 150 m radius).
  - `marginal-drive.gpx`: along Av. Marginal at 40 km/h past Restaurante Marisco da Baía and Cinema Baía Lazer.
  - `matola-commute.gpx`: Matola → Maputo Baixa, crossing several premises (tests the 20-region rotation, IOS-8).
  - `baixa-walk.gpx`: Av. Vladimir Lenine past TecnoMoz Informática and Posto Avenida.
  - `vilankulo-beach.gpx`, `beira-centre.gpx`: provincial premises.
  - `stationary-polana.gpx`: user stays inside one radius for 2 h (tests cooldown).
- Use Xcode's location simulation for UI tests and `xcrun simctl location <device> start` for scripted runs.
- API-level simulation: `pnpm simulate:walk --user ana --route polana-walk` replays a route as geofence events against the API to test BR-10 without a device.

### TD-4 Notification and email simulation

- Push: sample payloads in `apps/ios/TestSupport/APNs/*.apns` (proximity, favourite update, broadcast) usable with `xcrun simctl push`; staging uses the APNs sandbox.
- Email: Mailpit locally and in CI; Playwright reads verification and reset links through the Mailpit API.

### TD-5 Scenario matrix with expected results

All scenarios use the demo dataset and personas in `<Seed-Data>`, at a simulated time of **Wednesday 4 Nov 2026, 13:00 Maputo** unless stated.

| ID | Persona | Situation | Expected result |
|---|---|---|---|
| S01 | Ana | Enters Polana spa radius | Alert "15% de desconto no Hotel Polana Serena – Spa · Com o seu Absa Wealth" |
| S02 | Ana | Enters Marisco da Baía radius | One alert showing Absa Wealth 12 %, "+1 outras ofertas" (any bank card 3 %) |
| S03 | Bruno | Enters Marisco da Baía radius | Best offer BCI Gold 10 %, "+2 outras ofertas" (M-Pesa 5 %, any card 3 %) |
| S04 | Bruno | Same, Saturday 13:00 | BCI weekday offer not active; best is M-Pesa 5 % |
| S05 | Carla (skipped cards) | Enters Marisco da Baía radius | Alert with all offers; best Absa Wealth 12 % |
| S06 | Dércio (e-Mola, personalised only) | Enters Polana spa radius | No alert; event `SUPPRESSED / NO_MATCH` |
| S07 | Ana | Re-enters Polana 2 h after S01 | No alert; `SUPPRESSED / COOLDOWN` |
| S08 | Elisa (quiet hours 22:00–07:00) | Enters Café Jardim at 06:30 | No alert; `SUPPRESSED / QUIET_HOURS` |
| S09 | Elisa | Café Jardim owner edits her favourite offer | Push within 60 s |
| S10 | Any | Near Restaurante Ilha Sabor (Nampula, expired offer) | Not on map, no alert |
| S11 | Any | Future offer before and after `valid_from` (time travel) | Hidden before, shown after |
| S12 | Carla | Vodacom online offer `d-22` (no premise) | Listed in offers, never triggers an alert |
| S13 | Fábio (While Using only) | Walks past TecnoMoz Informática with the app in background (`baixa-walk.gpx`) | No alert; banner explains how to enable background alerts |
| S14 | Ana | Airplane mode at Polana | Local alert fires; `OPENED` event queued and sent on reconnect |
| S15 | Hugo | 6 wrong passwords in 15 min | Account locked, lock email sent |
| S16 | Inês (unverified) | Tries to log in | Blocked with "verify your email" and resend option |
| S17 | Pending business owner | Tries to publish | Blocked; draft saved |
| S18 | Absa owner | Calls API to edit a BCI offer | 404, audit row `permission.denied` |
| S19 | Anonymous | Public map, Absa logo chip | Only premises with active Absa-eligible offers: Polana spa, Marisco da Baía, Resort Areia Branca |
| S20 | Gina (daily cap 3) | Fourth eligible premise in one day | `SUPPRESSED / DAILY_CAP` |
| S21 | Bruno | Holds BCI Gold and M-Pesa, map filter "M-Pesa" | Only M-Pesa-eligible offers shown |
| S22 | Ana | Walks `matola-commute.gpx` | Region set rotates; every premise on the route within radius produces the correct alert or suppression |

### TD-6 Test vectors shared by API and iOS

`packages/shared/test-vectors/matching.json` holds input (user cards, wallets, mode, favourites, time, premise offers) and expected output (matched offer ids in ranked order, suppression reason). Generated from S01–S22 plus edge cases. Both the TypeScript and Swift implementations must pass every vector.

### TD-7 Test-only endpoints

`POST /v1/test/reset`, `POST /v1/test/clock`, `POST /v1/test/seed` exist only when `APP_ENV` is `local` or `test`. They are not registered in staging or production, and CI checks the production route table.

</Test-Data-Simulation>

<Seed-Data>

Demo dataset for `pnpm seed:demo`. Convert these tables into JSON files under `packages/seed/data/` **exactly as written**: same ids, names and values. Do not add real-looking offers that are not listed here.

### SD-0 Data provenance (read first)

| `data_origin` | Meaning | Allowed in production |
|---|---|---|
| `SEED_VERIFIED` | Taken from a public source listed in SD-7, with URL and date. Still must be reconfirmed with the business before go-live. | Only after the business confirms it and takes ownership of it |
| `SEED_ILLUSTRATIVE` | Realistic but invented by this spec for demos and tests. Real banks and wallets appear as catalogue entries; the offers attached to them are **not real**. Merchants marked *(fictional)* do not exist. | Never |
| `SYNTHETIC` | Generated by `seed:synthetic`. | Never |

Public research on 23 Oct 2026 found very few published card or wallet discounts in Mozambique (see SD-7). Most offers below are therefore illustrative. Replace them with real offers collected from banks, wallet providers and merchants during business onboarding.

Coordinates are **approximate** (±300 m) and marked `approx: true`. Run `pnpm seed:geocode` in a development environment to refine them with the Google Geocoding API before demos, and never treat them as surveyed locations.

### SD-1 Issuers (banks)

| id | Name | Short name | Note |
|---|---|---|---|
| `iss-bci` | Banco Comercial e de Investimentos | BCI | |
| `iss-mbim` | Millennium bim | Millennium bim | |
| `iss-sbm` | Standard Bank Moçambique | Standard Bank | |
| `iss-absa` | Absa Bank Moçambique | Absa | |
| `iss-moza` | Moza Banco | Moza | |
| `iss-fnb` | FNB Moçambique | FNB | |
| `iss-ned` | Nedbank Moçambique | Nedbank | Formerly Banco Único |
| `iss-access` | Access Bank Moçambique | Access Bank | |
| `iss-eco` | Ecobank Moçambique | Ecobank | |
| `iss-fcb` | First Capital Bank Moçambique | FCB | |
| `iss-letshego` | Banco Letshego | Letshego | |
| `iss-vista` | Vista Bank Moçambique | Vista Bank | Formerly Banco Société Générale Moçambique; confirm current trading name |
| `iss-uba` | United Bank for Africa Moçambique | UBA | |
| `iss-big` | Banco BIG Moçambique | BIG | |

`data_origin: SEED_VERIFIED` for the bank names (Banco de Moçambique register, see SD-7); confirm the list against the current register before go-live.

### SD-2 Card products

Product names are **illustrative** unless the note says otherwise. Ask each bank for its real product list during onboarding.

| id | Issuer | Network | Type | Segment | Name | Note |
|---|---|---|---|---|---|---|
| `cp-bci-bio` | BCI | Visa | DEBIT | Classic | BCI BIO Visa Débito | Real product (biodegradable debit card; 0.04 % of each POS purchase goes to BIOFUND). Show this as a product feature, not as a discount. |
| `cp-bci-gold` | BCI | Visa | CREDIT | Gold | BCI Gold Visa Crédito | Illustrative |
| `cp-bci-platinum` | BCI | Visa | CREDIT | Platinum | BCI Platinum Visa Crédito | Illustrative |
| `cp-mbim-classic` | Millennium bim | Visa | DEBIT | Classic | Millennium bim Visa Débito | Illustrative |
| `cp-mbim-prestige` | Millennium bim | Visa | DEBIT | Prestige | Millennium bim Prestige Débito | Prestige segment is real; card name illustrative |
| `cp-mbim-mlider` | Millennium bim | Visa | DEBIT | Business | Millennium bim MLÍDER Empresas | MLÍDER is a real business programme (certificate/card); modelled as a business card product |
| `cp-sbm-debit` | Standard Bank | Visa | DEBIT | Classic | Standard Bank Visa Débito | Illustrative |
| `cp-sbm-prestige` | Standard Bank | Mastercard | CREDIT | Prestige | Standard Bank Prestige Mastercard | Illustrative |
| `cp-absa-wealth` | Absa | Visa | CREDIT | Wealth | Absa Wealth Visa Crédito | From Jai's example; confirm with Absa |
| `cp-absa-premier` | Absa | Visa | CREDIT | Premier | Absa Premier Visa Crédito | Illustrative |
| `cp-absa-debit` | Absa | Visa | DEBIT | Classic | Absa Visa Débito | Illustrative |
| `cp-moza-debit` | Moza | Visa | DEBIT | Classic | Moza Visa Débito | Illustrative |
| `cp-moza-credit` | Moza | Visa | CREDIT | Gold | Moza Gold Visa Crédito | Illustrative |
| `cp-fnb-premier` | FNB | Visa | CREDIT | Premier | FNB Premier Visa Crédito | Illustrative |
| `cp-ned-debit` | Nedbank | Mastercard | DEBIT | Classic | Nedbank Mastercard Débito | Illustrative |
| `cp-access-debit` | Access Bank | Visa | DEBIT | Classic | Access Bank Visa Débito | Illustrative |
| `cp-eco-prepaid` | Ecobank | Visa | PREPAID | Classic | Ecobank Visa Pré-pago | Illustrative |
| `cp-letshego-debit` | Letshego | Mastercard | DEBIT | Classic | Letshego Mastercard Débito | Real product, launched May 2026 (SD-7); confirm the exact name |
| `cp-fcb-debit` | FCB | Visa | DEBIT | Classic | FCB Visa Débito | Illustrative |

### SD-3 Mobile wallets

| id | Name | Operator | Note |
|---|---|---|---|
| `wl-mpesa` | M-Pesa | Vodacom Moçambique | Real |
| `wl-emola` | e-Mola | Movitel | Real |
| `wl-mkesh` | mKesh | Tmcel | Real |

The three wallets are interoperable for transfers (Banco de Moçambique, SD-7). Interoperability does not make an offer for one wallet valid for another.

### SD-4 Businesses

| id | Type | Trading name | Linked to | Status | Origin |
|---|---|---|---|---|---|
| `biz-absa` | BANK | Absa Bank Moçambique | `iss-absa` | APPROVED | Illustrative account |
| `biz-bci` | BANK | BCI | `iss-bci` | APPROVED | Illustrative account |
| `biz-mbim` | BANK | Millennium bim | `iss-mbim` | APPROVED | Illustrative account |
| `biz-moza` | BANK | Moza Banco | `iss-moza` | APPROVED | Illustrative account |
| `biz-mpesa` | WALLET_PROVIDER | Vodacom M-Pesa | `wl-mpesa` | APPROVED | Illustrative account |
| `biz-emola` | WALLET_PROVIDER | Movitel e-Mola | `wl-emola` | APPROVED | Illustrative account |
| `biz-marisco` | MERCHANT | Restaurante Marisco da Baía *(fictional)* | — | APPROVED | Illustrative |
| `biz-solnascente` | MERCHANT | Supermercado Sol Nascente *(fictional)* | — | APPROVED | Illustrative |
| `biz-cafejardim` | MERCHANT | Café Jardim *(fictional)* | — | APPROVED | Illustrative |
| `biz-beleza` | MERCHANT | Salão Beleza Africana *(fictional)* | — | APPROVED | Illustrative |
| `biz-forca` | MERCHANT | Ginásio Força Total *(fictional)* | — | APPROVED | Illustrative |
| `biz-cinema` | MERCHANT | Cinema Baía Lazer *(fictional)* | — | APPROVED | Illustrative |
| `biz-ilhasabor` | MERCHANT | Restaurante Ilha Sabor *(fictional)* | — | APPROVED | Illustrative |
| `biz-pending` | MERCHANT | Pastelaria Nova Aurora *(fictional)* | — | PENDING_APPROVAL | Illustrative (tests S17) |

Bank and wallet business accounts are demo accounts only: in production each real bank or wallet provider creates and owns its own account.

### SD-5 Premises

| id | Name | Category | Address | City | Lat | Lng | Owner |
|---|---|---|---|---|---|---|---|
| `pr-polana-spa` | Hotel Polana Serena – Spa | Spa & Wellness | Av. Julius Nyerere 1380 | Maputo | -25.9707 | 32.6031 | `biz-absa` (third-party premise) |
| `pr-marisco` | Restaurante Marisco da Baía *(fictional)* | Restaurant | Av. Marginal | Maputo | -25.9480 | 32.6130 | `biz-marisco` |
| `pr-sol-sommerschield` | Supermercado Sol Nascente – Sommerschield *(fictional)* | Supermarket | Sommerschield | Maputo | -25.9560 | 32.5960 | `biz-solnascente` |
| `pr-sol-matola` | Supermercado Sol Nascente – Matola *(fictional)* | Supermarket | Av. de Moçambique | Matola | -25.9620 | 32.4590 | `biz-solnascente` |
| `pr-posto-avenida` | Posto Avenida *(fictional)* | Fuel Station | Av. Eduardo Mondlane | Maputo | -25.9660 | 32.5830 | `biz-bci` |
| `pr-beleza` | Salão Beleza Africana *(fictional)* | Hair & Beauty Salon | Av. 24 de Julho | Maputo | -25.9690 | 32.5850 | `biz-beleza` |
| `pr-cafejardim` | Café Jardim *(fictional)* | Café & Bakery | near Jardim dos Professores | Maputo | -25.9655 | 32.6010 | `biz-cafejardim` |
| `pr-forca` | Ginásio Força Total *(fictional)* | Gym & Fitness | Bairro da Coop | Maputo | -25.9570 | 32.5880 | `biz-forca` |
| `pr-cinema` | Cinema Baía Lazer *(fictional)* | Entertainment & Cinema | Av. Marginal | Maputo | -25.9470 | 32.6150 | `biz-cinema` |
| `pr-tecnomoz` | TecnoMoz Informática *(fictional)* | Electronics | Av. Vladimir Lenine | Maputo | -25.9600 | 32.5850 | `biz-bci` |
| `pr-sorriso` | Clínica Sorriso *(fictional)* | Health & Clinic | Polana Cimento | Maputo | -25.9640 | 32.5960 | `biz-moza` |
| `pr-savana` | Savana Rent-a-Car *(fictional)* | Car Rental | near Maputo International Airport | Maputo | -25.9180 | 32.5730 | `biz-mpesa` |
| `pr-areia-branca` | Resort Areia Branca *(fictional)* | Hotel & Resort | Beach front | Vilankulo | -21.9960 | 35.3170 | `biz-absa` |
| `pr-bela-vista` | Pizzaria Bela Vista *(fictional)* | Restaurant | Centro | Beira | -19.8350 | 34.8450 | `biz-mpesa` |
| `pr-ilhasabor` | Restaurante Ilha Sabor *(fictional)* | Restaurant | Centro | Nampula | -15.1160 | 39.2660 | `biz-ilhasabor` |
| `pr-farmac-tbc` | Farmácias de Moçambique (FARMAC) | Pharmacy | Branch addresses to confirm | Maputo | — | — | `biz-moza` |

All coordinates `approx: true`. `pr-farmac-tbc` has no coordinates: it appears in lists but never triggers alerts until real branch locations are added (tests the "premise without location" path). Alert radius is the default 150 m unless the discount needs otherwise.

### SD-6 Discounts

```yaml
# Times are Africa/Maputo. Weekdays: MON..SUN. "now" in tests = Wed 2026-11-04 13:00.
- id: d-01
  business: biz-absa
  data_origin: SEED_ILLUSTRATIVE   # Jai's example offer
  title: { pt: "15% no Spa do Polana", en: "15% at the Polana Spa" }
  premises: [pr-polana-spa]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-absa-wealth, benefit: PERCENT, value: 15,
        comment: { pt: "Mostre o cartão na recepção do spa", en: "Show your card at the spa reception" } }
  valid_from: 2026-10-01
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-02
  business: biz-marisco
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Almoço executivo com cartão", en: "Executive lunch with your card" }
  premises: [pr-marisco]
  schedule: { days: [MON, TUE, WED, THU, FRI], from: "12:00", to: "15:00" }
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-bci-gold, benefit: PERCENT, value: 10 }
    - { scope: CARD_PRODUCT, card_product: cp-absa-wealth, benefit: PERCENT, value: 12 }
  valid_from: 2026-09-01
  valid_to: 2027-03-31
  status: PUBLISHED

- id: d-03
  business: biz-marisco
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Pague com M-Pesa ou cartão", en: "Pay with M-Pesa or any card" }
  premises: [pr-marisco]
  eligibility:
    - { scope: WALLET, wallet: wl-mpesa, benefit: PERCENT, value: 5 }
    - { scope: ANY_BANK_CARD, benefit: PERCENT, value: 3 }
  valid_from: 2026-09-01
  valid_to: null
  status: PUBLISHED

- id: d-04
  business: biz-solnascente
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "7% nas compras Prestige", en: "7% off for Prestige clients" }
  premises: [pr-sol-sommerschield, pr-sol-matola]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-mbim-prestige, benefit: PERCENT, value: 7,
        min_spend_mzn: 2000, max_discount_mzn: 1500 }
  valid_from: 2026-10-15
  valid_to: 2027-01-15
  status: PUBLISHED

- id: d-05
  business: biz-solnascente
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "5% com Letshego Mastercard", en: "5% with Letshego Mastercard" }
  premises: [pr-sol-sommerschield, pr-sol-matola]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-letshego-debit, benefit: PERCENT, value: 5 }
  valid_from: 2026-10-20
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-06
  business: biz-bci
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "3% de cashback em combustível", en: "3% fuel cashback" }
  premises: [pr-posto-avenida]
  eligibility:
    - { scope: ISSUER_ANY, issuer: iss-bci, card_type: CREDIT, benefit: CASHBACK, value: 3 }
  valid_from: 2026-10-01
  valid_to: 2026-11-30
  status: PUBLISHED

- id: d-07
  business: biz-beleza
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Terças de beleza com e-Mola", en: "Beauty Tuesdays with e-Mola" }
  premises: [pr-beleza]
  schedule: { days: [TUE] }
  eligibility:
    - { scope: WALLET, wallet: wl-emola, benefit: PERCENT, value: 20 }
  valid_from: 2026-10-01
  valid_to: 2027-06-30
  status: PUBLISHED

- id: d-08
  business: biz-cafejardim
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Pequeno-almoço Nedbank", en: "Nedbank breakfast" }
  premises: [pr-cafejardim]
  schedule: { days: [MON, TUE, WED, THU, FRI, SAT, SUN], from: "06:00", to: "10:00" }
  eligibility:
    - { scope: ISSUER_ANY, issuer: iss-ned, benefit: PERCENT, value: 10 }
  valid_from: 2026-10-01
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-09
  business: biz-forca
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Primeiro mês grátis", en: "First month free" }
  premises: [pr-forca]
  eligibility:
    - { scope: GENERAL, benefit: FREE_ITEM, value_text: { pt: "1.º mês de mensalidade", en: "1st month's fee" } }
  valid_from: 2026-10-01
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-10
  business: biz-cinema
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Quartas 2 por 1 com carteira móvel", en: "2-for-1 Wednesdays with any wallet" }
  premises: [pr-cinema]
  schedule: { days: [WED] }
  eligibility:
    - { scope: ANY_WALLET, benefit: BOGO }
  valid_from: 2026-10-01
  valid_to: 2027-03-31
  status: PUBLISHED

- id: d-11
  business: biz-bci
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "10% em informática com BCI BIO", en: "10% on computers with BCI BIO" }
  premises: [pr-tecnomoz]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-bci-bio, benefit: PERCENT, value: 10 }
  valid_from: 2026-10-01
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-12
  business: biz-moza
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "10% em consultas dentárias", en: "10% on dental check-ups" }
  premises: [pr-sorriso]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-moza-credit, benefit: PERCENT, value: 10 }
  valid_from: 2026-10-01
  valid_to: 2027-03-31
  status: PUBLISHED

- id: d-13
  business: biz-mpesa
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "15% no aluguer de viaturas", en: "15% on car rental" }
  premises: [pr-savana]
  eligibility:
    - { scope: WALLET, wallet: wl-mpesa, benefit: PERCENT, value: 15 }
  valid_from: 2026-10-01
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-14
  business: biz-absa
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "12% em Vilankulo", en: "12% in Vilankulo" }
  premises: [pr-areia-branca]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-absa-premier, benefit: PERCENT, value: 12 }
    - { scope: CARD_PRODUCT, card_product: cp-absa-wealth, benefit: PERCENT, value: 15 }
  valid_from: 2026-11-01
  valid_to: 2027-04-30
  status: PUBLISHED

- id: d-15
  business: biz-mpesa
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "10% na Bela Vista com M-Pesa", en: "10% at Bela Vista with M-Pesa" }
  premises: [pr-bela-vista]
  eligibility:
    - { scope: WALLET, wallet: wl-mpesa, benefit: PERCENT, value: 10 }
  valid_from: 2026-10-01
  valid_to: 2027-01-31
  status: PUBLISHED

- id: d-16                          # EXPIRED: tests S10
  business: biz-ilhasabor
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "10% com Ecobank", en: "10% with Ecobank" }
  premises: [pr-ilhasabor]
  eligibility:
    - { scope: ISSUER_ANY, issuer: iss-eco, benefit: PERCENT, value: 10 }
  valid_from: 2026-06-01
  valid_to: 2026-09-30
  status: EXPIRED

- id: d-17                          # FUTURE: tests S11
  business: biz-cafejardim
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Natal: 500 MT de desconto", en: "Christmas: 500 MT off" }
  premises: [pr-cafejardim]
  eligibility:
    - { scope: GENERAL, benefit: FIXED, value_mzn: 500, min_spend_mzn: 3000 }
  valid_from: 2026-12-15
  valid_to: 2026-12-31
  status: PUBLISHED

- id: d-18                          # DRAFT: never visible to users
  business: biz-marisco
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "Jantar romântico com Standard Bank", en: "Romantic dinner with Standard Bank" }
  premises: [pr-marisco]
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-sbm-prestige, benefit: PERCENT, value: 20 }
  valid_from: 2026-11-01
  valid_to: 2027-02-14
  status: DRAFT

- id: d-19                          # Draft by the pending business: tests S17
  business: biz-pending
  data_origin: SEED_ILLUSTRATIVE
  title: { pt: "5% com e-Mola", en: "5% with e-Mola" }
  premises: []
  eligibility:
    - { scope: WALLET, wallet: wl-emola, benefit: PERCENT, value: 5 }
  valid_from: 2026-11-01
  valid_to: 2026-12-31
  status: DRAFT

# ---- From public sources (SD-7). Verified as published; reconfirm before go-live ----
- id: d-20
  business: biz-moza
  data_origin: SEED_VERIFIED
  source: SRC-1
  title: { pt: "5% nas Farmácias de Moçambique", en: "5% at Farmácias de Moçambique" }
  premises: [pr-farmac-tbc]
  eligibility:
    - { scope: ISSUER_ANY, issuer: iss-moza, benefit: PERCENT, value: 5,
        comment: { pt: "Condições a confirmar com o Moza Banco", en: "Terms to be confirmed with Moza Banco" } }
  valid_from: 2026-07-09        # agreement signing date; the start date was not published
  valid_to: null
  status: PUBLISHED

- id: d-21
  business: biz-mbim
  data_origin: SEED_VERIFIED
  source: SRC-2                 # 2021 list: kept as DRAFT until Millennium bim reconfirms
  title: { pt: "MLÍDER: 5% em viagens Cotur", en: "MLÍDER: 5% on Cotur travel" }
  premises: []                  # Cotur address to be confirmed
  is_online: false
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-mbim-mlider, benefit: PERCENT, value: 5,
        comment: { pt: "5% na tarifa base aérea e em alojamento ou pacotes", en: "5% on base air fare and on accommodation or packages" } }
  status: DRAFT

- id: d-22
  business: biz-mbim
  data_origin: SEED_VERIFIED
  source: SRC-2
  title: { pt: "MLÍDER: 10% nas mensalidades Vodacom", en: "MLÍDER: 10% on Vodacom monthly fees" }
  premises: []
  is_online: true               # tests S12: listed, never triggers an alert
  eligibility:
    - { scope: CARD_PRODUCT, card_product: cp-mbim-mlider, benefit: PERCENT, value: 10,
        comment: { pt: "Internet fixa e móvel, ofertas integradas e IoT", en: "Fixed and mobile internet, bundled and IoT plans" } }
  status: PUBLISHED             # published in the demo only so S12 can run; reconfirm before go-live
```

### SD-7 Public sources consulted (23 Oct 2026)

| Ref | What it supports | Source |
|---|---|---|
| SRC-1 | Moza Banco customers get 5 % at Farmácias de Moçambique (FARMAC); agreement signed 9 Jul 2026 in Maputo. No card, start date or branch list published. | [Diário Económico, 9 Jul 2026](https://www.diarioeconomico.co.mz/2026/07/09/economia/banca/clientes-do-moza-banco-passam-a-beneficiar-de-desconto-de-5-nas-farmacias-de-mocambique/) · [360 Mozambique](https://360mozambique.com/economy/banking/moza-banco-customers-now-enjoy-a-5-discount-at-pharmacies-in-mozambique/) |
| SRC-2 | Millennium bim MLÍDER partner discounts for companies (Cotur 5 %, Vodacom 10 %, TATA Motors 5 % vehicles / 10 % parts, and others). Dated 2021. | [Millennium bim, Parceiros MLÍDER 2021 (PDF)](https://millenniumbim.co.mz/media/4308/parceiros_mlider_2021.pdf) |
| SRC-3 | BCI BIO biodegradable Visa debit card; 0.04 % of POS purchases to BIOFUND; partner categories mentioned without percentages. | [BCI, Vantagens e Funcionalidades Cartão BIO (PDF)](https://www.bci.co.mz/wp-content/uploads/2022/08/Vantagens-e-Funcionalidades_-Cartao-BIO.pdf) |
| SRC-4 | Letshego and Mastercard launched a debit card in Mozambique (May 2026). | [Diário Económico, 18 May 2026](https://www.diarioeconomico.co.mz/2026/05/18/economia/banca/mastercard-e-letshego-lancam-cartao-de-debito-para-reforco-da-inclusao-financeira/) |
| SRC-5 | M-Pesa, e-Mola and mKesh are interoperable. | [Banco de Moçambique](https://bancomoc.mz/en/media/highlights/interoperability-between-the-three-mobile-wallets-m-pesa-mkesh-and-e-mola/) |
| SRC-6 | Commercial bank list; Banco Único became Nedbank Moçambique; Société Générale Moçambique joined Vista Bank Group. | [Wikipedia, List of banks in Mozambique](https://en.wikipedia.org/wiki/List_of_banks_in_Mozambique) (based on Banco de Moçambique register) |
| SRC-7 | Millennium bim Prestige segment exists. | [Millennium bim Prestige press release (PDF)](https://www.millenniumbim.co.mz/media/2812/comunicadombim-prestige.pdf) |

### SD-8 Demo accounts (non-production only)

All emails use the reserved `.test` domain so no real person can receive them. The shared password comes from the env var `SEED_DEMO_PASSWORD` and is never committed.

| Persona | Email | Role | Cards / wallets | Preferences | Used in |
|---|---|---|---|---|---|
| Admin | `admin@mozdiscounts.test` | ADMIN | — | 2FA on | J6 |
| Absa owner | `absa.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-absa` | — | — | J2, S18 |
| BCI owner | `bci.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-bci` | — | — | |
| M-Pesa owner | `mpesa.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-mpesa` | — | — | |
| Marisco owner | `marisco.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-marisco` | — | — | J1, J5 |
| Marisco staff | `marisco.staff@mozdiscounts.test` | BUSINESS_STAFF `biz-marisco` | — | — | permissions |
| Café owner | `cafe.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-cafejardim` | — | — | S09 |
| Pending owner | `pending.owner@mozdiscounts.test` | BUSINESS_OWNER `biz-pending` | — | — | S17 |
| Ana Machava | `ana@mozdiscounts.test` | USER | `cp-absa-wealth` | PERSONALISED, Face ID on | J3, J4, S01, S02, S07, S14, S22 |
| Bruno Sitoe | `bruno@mozdiscounts.test` | USER | `cp-bci-gold`, `wl-mpesa` | PERSONALISED; favourite `d-02` | J5, S03, S04, S21 |
| Carla Nhantumbo | `carla@mozdiscounts.test` | USER | none (skipped) | ALL | S05, S12 |
| Dércio Mondlane | `dercio@mozdiscounts.test` | USER | `wl-emola` | PERSONALISED | S06 |
| Elisa Cossa | `elisa@mozdiscounts.test` | USER | `cp-ned-debit` | quiet hours 22:00–07:00; favourite `d-08` | S08, S09 |
| Fábio Tembe | `fabio@mozdiscounts.test` | USER | `cp-bci-bio` | location "While Using" only | S13 |
| Gina Macuácua | `gina@mozdiscounts.test` | USER | `cp-mbim-prestige`, `wl-mpesa`, `wl-mkesh` | ALL, daily cap 3 | S20 |
| Hugo Matsinhe | `hugo@mozdiscounts.test` | USER | `cp-moza-debit` | — | S15 |
| Inês Chissano | `ines@mozdiscounts.test` | USER (unverified) | — | — | S16 |

Persona names are invented. Any match with a real person is coincidental.

</Seed-Data>


<Hosting-And-DevOps>

> **Production target.** For the current POC build, host as described in `<POC-Profile>` (Vercel, Neon, Resend). Use this section only when moving to production.

**[ASSUMPTION]** AWS **af-south-1 (Cape Town)**, the closest major cloud region to Mozambique for latency. A lower-cost alternative for the MVP is Render/Fly.io/Railway with managed Postgres + PostGIS; decide in Phase 0.

| Component | AWS service |
|---|---|
| API and web | ECS Fargate (Docker containers) behind an Application Load Balancer, or App Runner |
| Database | RDS PostgreSQL 16 with PostGIS, Multi-AZ in production |
| Redis | ElastiCache |
| Files | S3 + CloudFront |
| Email | SES (production access requested early) |
| DNS / WAF / CDN | Cloudflare in front (WAF rules, Turnstile, DDoS) or AWS WAF |
| Secrets | AWS Secrets Manager |
| IaC | Terraform (or AWS CDK) in `infra/` |
| Monitoring | CloudWatch + Sentry + uptime monitor; alerts to email/Slack |

- Environments: `local` (Docker Compose: Postgres/PostGIS, Redis, Mailpit, MinIO), `dev`, `staging`, `production`. Production deploys need manual approval.
- CI/CD with GitHub Actions: lint → type-check → unit → integration → build → security scans → E2E → deploy to staging on merge to `main` → manual promote to production. Database migrations run as a separate, reversible step.
- iOS pipeline: build and test on a macOS runner (GitHub Actions macOS or Xcode Cloud), fastlane for signing (match) and upload to **TestFlight**; App Store submission with privacy labels, location usage strings (`NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`), background mode "Location updates" only if needed, and review notes explaining the proximity feature.
- Google Maps Platform: separate restricted API keys for web (HTTP referrer restricted) and iOS (bundle ID restricted); budget alerts set.
- **Note:** iOS development, simulator testing and signing require a Mac with Xcode 16+ and an Apple Developer Program account. Run Claude Code in VS Code on that Mac for `apps/ios`.

</Hosting-And-DevOps>

<Execution-Plan>

Work phase by phase. At the start of each phase use **plan mode**, write the plan to `docs/plans/phase-N.md`, then implement. Finish each phase with all its tests green, the traceability matrix updated, and a short demo note. Keep PRs small (one feature per PR, titled with requirement IDs).

| Phase | Deliverables | Requirements |
|---|---|---|
| 0. Foundation | Confirm assumptions with Jai; create `docs/decisions-log.md`; monorepo scaffold; `CLAUDE.md` with conventions and commands; Docker Compose; CI skeleton; design tokens; install and run ui-ux-pro-max skill; logo v1; ADRs for stack, maps SDK and hosting | UX-1, UX-2, UX-4, NFR-8 |
| 1. Identity | Seed package with `seed:demo` (catalogue, businesses, demo accounts), Clock service; registration, email verification, login, lockout, rate limits, Turnstile, password policy, sessions/JWT, forgot/reset, MFA, profile/settings, devices, audit logging framework | BR-1, BR-2, BR-4, BR-5, BR-3 (framework), IOS-2 (API) |
| 2. Catalogue & businesses | Admin catalogue CRUD, business profiles, approval workflow, team invites, SaaS portal shell | BR-2.1, BR-2.2, BR-6, BR-12 (moderation), UX-3 |
| 3. Premises & discounts | Seed premises and discounts SD-5/SD-6, matching test vectors (TD-6); premise CRUD with Google Maps picker, CSV import, discount CRUD with eligibility rows and schedules, lifecycle jobs, preview | BR-7, BR-8, BR-9 |
| 4. Public map & discovery API | Public web map with logo filters, nearby/bbox/recent APIs, geofence sync endpoint | BR-11 |
| 5. Audit, logs & analytics | Audit UI + Excel export, alert-event ingestion + export, admin and business dashboards, discount reports | BR-3, BR-10, BR-12 |
| 6. iOS foundation | Project, design system in SwiftUI, API client, registration, verification universal link, login, Face ID, profile | IOS-1 to IOS-4 |
| 7. iOS cards, map & favourites | Onboarding with skippable card/wallet capture, My cards & wallets, alert preferences, home map with filters, recent offers carousel, favourites | IOS-5, IOS-6, IOS-7 |
| 8. Alerts & push | Region monitoring engine, local notifications, event reporting with offline queue, APNs favourite-update pushes, broadcasts | IOS-8, IOS-7, BR-10 |
| 9. Hardening | Run all TD-5 scenarios on device and simulator, `load` profile k6 runs; security scans and fixes, performance tests, accessibility, localisation review, pen-test checklist, UAT | NFR-1 to NFR-7 |
| 10. Hosting & release | Terraform infra, staging and production, monitoring, backups, TestFlight beta, App Store submission, runbook | Hosting section |

Working rules for Claude Code:

1. Before any code, restate the phase scope and list open questions; ask Jai only about decisions that change scope, and otherwise proceed with the assumptions here.
2. Write or update tests in the same change as the feature. Never disable, skip or delete a failing test to get green.
3. Never commit secrets; use `.env.example` with placeholders.
4. Run lint, type-check and tests locally before each commit; show the results.
5. Update `docs/traceability.md`, the OpenAPI spec and `CHANGELOG.md` in each PR.
6. Keep `CLAUDE.md` current with how to run, test and deploy each app.

</Execution-Plan>

<Quality-Gates>

A feature is **done** only when:

- [ ] All acceptance criteria for its requirement IDs pass as automated tests.
- [ ] Authorisation tests prove other tenants cannot read or change the data.
- [ ] Every state change writes an audit row.
- [ ] UI reviewed with the ui-ux-pro-max skill: spacing grid, typography scale, tokens only (no hard-coded colours), light and dark mode, empty/loading/error states, PT and EN strings, accessibility checks pass.
- [ ] No new High/Critical security findings; no secrets in code.
- [ ] Documentation and traceability matrix updated.

</Quality-Gates>

<Assumptions-To-Confirm>

**Build target: proof of concept (POC).** Jai confirmed on 23 Oct 2026 that the first build is a low-cost POC, not production. The "POC decision" column is the default Claude Code must follow unless Jai changes it. The "Before production" column is for later and must not be built now unless a requirement needs it.

| # | Topic | Spec assumption | POC decision (recommended) | Before production |
|---|---|---|---|---|
| 1 | **BR-12 content** | Dashboards, moderation queue, user reports, broadcasts | Build only admin approval of businesses and one simple stats view (alerts delivered, opened, favourites per discount, for admin and for each business). Leave out reported-offer queue, push broadcasts, heat map and charts library. | Add the full BR-12 set. |
| 2 | **Password rule** | 8 characters + upper + lower + special; number and breached-password check recommended | Minimum 8 characters with uppercase, lowercase, number and special character. Skip the breached-password check and the reuse-of-last-5 rule. | Add the breached-password check (free Have I Been Pwned range API) and password history. |
| 3 | **Card data** | No card number, CVV or expiry; optional last 4 digits | No card number, CVV, expiry or last 4 digits at all. Users pick bank → card type → card product, and pick a wallet provider. | Keep it this way unless a bank partner asks for more, then review privacy first. |
| 4 | **Business approval** | Admin approves businesses; discount moderation optional | Keep business approval (one approve/reject action). Discount moderation off. | Turn on discount moderation if fake or wrong offers appear. |
| 5 | **Staff role and business audit view** | `BUSINESS_STAFF` role; owners see their own audit trail | One owner per business, no staff role. Audit trail visible to admin only, with Excel export. | Add staff invites and the business audit view. |
| 6 | **Languages** | Portuguese default plus English | Keep both. Put all strings in translation files from day one; Portuguese default. Cost is only translation effort. | Have a native speaker review the Portuguese copy. |
| 7 | **Stack** | NestJS API + Next.js web + PostgreSQL/PostGIS + Redis; SwiftUI iOS 17+ | **One Next.js app** (web portal, public map and the `/api/v1` REST API as route handlers) + **Neon Postgres with PostGIS** + Prisma. **No Redis and no queue:** rate limits and lockouts are stored in Postgres. Business logic lives in `packages/core` (framework-free TypeScript) so it can move to a separate API later. SwiftUI iOS 17+ unchanged. | Split the API out (NestJS or similar) and add Redis/queues only if load or job volume needs it. |
| 8 | **Maps** | Google Maps on web; Google Maps SDK or MapKit on iOS | **Web:** Google Maps JavaScript API (Jai asked for Google Maps), kept inside the monthly free usage with a daily quota cap and a billing alert. **iOS:** Apple **MapKit** (free, no API key, native). Address search on web via Places Autocomplete within free usage. | Re-check Google usage and cost; consider Google Maps SDK on iOS only if design parity is needed. |
| 9 | **Hosting and domain** | AWS Cape Town; custom domains | **Vercel** (Hobby, free) for the Next.js app, **Neon** (free) for the database, **Vercel Blob** for logos and photos, default `*.vercel.app` address, no custom domain. Keep the GitHub repo under a personal account (Vercel Hobby cannot connect repos owned by GitHub organisations). Note: Vercel's Hobby plan is for personal, non-commercial use; move to Vercel Pro (about US$20/month) as soon as the POC is shown to banks or merchants as a commercial product. | Move to AWS af-south-1 (Cape Town) or stay on Vercel Pro + Neon paid plan, decided by load, latency to Mozambique and data-residency needs. Buy `mozdiscounts.co.mz`. |
| 10 | **Email and bot protection** | SES or Postmark; Cloudflare Turnstile | **Resend** free plan (100 emails/day, 3 000/month: enough for a POC) for verification and reset emails; **Mailpit** locally. **Cloudflare Turnstile** (free) after 3 failed logins. | Verify a custom sending domain with SPF/DKIM/DMARC; pick SES or a paid plan by volume. |
| 11 | **Alert behaviour** | 150 m radius, 12 h cooldown, daily cap 5, quiet hours, "Always" location | Keep the defaults and the "Always" location request (needed for walk-by alerts). Add an admin "demo mode" setting that shortens cooldown to 5 minutes so demos can be repeated. | Tune radius and cooldown from real alert-open data. |
| 12 | **Privacy and legal** | Coarse location on the server; legal review under Mozambican law | Keep coarse location only on the server. Use only demo accounts and invited testers; show a short POC privacy notice in the app and portal. No formal legal review for the POC. | Full legal review (Lei n.º 3/2017 and any newer data-protection law), privacy policy, terms of use. |
| 13 | **Seed data** | Names and coordinates to verify | Use `<Seed-Data>` as is. Run `seed:geocode` once (within Google's free geocoding usage) to refine coordinates. | Replace with real offers entered by each bank, wallet provider and merchant. |
| 14 | **ui-ux-pro-max-skill** | Third-party skill, review before install | Review the skill's files, then install it (free) and use it on every screen as UX-1 requires. | Same. |
| 15 | **Android** | Out of scope for v1 | Out of scope. | Plan an Android app on the same API. |
| 16 | **Illustrative demo offers** | Most seed offers and *(fictional)* merchants are invented | Keep them, with the "Dados de demonstração / Demo data" ribbon on web and iOS. | Remove all `SEED_ILLUSTRATIVE` and `SYNTHETIC` data; production accepts only `REAL`. |
| 17 | **Opening hours** | Shown, do not block alerts | Same. Opening hours are optional free text in the POC. | Structured opening hours if users ask for "open now" filters. |
| 18 | **BR-R6 defaults** | Radius, cooldown, cap, nearby radius, recent window | Keep the defaults, editable by admin in one settings screen. | Same. |
| 19 | **Two-factor authentication** | TOTP, mandatory for admin | TOTP for admin only. Business and app users without 2FA. | Offer TOTP to business users. |
| 20 | **Apple Developer Program** | Implied by TestFlight and push | Join the Apple Developer Program (US$99/year): it is required for TestFlight, for push notifications (IOS-7 favourite updates) and for "Always" location testing on testers' phones. Until then, run on Jai's own iPhone with free provisioning: proximity alerts are local notifications and work, server push does not. | Same account; App Store submission. |
| 21 | **Testing scope** | Full pyramid incl. k6 load, ZAP, MobSF | Unit tests, API integration tests against a real Postgres/PostGIS (Docker locally or a Neon branch in CI), Playwright for journeys J1, J2 and J6, XCTest/XCUITest for J3–J5 with GPX routes, scenarios S01–S22, SQL-injection and lockout tests. Use the `small` seed profile only. Skip k6, ZAP and MobSF. | Add the `medium`/`load` profiles, k6, OWASP ZAP, MobSF and an external penetration test. |
| 22 | **CI/CD and monitoring** | GitHub Actions full pipeline, Sentry, uptime checks | GitHub Actions for lint, type-check and tests of the web/API (free minutes); Vercel preview deployment per pull request. Build and test the iOS app locally on the Mac (macOS CI minutes cost more). Sentry free plan for crash and error reports; Vercel logs. | iOS CI (Xcode Cloud or macOS runners), uptime monitoring, alerting. |
| 23 | **Backups and availability** | NFR-4: 99.5 %, PITR, RPO 15 min | No availability target. Rely on Neon's built-in restore window on the free plan and keep `seed:demo` able to rebuild the demo database at any time. | Apply NFR-4 in full. |
| 24 | **Performance and scale** | NFR-3 and NFR-5 targets for 100 000 users | Aim for the NFR-3 response times with the `small` dataset only; no scale testing. Expect a slow first request after the database scales to zero on the free plan. | Apply NFR-3 and NFR-5 in full. |

**Expected POC running cost:** US$0/month on free plans (Vercel Hobby, Neon Free, Resend Free, Turnstile, Sentry free plan, Google Maps within free usage with caps), plus US$99/year for the Apple Developer Program. Budget about US$20/month for Vercel Pro once the POC is shown commercially. Free-plan limits change often: Claude Code must check each provider's current pricing page in Phase 0 and record the limits and the date checked in `docs/adr/0002-poc-hosting.md`.

</Assumptions-To-Confirm>

<Out-Of-Scope-v1>

- Android app (planned for v2; API is client-agnostic).
- Processing payments, storing card numbers, or verifying that a user really holds a card.
- In-app redemption tracking with merchant POS integration (v2 idea: QR code redemption).
- Paid subscriptions or billing for businesses (v2: business plans and featured listings).

</Out-Of-Scope-v1>

<Deliverables>

1. Monorepo with `apps/api`, `apps/web`, `apps/ios`, `packages/shared`, `packages/ui`, `infra/`, `docs/`.
2. `docs/`: decisions log, phase reports, architecture overview, ER diagram, OpenAPI spec, ADRs, phase plans, traceability matrix, UAT checklist, runbook, privacy policy draft.
3. Seeded staging environment (`seed:demo` + `seed:synthetic --profile=medium`) with the demo accounts in SD-8, GPX routes, APNs payloads and shared matching test vectors.
4. Public web map, business/admin portal and API in production.
5. iOS app on TestFlight, then submitted to the App Store.
6. Brand assets: logo SVG/PNG, app icon set, design tokens.

</Deliverables>

<Final-Instruction>

Start now with **Phase 0** of the **POC**: read `<Instructions-For-Claude-Code>`, `<Glossary>`, `<Constraints>` and `<POC-Profile>` first, then summarise your understanding in 10 bullets, flag any POC decision you believe will not work (with a reason and an alternative), propose the repository structure and `CLAUDE.md`, and follow the POC decisions in `<Assumptions-To-Confirm>` without asking again unless one turns out to be impossible. Then build Moz Discounts phase by phase until every requirement ID is implemented, tested, hosted and traceable.

</Final-Instruction>
