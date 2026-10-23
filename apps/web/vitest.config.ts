import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(import.meta.dirname, "../../.env") });
process.env.APP_ENV = "test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false },
});
