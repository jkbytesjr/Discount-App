import { discountDetail } from "@moz/core";
import { handleWithId, json, publicLimit, query } from "@/lib/http";

const PUBLIC = { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" };
export const GET = handleWithId(async (c, id) => { publicLimit(c); return json(await discountDetail(c.deps, id, query(c.req)), 200, PUBLIC); });
