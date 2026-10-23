import { refreshTokens } from "@moz/core";
import { z } from "zod";
import { handle, json, readJson } from "@/lib/http";

const schema = z.strictObject({ refreshToken: z.string().min(20).max(200) });

export const POST = handle(async (c) => {
  const { refreshToken } = schema.parse(await readJson(c.req));
  return json(await refreshTokens(c.deps, refreshToken, c.meta));
});
