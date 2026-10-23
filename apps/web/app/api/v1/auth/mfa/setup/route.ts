import { mfaSetup } from "@moz/core";
import { authed, handle, json } from "@/lib/http";

export const POST = handle(async (c) => json(await mfaSetup(c.deps, await authed(c, { allowMfaPending: true }))));
