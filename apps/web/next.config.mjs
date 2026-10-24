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
  // Page CSP (nonce-based) is set per request in proxy.ts. API responses get a locked-down policy here.
];

// Testing the dev server from a phone on the same Wi-Fi (http://<Mac LAN IP>:3000): Next 16 answers 403 to the script and
// websocket requests of any host that is not listed here, so the page renders but never hydrates (buttons, language switch and
// forms do nothing). Private LAN ranges are allowed by default; add hotspot or custom hosts with DEV_ALLOWED_ORIGINS="a.b.c.*,host.local".
const devOrigins = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local", ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];

export default {
  allowedDevOrigins: devOrigins,
  transpilePackages: ["@moz/shared", "@moz/core", "@moz/db"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
    ];
  },
};
