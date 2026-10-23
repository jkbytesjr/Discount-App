import { removeMyWallet } from "@moz/core";
import { authed, handleWithId } from "@/lib/http";

export const DELETE = handleWithId(async (c, id) => { await removeMyWallet(c.deps, await authed(c), id, c.meta); return new Response(null, { status: 204 }); });
