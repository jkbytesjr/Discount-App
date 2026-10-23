import { verifyEmail } from "@moz/core";
import { handle, json, readJson } from "@/lib/http";

export const POST = handle(async (c) => json(await verifyEmail(c.deps, await readJson(c.req), c.meta)));
