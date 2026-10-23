import { myAlertEvents } from "@moz/core";
import { authed, handle, json, query } from "@/lib/http";

export const GET = handle(async (c) => json(await myAlertEvents(c.deps, await authed(c), query(c.req), c.meta)));
