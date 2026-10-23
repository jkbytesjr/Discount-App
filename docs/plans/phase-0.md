# Phase 0 plan: Foundation (POC)

Requirements: UX-1, UX-2, UX-4, NFR-8.

Scope
1. docs: decisions log, ADR 0001 stack, 0002 POC hosting, 0003 maps, phase report, traceability.
2. pnpm monorepo: apps/web, apps/ios (placeholder), packages/core, shared, seed.
3. `Clock` service in packages/core (TD-2) with a test; lint rule banning `Date.now()` deferred to Phase 1 ESLint setup.
4. Design tokens (UX-2) as CSS variables in packages/shared, light + dark.
5. Logo v1 SVG (UX-4).
6. Docker Compose (Postgres+PostGIS, Mailpit), `.env.example`, GitHub Actions CI skeleton.
7. CLAUDE.md for this project.
8. ui-ux-pro-max skill: review before install (UX-1).

Out of scope now: auth, schema, iOS project (needs full Xcode, not installed).
