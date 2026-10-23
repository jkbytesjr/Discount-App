import { afterAll, describe, expect, it } from "vitest";
import { AppError, discountDetail, geofenceSync, mapFilters, mapPremises, nearbyDiscounts, premiseDetail, recentDiscounts } from "../src";
import { db, makeDeps, mutableClock } from "./helpers";

// Runs against the seeded demo data (SD-5/SD-6). "Now" is Wed 2026-11-04 13:00 Maputo unless stated (TD-5).
const WED = "2026-11-04T11:00:00Z";
const at = (iso: string) => makeDeps(mutableClock(iso)).deps;
const MAPUTO_BBOX = "32.4,-26.1,32.8,-25.8";
const ids = (r: { items: { id: string }[] }) => r.items.map((i) => i.id).sort();
const map = (iso: string, q: Record<string, string> = {}) => mapPremises(at(iso), { bbox: "29.9,-27,41.1,-9.9", ...q });
async function code(p: Promise<unknown>) { try { await p; return "OK"; } catch (e) { return e instanceof AppError ? e.code : e instanceof Error ? e.name : "?"; } }

afterAll(async () => { await db.$disconnect(); });

describe("BR-11 public map (BR-R2 visibility)", () => {
  it("shows exactly the premises with an active offer, with coordinates, at Wed 13:00", async () => {
    expect(ids(await map(WED))).toEqual([
      "pr-areia-branca", "pr-bela-vista", "pr-cinema", "pr-forca", "pr-marisco", "pr-polana-spa", "pr-posto-avenida", "pr-savana", "pr-sol-matola", "pr-sol-sommerschield", "pr-sorriso", "pr-tecnomoz",
    ]);
  });
  it("hides expired (S10), draft, future (S11), wrong weekday, outside hours, no-coordinates and online-only offers", async () => {
    const shown = ids(await map(WED));
    for (const hidden of ["pr-ilhasabor" /* expired d-16 */, "pr-beleza" /* Tuesdays only */, "pr-cafejardim" /* 06-10h and future */, "pr-farmac-tbc" /* no coordinates */]) expect(shown).not.toContain(hidden);
    expect(ids(await map("2026-11-03T11:00:00Z"))).toContain("pr-beleza"); // Tuesday
    expect(ids(await map("2026-11-03T11:00:00Z"))).not.toContain("pr-cinema"); // Wednesdays only
    expect(ids(await map("2026-11-04T05:00:00Z"))).toContain("pr-cafejardim"); // 07:00 Maputo, Nedbank breakfast
  });
  it("S11: a future offer is hidden before valid_from and shown at 00:00 Maputo that day", async () => {
    expect(ids(await map("2026-12-14T21:59:00Z", { general: "1" }))).not.toContain("pr-cafejardim");
    const after = await map("2026-12-14T22:00:00Z", { general: "1" });
    expect(ids(after)).toContain("pr-cafejardim");
    expect(after.items.find((i) => i.id === "pr-cafejardim")!.best?.label).toBe("500 MT de desconto");
  });
  it("S19: the Absa chip shows only premises with an active Absa-eligible offer", async () => {
    expect(ids(await map(WED, { issuer: "iss-absa" }))).toEqual(["pr-areia-branca", "pr-marisco", "pr-polana-spa"]);
  });
  it("S21: the M-Pesa chip shows M-Pesa and any-wallet offers only", async () => {
    expect(ids(await map(WED, { wallet: "wl-mpesa" }))).toEqual(["pr-bela-vista", "pr-cinema", "pr-marisco", "pr-savana"]);
    expect(ids(await map(WED, { wallet: "wl-emola" }))).toEqual(["pr-cinema"]); // e-Mola Tuesdays is not active on Wednesday
  });
  it("card-type, segment, general and category chips; groups combine as OR, category as AND", async () => {
    expect(ids(await map(WED, { cardType: "PREPAID" }))).toEqual(["pr-marisco"]); // only the any-bank-card row has no type
    expect(ids(await map(WED, { cardType: "CREDIT" }))).toEqual(expect.arrayContaining(["pr-posto-avenida", "pr-polana-spa", "pr-sorriso"]));
    expect(ids(await map(WED, { cardType: "CREDIT" }))).not.toContain("pr-forca");
    expect(ids(await map(WED, { segment: "Wealth" }))).toEqual(["pr-areia-branca", "pr-marisco", "pr-polana-spa"]);
    expect(ids(await map(WED, { general: "1" }))).toEqual(["pr-forca"]);
    expect(ids(await map(WED, { category: "restaurant" }))).toEqual(["pr-bela-vista", "pr-marisco"]);
    expect(ids(await map(WED, { wallet: "wl-mpesa", general: "1" }))).toEqual(["pr-bela-vista", "pr-cinema", "pr-forca", "pr-marisco", "pr-savana"]);
    expect(ids(await map(WED, { wallet: "wl-mpesa", category: "restaurant" }))).toEqual(["pr-bela-vista", "pr-marisco"]);
  });
  it("marks matched rows and summarises the best offer", async () => {
    const r = await map(WED, { issuer: "iss-absa" });
    const marisco = r.items.find((i) => i.id === "pr-marisco")!;
    expect(marisco).toMatchObject({ offerCount: 2, best: { label: "12% de desconto" }, issuerIds: expect.arrayContaining(["iss-absa"]) });
    expect(marisco.name).toContain("Marisco");
    const en = (await mapPremises(at(WED), { bbox: "29.9,-27,41.1,-9.9", lang: "en", issuer: "iss-absa" })).items.find((i) => i.id === "pr-polana-spa")!;
    expect(en.best?.label).toBe("15% off");
  });
  it("viewport boxes narrow the result; bad boxes are rejected", async () => {
    expect(ids(await mapPremises(at(WED), { bbox: "32.45,-25.97,32.47,-25.95" }))).toEqual(["pr-sol-matola"]);
    const maputo = ids(await mapPremises(at(WED), { bbox: MAPUTO_BBOX }));
    expect(maputo).toContain("pr-marisco"); expect(maputo).not.toContain("pr-areia-branca"); expect(maputo).not.toContain("pr-bela-vista");
    expect(await code(mapPremises(at(WED), { bbox: "32.8,-26.1,32.4,-25.8" }))).toBe("BAD_BBOX");
    expect(await code(mapPremises(at(WED), { bbox: "1,2,3" }))).toBe("ZodError");
    expect(await code(mapPremises(at(WED), { bbox: MAPUTO_BBOX, limit: "0" }))).toBe("ZodError");
    expect(await code(mapPremises(at(WED), { bbox: MAPUTO_BBOX, cardType: "GOLD" }))).toBe("ZodError");
    expect(await code(mapPremises(at(WED), { bbox: MAPUTO_BBOX, extra: "x" }))).toBe("ZodError");
  });
  it("paginates without gaps or repeats", async () => {
    const seen: string[] = []; let cursor: string | undefined; let total = 0;
    for (let i = 0; i < 5; i++) {
      const r = await mapPremises(at(WED), { bbox: "29.9,-27,41.1,-9.9", limit: "5", ...(cursor ? { cursor } : {}) });
      seen.push(...r.items.map((x) => x.id)); total = r.total; cursor = r.nextCursor ?? undefined;
      if (!cursor) break;
    }
    expect(total).toBe(12); expect(seen).toHaveLength(12); expect(new Set(seen).size).toBe(12);
  });
  it("chip data lists only issuers, wallets and categories that have a live offer", async () => {
    const wed = await mapFilters(at(WED), {});
    expect(wed.issuers.map((i) => i.id)).toEqual(expect.arrayContaining(["iss-absa", "iss-bci", "iss-mbim", "iss-moza"]));
    expect(wed.issuers.map((i) => i.id)).not.toContain("iss-eco"); // expired offer only
    expect(wed.wallets.map((w) => w.id)).toEqual(["wl-mpesa"]); // e-Mola is Tuesdays only
    expect(wed.general).toBe(true);
    expect(wed.categories.map((c) => c.id)).not.toContain("pharmacy");
    expect((await mapFilters(at("2026-11-03T11:00:00Z"), {})).wallets.map((w) => w.id).sort()).toEqual(["wl-emola", "wl-mpesa"]);
  });
});

