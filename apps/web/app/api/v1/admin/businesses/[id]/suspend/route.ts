import { suspendBusiness } from "@moz/core";
import { authed, handleWithId, json, readJson } from "@/lib/http";

export const POST = handleWithId(async (c, id) => json(await suspendBusiness(c.deps, await authed(c), id, await readJson(c.req), c.meta)));
