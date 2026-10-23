import { createDiscount, listDiscounts } from "@moz/core";
import { authed, handle, json, query, readJson } from "@/lib/http";

export const GET = handle(async (c) => json(await listDiscounts(c.deps, await authed(c), query(c.req), c.meta)));
export const POST = handle(async (c) => json(await createDiscount(c.deps, await authed(c), await readJson(c.req), c.meta), 201));
