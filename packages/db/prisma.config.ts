import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load the repo-root .env
config({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrations use the direct (non-pooled) connection
    url: (process.env.MIGRATE_TARGET === "test" ? process.env.TEST_DIRECT_URL : process.env.DIRECT_URL) ?? process.env.DATABASE_URL ?? "",
  },
});
