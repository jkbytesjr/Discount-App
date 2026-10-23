import { WEB_ABSOLUTE_MS, login } from "@moz/core";
import { handle, json, readJson, sessionCookie } from "@/lib/http";

export const POST = handle(async (c) => {
  const r = await login(c.deps, await readJson(c.req), c.meta);
  if ("sessionToken" in r && typeof r.sessionToken === "string") {
    // Web: the session token only travels in an HttpOnly cookie, never in the body.
    const { sessionToken, ...body } = r;
    return json(body, 200, { "Set-Cookie": sessionCookie(sessionToken, WEB_ABSOLUTE_MS / 1000) });
  }
  return json(r);
});
