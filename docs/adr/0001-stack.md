# ADR 0001: Stack (POC)

Status: accepted, 2026-10-23. Follows `<POC-Profile>`.

Single Next.js app (App Router, `/api/v1` route handlers), Prisma + Neon Postgres/PostGIS, business logic in framework-free `packages/core`, zod validation, Argon2id, SwiftUI iOS 17+.

Versions checked on npm 2026-10-23 (latest stable; pinned by lockfile): next 16.4.3, react 19.3.1, typescript 7.0.2, prisma **7.10.1** (8.0.0-rc is a release candidate, not used), @prisma/adapter-pg 7.10.1, pg 8.23.1, jose 6.2.13, otplib 13.5.0, zod 4.6.7, vitest 5.0.5, argon2 0.45.1, eslint 10.13.0.

Consequences: no Redis/queue (rate limits in Postgres); upgrade path via `Clock`, `BlobStore`, `Mailer`, `PushSender`, `RateLimiter` interfaces.
