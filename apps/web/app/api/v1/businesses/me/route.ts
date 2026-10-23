import { getMyBusiness } from "@moz/core";
import { authed, handle, json } from "@/lib/http";

export const GET = handle(async (c) => json(await getMyBusiness(c.deps, await authed(c))));
