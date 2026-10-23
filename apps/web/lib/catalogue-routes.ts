import {
  createCatalogueItem, deactivateCatalogueItem, getCatalogueItem, listCatalogue, updateCatalogueItem, type Kind,
} from "@moz/core";
import { authed, handle, handleWithId, json, query, readJson } from "./http";

// Public read (active rows, cacheable); admin write. ?includeInactive=1 needs an admin session.
export function catalogueCollection(kind: Kind) {
  return {
    GET: handle(async (c) => {
      const includeInactive = query(c.req).includeInactive === "1";
      if (includeInactive) {
        const ctx = await authed(c);
        if (ctx.user.role !== "ADMIN") return json(await listCatalogue(c.deps, kind));
        return json(await listCatalogue(c.deps, kind, true));
      }
      return json(await listCatalogue(c.deps, kind), 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
    }),
    POST: handle(async (c) => json(await createCatalogueItem(c.deps, await authed(c), kind, await readJson(c.req), c.meta), 201)),
  };
}

export function catalogueItem(kind: Kind) {
  return {
    GET: handleWithId(async (c, id) => json(await getCatalogueItem(c.deps, kind, id))),
    PATCH: handleWithId(async (c, id) => json(await updateCatalogueItem(c.deps, await authed(c), kind, id, await readJson(c.req), c.meta))),
    DELETE: handleWithId(async (c, id) => json(await deactivateCatalogueItem(c.deps, await authed(c), kind, id, c.meta))),
  };
}
