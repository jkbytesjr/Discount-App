import { getBusiness, updateBusiness } from "@moz/core";
import { authed, handleWithId, json, readJson } from "@/lib/http";

export const GET = handleWithId(async (c, id) => json(await getBusiness(c.deps, await authed(c), id, c.meta)));
export const PATCH = handleWithId(async (c, id) => json(await updateBusiness(c.deps, await authed(c), id, await readJson(c.req), c.meta)));
