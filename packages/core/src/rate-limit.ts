import type { PrismaClient } from "@moz/db";
import type { Clock } from "./clock";

// Fixed-window counters stored in Postgres (POC, no Redis). Interface kept small so it can move to Redis.
export interface RateLimiter {
  /** Adds one hit and returns the count in the current window. */
  hit(key: string, windowSec: number): Promise<number>;
  /** Current count without adding a hit. */
  peek(key: string, windowSec: number): Promise<number>;
  reset(key: string): Promise<void>;
}

export function pgRateLimiter(db: PrismaClient, clock: Clock): RateLimiter {
  return {
    async hit(key, windowSec) {
      const now = clock.now();
      const cutoff = new Date(now.getTime() - windowSec * 1000);
      // Atomic upsert: reset the window when it has expired. Tagged template = parameterised.
      const rows = await db.$queryRaw<{ count: number }[]>`
        INSERT INTO rate_limits ("key", count, window_start) VALUES (${key}, 1, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          count = CASE WHEN rate_limits.window_start < ${cutoff} THEN 1 ELSE rate_limits.count + 1 END,
          window_start = CASE WHEN rate_limits.window_start < ${cutoff} THEN ${now} ELSE rate_limits.window_start END
        RETURNING count`;
      return Number(rows[0]?.count ?? 1);
    },
    async peek(key, windowSec) {
      const row = await db.rateLimit.findUnique({ where: { key } });
      if (!row) return 0;
      return row.windowStart.getTime() < clock.now().getTime() - windowSec * 1000 ? 0 : row.count;
    },
    async reset(key) {
      await db.rateLimit.deleteMany({ where: { key } });
    },
  };
}
