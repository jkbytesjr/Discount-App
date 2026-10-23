import { registerPushToken } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const PUT = handle(async (c) => json(await registerPushToken(c.deps, await authed(c), await readJson(c.req), c.meta)));
