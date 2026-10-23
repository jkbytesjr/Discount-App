import { importPremises } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

// 200 with `errors` (and created = 0) when any line is invalid: nothing is saved (BR-8).
export const POST = handle(async (c) => json(await importPremises(c.deps, await authed(c), await readJson(c.req), c.meta)));
