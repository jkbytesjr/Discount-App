import { mapPremises } from "@moz/core";
import { handle, json, publicLimit, query } from "@/lib/http";

const PUBLIC = { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" };
export const GET = handle(async (c) => { publicLimit(c); return json(await mapPremises(c.deps, query(c.req)), 200, PUBLIC); });
