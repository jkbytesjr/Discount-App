import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

// One client per process (reused across hot reloads in dev).
const g = globalThis as unknown as { __prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!g.__prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return g.__prisma;
}
