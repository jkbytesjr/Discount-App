import { deletePremise, getPremise, updatePremise } from "@moz/core";
import { authed, handleWithId, json, readJson } from "@/lib/http";

export const GET = handleWithId(async (c, id) => json(await getPremise(c.deps, await authed(c), id, c.meta)));
export const PATCH = handleWithId(async (c, id) => json(await updatePremise(c.deps, await authed(c), id, await readJson(c.req), c.meta)));
export const DELETE = handleWithId(async (c, id) => { await deletePremise(c.deps, await authed(c), id, c.meta); return new Response(null, { status: 204 }); });
