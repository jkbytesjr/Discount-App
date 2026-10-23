import { getSettings, requireCan, updateSettings } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

export const GET = handle(async (c) => { const ctx = await authed(c); await requireCan(c.deps, ctx, "settings.change", c.meta); return json(await getSettings(c.deps)); });
export const PUT = handle(async (c) => json(await updateSettings(c.deps, await authed(c), await readJson(c.req), c.meta)));
