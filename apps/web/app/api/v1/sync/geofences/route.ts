import { geofenceSync } from "@moz/core";
import { handle, json, publicLimit, query } from "@/lib/http";

// IOS-8: compact payload for the on-device alert engine, with an ETag so unchanged regions cost a 304.
export const GET = handle(async (c) => {
  publicLimit(c);
  const { body, etag } = await geofenceSync(c.deps, query(c.req));
  const headers = { ETag: etag, "Cache-Control": "private, max-age=0, must-revalidate" };
  if (c.req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return json(body, 200, headers);
});
