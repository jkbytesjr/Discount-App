import { logout } from "@moz/core";
import { z } from "zod";
import { authed, handle, json, readJson, sessionCookie } from "@/lib/http";

const schema = z.strictObject({ refreshToken: z.string().max(200).optional() });

export const POST = handle(async (c) => {
  const ctx = await authed(c, { allowMfaPending: true });
  const { refreshToken } = schema.parse(await readJson(c.req));
  return json(await logout(c.deps, ctx, refreshToken, c.meta), 200, { "Set-Cookie": sessionCookie("", 0) });
});
