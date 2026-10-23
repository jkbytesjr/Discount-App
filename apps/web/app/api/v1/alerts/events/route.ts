import { ingestAlertEvents } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

// Devices post lifecycle events here, also from the offline queue: the same clientEventId is stored once (BR-10).
export const POST = handle(async (c) => json(await ingestAlertEvents(c.deps, await authed(c), await readJson(c.req), c.meta), 202));
