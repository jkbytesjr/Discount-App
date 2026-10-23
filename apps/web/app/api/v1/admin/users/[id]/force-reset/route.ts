import { forcePasswordReset } from "@moz/core";
import { authed, handleWithId, json } from "@/lib/http";

export const POST = handleWithId(async (c, id) => json(await forcePasswordReset(c.deps, await authed(c), id, c.meta)));
