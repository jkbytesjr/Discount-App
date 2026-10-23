import { deleteDiscount, getDiscount, updateDiscount } from "@moz/core";
import { authed, handleWithId, json, readJson } from "@/lib/http";

export const GET = handleWithId(async (c, id) => json(await getDiscount(c.deps, await authed(c), id, c.meta)));
export const PATCH = handleWithId(async (c, id) => json(await updateDiscount(c.deps, await authed(c), id, await readJson(c.req), c.meta)));
export const DELETE = handleWithId(async (c, id) => { await deleteDiscount(c.deps, await authed(c), id, c.meta); return new Response(null, { status: 204 }); });
