import { recentDiscounts } from "@moz/core";
import { handle, json, query } from "@/lib/http";

const PUBLIC = { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" };
export const GET = handle(async (c) => json(await recentDiscounts(c.deps, query(c.req)), 200, PUBLIC));
