import { getMyPrefs, putMyPrefs } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const GET = handle(async (c) => json(await getMyPrefs(c.deps, await authed(c), c.meta)));
export const PUT = handle(async (c) => json(await putMyPrefs(c.deps, await authed(c), await readJson(c.req), c.meta)));
