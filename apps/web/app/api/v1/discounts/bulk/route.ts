import { bulkDiscounts } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const POST = handle(async (c) => json({ results: await bulkDiscounts(c.deps, await authed(c), await readJson(c.req), c.meta) }));
