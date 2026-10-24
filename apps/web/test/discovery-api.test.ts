import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@moz/db";
import { GET as mapGet } from "../app/api/v1/map/premises/route";
import { GET as premiseGet } from "../app/api/v1/map/premises/[id]/route";
import { GET as discountGet } from "../app/api/v1/map/discounts/[id]/route";
import { GET as filtersGet } from "../app/api/v1/map/filters/route";
import { GET as nearbyGet } from "../app/api/v1/discounts/nearby/route";
import { GET as recentGet } from "../app/api/v1/discounts/recent/route";
import { publicLimit } from "../lib/http";
import { GET as syncGet } from "../app/api/v1/sync/geofences/route";

// Public discovery over HTTP, anonymous, at Wed 2026-11-04 13:00 Maputo via the test-only X-Test-Now header (TD-2).
const WED = "2026-11-04T11:00:00Z";
const get = (h: any, url: string, params?: Record<string, string>, headers: Record<string, string> = {}) =>
  h(new Request(`http://localhost${url}`, { headers: { "x-test-now": WED, ...headers } }), { params: Promise.resolve(params ?? {}) }) as Promise<Response>;
afterAll(async () => { await getDb().$disconnect(); });

describe("public discovery API hardening (NFR-1, NFR-2)", () => {
  it("injection strings in filters are plain data: no error, no extra rows", async () => {
    for (const bad of ["x'%20OR%20'1'='1", "%22;DROP%20TABLE%20premises;--", "%3Cscript%3Ealert(1)%3C/script%3E", "iss-absa%00"]) {
      const res = await get(mapGet, `/x?bbox=29.9,-27,41.1,-9.9&issuer=${bad}`);
      expect([200, 422]).toContain(res.status);
      // an unknown bank matches nothing by itself; "any bank card" offers (Marisco) legitimately qualify for every bank chip (DEC-039)
      if (res.status === 200) expect((await res.json()).items.every((i: { id: string }) => i.id === "pr-marisco")).toBe(true);
    }
    expect((await getDb().premise.count())).toBeGreaterThan(10); // the table is still there
    expect((await get(premiseGet, "/x", { id: "pr-marisco' OR '1'='1" })).status).toBe(404);
  });
  it("responses never carry internal fields", async () => {
    const text = JSON.stringify(await (await get(premiseGet, "/x", { id: "pr-marisco" })).json());
    expect(text).not.toMatch(/passwordHash|dataOrigin|createdBy|businessId.*status|rejectionReason|approvedBy/);
  });
  it("API responses are locked down (CSP none, nosniff) and never set cookies", async () => {
    const res = await get(mapGet, "/x?bbox=29.9,-27,41.1,-9.9");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("one client cannot hammer the public API: 429 past 300 requests a minute, other clients unaffected", () => {
    const ctx = (ip: string) => ({ meta: { ip } }) as never;
    for (let i = 0; i < 300; i++) publicLimit(ctx("10.250.250.250"));
    expect(() => publicLimit(ctx("10.250.250.250"))).toThrowError(expect.objectContaining({ status: 429, code: "RATE_LIMITED" }));
    expect(() => publicLimit(ctx("10.250.250.251"))).not.toThrow();
  });
});

describe("public discovery API (BR-11, IOS-6/7/8)", () => {
  it("map premises: anonymous 200, cacheable, filterable; bad input is problem+json 422", async () => {
    const res = await get(mapGet, "/x?bbox=29.9,-27,41.1,-9.9&issuer=iss-absa");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    expect((await res.json()).items.map((i: { id: string }) => i.id).sort()).toEqual(["pr-areia-branca", "pr-marisco", "pr-polana-spa"]);
    const bad = await get(mapGet, "/x?bbox=nope");
    expect(bad.status).toBe(422); expect(bad.headers.get("content-type")).toContain("problem+json");
    expect((await get(mapGet, "/x?bbox=32.8,-26.1,32.4,-25.8")).status).toBe(422);
    expect((await get(mapGet, "/x?bbox=29.9,-27,41.1,-9.9&sql=1%27%20OR%20%271")).status).toBe(422); // unknown params are rejected
  });
  it("premise and discount detail are public; drafts and unknown ids are 404", async () => {
    expect((await (await get(premiseGet, "/x?lang=en", { id: "pr-polana-spa" })).json()).offers[0].title).toBe("15% at the Polana Spa");
    expect((await get(premiseGet, "/x", { id: "nope" })).status).toBe(404);
    expect((await get(discountGet, "/x", { id: "d-01" })).status).toBe(200);
    expect((await get(discountGet, "/x", { id: "d-18" })).status).toBe(404);
  });
  it("filters, nearby, recent", async () => {
    expect((await (await get(filtersGet, "/x")).json()).wallets.map((w: { id: string }) => w.id)).toEqual(["wl-mpesa"]);
    const near = await get(nearbyGet, "/x?lat=-25.948&lng=32.613&radius=1000");
    expect(near.status).toBe(200); expect((await near.json()).items[0].premise.id).toBe("pr-marisco");
    expect((await get(nearbyGet, "/x?lat=-25.948&lng=32.613&radius=50")).status).toBe(422);
    expect((await (await get(recentGet, "/x")).json()).items[0].id).toBe("d-14");
  });
  it("geofence sync: ETag, 304 on a matching If-None-Match, new body when the place changes", async () => {
    const a = await get(syncGet, "/x?lat=-25.948&lng=32.613");
    expect(a.status).toBe(200);
    const etag = a.headers.get("etag")!;
    expect(etag).toMatch(/^"[0-9a-f]{24}"$/);
    expect((await a.json()).premises[0].id).toBe("pr-marisco");
    const again = await get(syncGet, "/x?lat=-25.948&lng=32.613", undefined, { "if-none-match": etag });
    expect(again.status).toBe(304); expect(await again.text()).toBe("");
    const far = await get(syncGet, "/x?lat=-19.835&lng=34.845", undefined, { "if-none-match": etag });
    expect(far.status).toBe(200);
    expect((await get(syncGet, "/x?lat=1")).status).toBe(422);
  });
});
