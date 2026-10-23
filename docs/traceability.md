# Traceability (requirement -> tests -> status)

Test files: `C` = packages/core/test/auth.integration.test.ts, `U` = packages/core/src/lockout.test.ts, `S` = packages/shared/src/password.test.ts, `W` = apps/web/test/api.test.ts.

| ID | Tests | Status |
|---|---|---|
| BR-1 | C "BR-1 SQL injection and storage", "BR-1 brute force protection", "sessions"; W login cookie, 429, injection | Done (Turnstile verified only by stub; needs real key) |
| BR-2 (all roles: profile, password, email change, devices, sessions, 2FA, delete) | C "forgot / reset", "2FA", W /me; email-change and delete have no dedicated test yet | Partial: user-management screens, admin CRUD, avatar come in Phases 2/6 |
| BR-3 framework | C "BR-3 audit framework", U redaction | Framework done; UI + Excel export in Phase 5 |
| BR-4 | C "BR-4 registration and verification" | Done (business approval in Phase 2) |
| BR-5 | S (8 cases), C "BR-5 password policy enforced by the API" | Done (POC rules, DEC-007) |
| IOS-2 (API) | C "IOS-2 and iOS tokens" | Done |
| NFR-8 | CI, ESLint rules (verified firing), typecheck | Done |
| UX-1/2/4 | tokens.css, logo.svg | Logo/tokens only; skill applied from Phase 2 UI |
| Others | | Not started |
