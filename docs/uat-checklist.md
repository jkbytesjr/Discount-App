# UAT checklist (POC)

Run `pnpm dev`, `pnpm --filter @moz/seed seed:demo`, set `SKIP_EMAIL_VERIFICATION=1`. Demo logins: see `docs/runbook.md`. "Now" for simulated scenarios is Wed 2026-11-04 13:00 Maputo (`X-Test-Now` header on the API, or admin demo mode).

| ID | Check | How it is verified today |
|---|---|---|
| S01-S05 | Proximity alert copy and ranking | `swift test` AlertEngineTests; core vectors |
| S06 | Non-matching user: no alert, `SUPPRESSED / NO_MATCH` | AlertEngineTests |
| S07 | Cooldown | AlertEngineTests |
| S08 | Quiet hours across midnight | AlertEngineTests |
| S09 | Favourite edit pushes within 60 s | core `phase5.integration` (immediate push); APNs needs a real device |
| S10, S11, S12 | Expired / future / online offers | core `discovery.integration` |
| S13 | "While Using" only: no background alert, banner explains | Manual on device (banner is in the app) |
| S14 | Offline OPENED event queued and sent later | `swift test` EventQueue; manual airplane-mode check |
| S15, S16 | Lockout, unverified login | core `auth.integration` |
| S17, S18 | Pending business cannot publish; cross-tenant is 404 + audit | core/web `discounts` tests |
| S19, S21 | Map chips | core `discovery.integration`, Playwright `map.spec` |
| S20 | Daily cap, favourites skip it | AlertEngineTests |
| S22 | Region rotation along a route | `swift test` RegionPlanner; manual walk with a GPX file in the simulator |

Journeys: J1 merchant register -> approve -> publish (Playwright portal + discounts specs); J2 owner premises/discounts (Playwright); J6 admin audit/export (Playwright phase5). J3 (first run, sign-in, map filter), J4 (wrong password) and J5 (add a card, favourites) are automated by `apps/ios/UITests` (4 tests, passing on the iPhone 17 simulator). Real-device checks (S13, S22, Face ID, push) remain manual.
