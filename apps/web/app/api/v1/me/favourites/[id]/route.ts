import { addMyFavourite, removeMyFavourite } from "@moz/core";
import { authed, handleWithId, json } from "@/lib/http";

export const PUT = handleWithId(async (c, id) => json(await addMyFavourite(c.deps, await authed(c), id, c.meta)));
export const DELETE = handleWithId(async (c, id) => { await removeMyFavourite(c.deps, await authed(c), id, c.meta); return new Response(null, { status: 204 }); });
