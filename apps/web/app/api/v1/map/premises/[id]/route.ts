import { premiseDetail } from "@moz/core";
import { handleWithId, json, query } from "@/lib/http";

const PUBLIC = { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" };
export const GET = handleWithId(async (c, id) => json(await premiseDetail(c.deps, id, query(c.req)), 200, PUBLIC));
