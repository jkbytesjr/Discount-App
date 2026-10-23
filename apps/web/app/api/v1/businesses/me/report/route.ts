import { exportBusinessReport } from "@moz/core";
import { authed, handle, query, xlsxResponse } from "@/lib/http";

export const GET = handle(async (c) => xlsxResponse((await exportBusinessReport(c.deps, await authed(c), query(c.req), c.meta)).file, "discount-report.xlsx"));
