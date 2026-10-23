# Phase 2 report: Catalogue, businesses, portal shell

## Built
- **Policy module** (`packages/core/src/policy.ts`): the permissions matrix with POC overrides (no staff column; audit view admin-only). One test per cell (72 cells + a coverage check).
- **Catalogue** (BR-2.1): admin create/update/deactivate for issuers, card networks, card products, wallet providers, premise categories; public cacheable read of active rows; every change audited with before/after; nothing is hard-deleted (BR-R9).
- **Businesses** (BR-2.2, BR-6, BR-12 approval): bank / wallet provider / merchant profiles with link rules, one business per owner, submit for approval, admin approve / reject (reason emailed, HTML-escaped) / suspend / reinstate, links locked after submission. Cross-tenant access returns 404 and writes a `permission.denied` audit row.
- **Admin user management** (BR-2.1): list/search/filter/view, create, edit, role change (revokes sessions), suspend/reactivate, force password reset, delete and anonymise; protection against self-actions and removing the last admin.
- **API**: 41 route files under `/api/v1` (catalogue x5 collections and items, businesses, admin businesses, admin users, plus Phase 1 auth/me).
- **Portal UI** (UX-3), PT + EN, light + dark: landing, login (with 2FA code and bot-challenge states), register (live password checklist), check-email, verify-email, forgot/reset password, SaaS shell (collapsible sidebar, top bar with search, notifications, language, avatar menu), dashboard, admin users, admin businesses queue, catalogue manager, business profile editor, account settings (profile, password, email change, TOTP setup with QR, devices, log out everywhere, delete account). Loading skeletons, empty states, error summaries linked to fields, toasts, native dialogs/drawers.
- **Security**: nonce-based page CSP in `proxy.ts` (DEC-017).

## Verified (commands run)
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: **152 passed** (shared 11, core 126, web 15), run against the Neon **test branch**.
- `pnpm build`: OK.
- `playwright test` (production build, real Chromium): **6 passed**: merchant registers -> verifies email -> signs in -> creates profile -> hits the incomplete-profile error summary -> submits; admin signs in with TOTP -> approves from the queue -> owner sees "Approved"; axe WCAG 2.0/2.1/2.2 A+AA with no serious/critical findings on 10 distinct screens (plus the approval drawer), light and dark where scanned (contrast included); no horizontal scroll at 375 px; wrong-password error is focused and readable.
- CSP: all 11 scripts on /login carry the nonce.
- ui-ux-pro-max skill run for design-system, form, table and focus guidance. Its generated palette (blue, glassmorphism) conflicts with UX-2, so the spec palette was kept; its checklist (labels, error summary, 44 px targets, SVG icons, reduced motion, tables scroll on phones) was applied.

## Bugs found by the tests and fixed
- Native `<dialog>` programmatic close fired `onClose`, clearing a selection mid-action (approve flow).
- `rejectBusiness`/`suspendBusiness` threw validation errors synchronously instead of rejecting.
- Axe: language button and avatar accessible names did not match visible text.

## Not verified / left
- I looked at pages through automated checks only (axe, DOM assertions, curl); no human visual review or screenshots yet. Please open http://localhost:3000 and review the look.
- Turnstile widget needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; real emails need `RESEND_API_KEY`.
- Logo upload (DEC-025), team invites (POC), reported-offer queue and charts (POC), logo PNG/app-icon exports.
- The CI Playwright job and the second Neon branch (GitHub secrets) are written but not yet run on GitHub.
- No card/wallet models for app users yet (Phase 7).

## Environment finding (needs your decision)
The repo is inside an iCloud-synced folder and iCloud is creating " 2" conflict copies (DEC-016). Recommend moving it to e.g. `~/Developer/moz-discounts`.
