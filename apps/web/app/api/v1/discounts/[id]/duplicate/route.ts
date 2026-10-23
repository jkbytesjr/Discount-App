import { duplicateDiscount } from "@moz/core";
import { authed, handleWithId, json } from "@/lib/http";

export const POST = handleWithId(async (c, id) => json(await duplicateDiscount(c.deps, await authed(c), id, c.meta), 201));
