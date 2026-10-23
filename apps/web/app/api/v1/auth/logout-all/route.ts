import { logoutAll } from "@moz/core";
import { authed, handle, json, sessionCookie } from "@/lib/http";

export const POST = handle(async (c) => {
  const ctx = await authed(c, { allowMfaPending: true });
  return json(await logoutAll(c.deps, ctx, c.meta), 200, { "Set-Cookie": sessionCookie("", 0) });
});
