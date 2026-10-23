import { requestEmailChange } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const POST = handle(async (c) => json(await requestEmailChange(c.deps, await authed(c), await readJson(c.req), c.meta)));
