import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(import.meta.dirname, "../../.env") });
process.env.APP_ENV = "test";
process.env.SKIP_EMAIL_VERIFICATION = ""; // tests exercise the real email flow, whatever .env says

// Tests must never touch dev data: prefer the Neon TEST branch when configured.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL;
} else {
  console.warn("[tests] TEST_DATABASE_URL not set: running against the dev database (DEC-008)");
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { include: ["test/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
