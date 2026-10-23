import { listMyFavourites } from "@moz/core";
import { authed, handle, json, query } from "@/lib/http";

export const GET = handle(async (c) => json(await listMyFavourites(c.deps, await authed(c), query(c.req), c.meta)));
