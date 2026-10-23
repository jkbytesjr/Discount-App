import { myBundle } from "@moz/core";
import { authed, handle, json } from "@/lib/http";

export const GET = handle(async (c) => json(await myBundle(c.deps, await authed(c), c.meta)));
