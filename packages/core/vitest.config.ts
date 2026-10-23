import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: false } });
