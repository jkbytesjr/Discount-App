import { z } from "zod";

// Cursor pagination on the (time-ordered UUIDv7) id.
export const pageSchema = {
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

export function page<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.id : null };
}
