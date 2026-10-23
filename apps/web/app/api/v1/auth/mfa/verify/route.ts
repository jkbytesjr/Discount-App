import { mfaVerify } from "@moz/core";
import { z } from "zod";
import { authed, handle, json, readJson } from "@/lib/http";

const schema = z.strictObject({ code: z.string().regex(/^\d{6}$/) });

export const POST = handle(async (c) => {
  const ctx = await authed(c, { allowMfaPending: true });
  const { code } = schema.parse(await readJson(c.req));
  return json(await mfaVerify(c.deps, ctx, code, c.meta));
});
