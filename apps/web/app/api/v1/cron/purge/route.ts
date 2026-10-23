import { purgeStale } from "@moz/core";
import { handle, json, problem } from "@/lib/http";

// Daily Vercel Cron: purge unverified accounts and expired tokens/sessions (BR-4, POC-Profile).
export const GET = handle(async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || c.req.headers.get("authorization") !== `Bearer ${secret}`) return problem(401, "UNAUTHENTICATED", "Unauthorized");
  return json(await purgeStale(c.deps));
});