describe("premise and discount detail (public)", () => {
  it("lists only offers active now and never leaks drafts", async () => {
    const wed = await premiseDetail(at(WED), "pr-marisco", {});
    expect(wed.offers.map((o) => o.id).sort()).toEqual(["d-02", "d-03"]);
    expect(JSON.stringify(wed)).not.toContain("romântico"); // d-18 is a draft
    expect((await premiseDetail(at("2026-11-07T11:00:00Z"), "pr-marisco", {})).offers.map((o) => o.id)).toEqual(["d-03"]); // Saturday
    const d02 = wed.offers.find((o) => o.id === "d-02")!;
    expect(d02.rows.map((r) => [r.cardProductName, r.label])).toEqual([["BCI Gold Visa Crédito", "10% de desconto"], ["Absa Wealth Visa Crédito", "12% de desconto"]]);
    expect(d02).toMatchObject({ days: ["MON", "TUE", "WED", "THU", "FRI"], from: "12:00", to: "15:00", validTo: "2027-03-31" });
  });
  it("a premise without an active offer or coordinates is still public; unknown ids are 404", async () => {
    expect(await premiseDetail(at(WED), "pr-ilhasabor", {})).toMatchObject({ id: "pr-ilhasabor", offers: [] });
    expect((await premiseDetail(at(WED), "pr-farmac-tbc", {})).offers.map((o) => o.id)).toEqual(["d-20"]);
    expect(await code(premiseDetail(at(WED), "pr-nope", {}))).toBe("NOT_FOUND");
  });
  it("discount detail: active offers only; draft, expired and unknown are 404; online offers have no premises (S12)", async () => {
    expect(await discountDetail(at(WED), "d-01", { lang: "en" })).toMatchObject({ id: "d-01", title: "15% at the Polana Spa", activeNow: true, premises: [{ id: "pr-polana-spa" }] });
    expect(await discountDetail(at("2026-11-07T11:00:00Z"), "d-02", {})).toMatchObject({ activeNow: false }); // Saturday: visible, not active
    for (const gone of ["d-16", "d-18", "d-19", "d-21", "d-17", "nope"]) expect(await code(discountDetail(at(WED), gone, {}))).toBe("NOT_FOUND");
    expect(await discountDetail(at(WED), "d-22", {})).toMatchObject({ isOnline: true, premises: [], activeNow: true });
  });
});

