import { transitionDiscount } from "@moz/core";
import { authed, handleWithId, json } from "@/lib/http";

export const POST = handleWithId(async (c, id) => json(await transitionDiscount(c.deps, await authed(c), id, "publish", c.meta)));
