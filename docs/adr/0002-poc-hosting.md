# ADR 0002: POC hosting and free-plan limits

Status: accepted, 2026-10-23. Limits checked on **2026-10-23** from provider pages.

| Provider | Current free-plan limits | Source |
|---|---|---|
| Neon Free | 1 GB storage/project, 100 CU-hours/project, 10 branches, scale-to-zero after 5 min (cannot disable), 6 h restore window, PostGIS included, no card | neon.com/pricing |
| Vercel Hobby | Non-commercial use only; 1M function invocations; 4 CPU-hrs active CPU; 100 GB fast data transfer; 100 deployments/day; function max 300 s; runtime logs 1 h; Blob available | vercel.com/docs/plans/hobby |
| Resend Free | 100 emails/day, 3 000/month, 3 custom domains | resend.com/pricing |

Not verified this phase (check in Phase 1 before use): Vercel Blob free allotment, Vercel Cron frequency on Hobby, Turnstile, Sentry, Google Maps free usage, Apple Developer fee.

Notes: the 1 h runtime-log retention and 5-minute scale-to-zero mean first requests are slow and debugging needs Sentry. Vercel Hobby is non-commercial: upgrade before showing to banks/merchants as a product.
