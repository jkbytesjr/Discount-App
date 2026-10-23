import { deleteAccount, publicUser, updateProfile } from "@moz/core";
import { authed, handle, json, readJson } from "@/lib/http";

// GET is allowed while 2FA setup is pending so the portal can show the setup screen.
export const GET = handle(async (c) => {
  const ctx = await authed(c, { allowMfaPending: true });
  return json({ ...publicUser(ctx.user), mfaPending: ctx.mfaPending, csrfToken: ctx.session?.csrfToken });
});
export const PATCH = handle(async (c) => json(await updateProfile(c.deps, await authed(c), await readJson(c.req), c.meta)));
export const DELETE = handle(async (c) => json(await deleteAccount(c.deps, await authed(c), await readJson(c.req), c.meta)));
