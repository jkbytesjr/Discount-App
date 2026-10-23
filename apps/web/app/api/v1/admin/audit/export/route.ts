import { exportAudit } from "@moz/core";
import { authed, handle, query, xlsxResponse } from "@/lib/http";

// Admin only; at most 10 000 rows (POC). The export itself is audited.
export const GET = handle(async (c) => {
  const r = await exportAudit(c.deps, await authed(c), query(c.req), c.meta);
  return xlsxResponse(r.file, "audit-trail.xlsx", { "X-Rows": String(r.rows), "X-Capped": String(r.capped) });
});
