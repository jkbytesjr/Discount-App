import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Monorepo: load the .env that lives at the repo root.
// A missing file is fine (Vercel injects env vars itself); existing vars are never overridden.
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-Frame-Options", value: "DENY" },
  // API-only CSP for now; the nonce-based page CSP arrives with the portal in Phase 2.
  { key: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
];

export default {
  transpilePackages: ["@moz/shared", "@moz/core", "@moz/db"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
