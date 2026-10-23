import { exportAlertEvents } from "@moz/core";
import { authed, handle, query, xlsxResponse } from "@/lib/http";

export const GET = handle(async (c) => {
  const r = await exportAlertEvents(c.deps, await authed(c), query(c.req), c.meta);
  return xlsxResponse(r.file, "alert-events.xlsx", { "X-Rows": String(r.rows) });
});
