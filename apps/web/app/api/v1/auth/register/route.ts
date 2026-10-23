import { register } from "@moz/core";
import { handle, json, readJson } from "@/lib/http";

export const POST = handle(async (c) => json(await register(c.deps, await readJson(c.req), c.meta), 201));
