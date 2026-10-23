import { removeMyCard } from "@moz/core";
import { authed, handleWithId } from "@/lib/http";

export const DELETE = handleWithId(async (c, id) => { await removeMyCard(c.deps, await authed(c), id, c.meta); return new Response(null, { status: 204 }); });
