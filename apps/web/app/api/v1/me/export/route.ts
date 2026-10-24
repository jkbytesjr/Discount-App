import { exportMyData } from "@moz/core";
import { authed, handle, json } from "@/lib/http";

// IOS-4 "download my data": any signed-in person, their own data only.
export const GET = handle(async (c) => json(await exportMyData(c.deps, await authed(c), c.meta), 200, { "Content-Disposition": 'attachment; filename="my-data.json"', "Cache-Control": "no-store" }));
