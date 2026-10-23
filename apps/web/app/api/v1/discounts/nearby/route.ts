import { nearbyDiscounts } from "@moz/core";
import { handle, json, query } from "@/lib/http";

// Public. Not cached: the URL carries the caller's coordinates.
export const GET = handle(async (c) => json(await nearbyDiscounts(c.deps, query(c.req)), 200, { "Cache-Control": "private, max-age=15" }));
