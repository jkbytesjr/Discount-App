import { deleteUser, getUser, updateUser } from "@moz/core";
import { authed, handleWithId, json, readJson } from "@/lib/http";

export const GET = handleWithId(async (c, id) => json(await getUser(c.deps, await authed(c), id, c.meta)));
export const PATCH = handleWithId(async (c, id) => json(await updateUser(c.deps, await authed(c), id, await readJson(c.req), c.meta)));
export const DELETE = handleWithId(async (c, id) => json(await deleteUser(c.deps, await authed(c), id, c.meta)));