describe("IOS-6 nearby and IOS-7 recent", () => {
  const marisco = { lat: -25.948, lng: 32.613 };
  it("returns offers within the radius, nearest first, with distance", async () => {
    const r = await nearbyDiscounts(at(WED), { ...marisco, radius: "2000", lang: "en" });
    expect(r.items[0]!.premise.id).toBe("pr-marisco");
    expect(r.items.slice(0, 3).map((i) => i.discount.id).sort()).toEqual(["d-02", "d-03", "d-10"]); // Marisco x2, then Cinema ~300 m
    expect(r.items.map((i) => i.distanceM)).toEqual([...r.items.map((i) => i.distanceM)].sort((a, b) => a - b));
    expect(r.items.every((i) => i.distanceM <= 2000)).toBe(true);
    expect(r.items[0]!.discount.rows[0]!.label).toMatch(/off$/);
    const small = await nearbyDiscounts(at(WED), { ...marisco, radius: "500" });
    expect(small.items.map((i) => i.premise.id)).not.toContain("pr-areia-branca");
    expect((await nearbyDiscounts(at(WED), { ...marisco, radius: "500", wallet: "wl-mpesa" })).items.map((i) => i.discount.id).sort()).toEqual(["d-03", "d-10"]);
    expect((await nearbyDiscounts(at(WED), { lat: "-15.116", lng: "39.266" })).items).toEqual([]); // Nampula: only an expired offer
  });
  it("validates radius and coordinates", async () => {
    expect(await code(nearbyDiscounts(at(WED), { ...marisco, radius: "100" }))).toBe("ZodError");
    expect(await code(nearbyDiscounts(at(WED), { ...marisco, radius: "20000" }))).toBe("ZodError");
    expect(await code(nearbyDiscounts(at(WED), { lat: "95", lng: "0" }))).toBe("ZodError");
    expect(await code(nearbyDiscounts(at(WED), { lat: "abc", lng: "0" }))).toBe("ZodError");
  });
  it("recent: newest first within 30 days, includes online offers, never drafts, expired or future", async () => {
    const r = await recentDiscounts(at(WED), {});
    const got = r.items.map((i) => i.id);
    expect(got[0]).toBe("d-14"); // published 2026-11-01
    expect(got).toContain("d-22");
    for (const no of ["d-16", "d-18", "d-19", "d-21", "d-17"]) expect(got).not.toContain(no);
    expect(r.items.find((i) => i.id === "d-22")!.premises).toEqual([]);
    expect(await code(recentDiscounts(at(WED), { limit: "500" }))).toBe("ZodError");
  });
  it("ending soon: validity ends within 7 days, soonest first", async () => {
    const r = await recentDiscounts(at("2026-11-25T11:00:00Z"), { kind: "ending" });
    expect(r.items.map((i) => i.id)).toEqual(["d-06"]); // BCI fuel cashback, valid to 2026-11-30
    expect((await recentDiscounts(at(WED), { kind: "ending" })).items).toEqual([]);
  });
});

