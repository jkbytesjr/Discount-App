import { businessStats } from "@moz/core";
import { authed, handle, json, query } from "@/lib/http";

// Counts only, no personal data (BR-10).
export const GET = handle(async (c) => json(await businessStats(c.deps, await authed(c), query(c.req), c.meta)));
