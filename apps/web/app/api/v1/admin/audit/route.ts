import { listAudit } from "@moz/core";
import { authed, handle, json, query } from "@/lib/http";

export const GET = handle(async (c) => json(await listAudit(c.deps, await authed(c), query(c.req), c.meta)));