describe("IOS-8 geofence sync", () => {
  const marisco = { lat: "-25.948", lng: "32.613" };
  it("returns the nearest premises with radius and compact offers; the ETag is stable", async () => {
    const a = await geofenceSync(at(WED), marisco);
    expect(a.body.premises.length).toBeLessThanOrEqual(20);
    expect(a.body.premises[0]).toMatchObject({ id: "pr-marisco", radiusM: 150, discountIds: ["d-02", "d-03"] });
    expect(a.body.premises.map((p) => p.id)).not.toContain("pr-farmac-tbc"); // no coordinates: never alerts
    expect(a.body.premises.map((p) => p.id)).not.toContain("pr-ilhasabor"); // expired
    const d02 = a.body.offers.find((o) => o.id === "d-02")!;
    expect(d02).toMatchObject({ days: ["MON", "TUE", "WED", "THU", "FRI"], from: "12:00", to: "15:00", validTo: "2027-03-31" });
    expect(d02.rows[0]).toMatchObject({ scope: "CARD_PRODUCT", cardProductId: "cp-bci-gold", issuerId: "iss-bci", benefit: "PERCENT", value: 10 });
    expect(a.etag).toMatch(/^"[0-9a-f]{24}"$/);
    expect((await geofenceSync(at(WED), marisco)).etag).toBe(a.etag);
    // a different clock day keeps the same payload only while nothing visible changed; a far location differs
    expect((await geofenceSync(at(WED), { lat: "-19.835", lng: "34.845" })).etag).not.toBe(a.etag);
  });
  it("keeps offers whose schedule is not active yet (the device decides) but drops ended and unstarted ones", async () => {
    const sat = await geofenceSync(at("2026-11-07T11:00:00Z"), marisco);
    expect(sat.body.premises.find((p) => p.id === "pr-marisco")!.discountIds).toContain("d-02");
    const early = await geofenceSync(at(WED), { lat: "-25.9655", lng: "32.601" }); // Café Jardim: d-17 starts in December
    expect(early.body.offers.map((o) => o.id)).not.toContain("d-17");
  });
  it("caps at 20 regions and ignores places beyond 50 km", async () => {
    expect((await geofenceSync(at(WED), { lat: "-25.96", lng: "32.58" })).body.premises.length).toBeLessThanOrEqual(20);
    expect((await geofenceSync(at(WED), { lat: "-12.0", lng: "35.0" })).body.premises).toEqual([]);
    expect(await code(geofenceSync(at(WED), { lat: "x", lng: "1" }))).toBe("ZodError");
  });
});
