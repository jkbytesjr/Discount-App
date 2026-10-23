import { addMyCard, listMyCards } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const GET = handle(async (c) => json(await listMyCards(c.deps, await authed(c), c.meta)));
export const POST = handle(async (c) => json(await addMyCard(c.deps, await authed(c), await readJson(c.req), c.meta), 201));
