import path from "node:path";
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: path.resolve(import.meta.dirname, "../../.env") });
// Never run browser tests against dev data when a test branch is configured.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL;
}
// A fresh client IP per run, so the real per-IP login limit does not carry over between runs.
const runIp = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
export const OUTBOX = path.resolve(import.meta.dirname, ".e2e-outbox");
process.env.MAIL_OUTBOX_DIR = OUTBOX;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": runIp }, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: "pnpm exec next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...process.env as Record<string, string>, APP_ENV: "test", APP_URL: "http://localhost:3100", MAIL_OUTBOX_DIR: OUTBOX },
  },
});
