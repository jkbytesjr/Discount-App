import { previewDiscount } from "@moz/core";
import { authed, handleWithId, json } from "@/lib/http";

export const GET = handleWithId(async (c, id) => {
  const lang = new URL(c.req.url).searchParams.get("lang") === "en" ? "en" : "pt";
  return json(await previewDiscount(c.deps, await authed(c), id, lang, c.meta));
});
