import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AppError, approveBusiness, bulkDiscounts, createBusiness, createDiscount, createPremise, deleteDiscount, deletePremise, duplicateDiscount,
  expireDueDiscounts, extendValidity, getDiscount, getPremise, importPremises, listDiscounts, listPremises, previewDiscount, submitBusiness,
  suspendBusiness, transitionDiscount, updateBusiness, updateDiscount, updatePremise,
} from "../src";
import { cleanup, cleanupBusinesses, db, makeCaller, makeDeps, mutableClock } from "./helpers";

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; return "OK"; } catch (e) { return e instanceof AppError ? e.code : e instanceof Error ? e.name : "?"; }
}
const complete = { contactEmail: "info@it-biz.test", contactPhone: "+258841234567", address: "Av. Marginal 1, Maputo" };
const MAPUTO = { lat: -25.97, lng: 32.6 };

type T = ReturnType<typeof makeDeps>;
async function approvedMerchant(t: T, admin: Awaited<ReturnType<typeof makeCaller>>, name: string) {
  const owner = await makeCaller(t, "BUSINESS_OWNER");
  const biz = await createBusiness(t.deps, owner.ctx, { type: "MERCHANT", tradingName: name }, owner.meta);
  await updateBusiness(t.deps, owner.ctx, biz.id, complete, owner.meta);
  await submitBusiness(t.deps, owner.ctx, biz.id, owner.meta);
  await approveBusiness(t.deps, admin.ctx, biz.id, admin.meta);
  return { owner, biz };
}
const premiseBody = { categoryId: "restaurant", name: "IT Marisco", address: "Av. Marginal", city: "Maputo", ...MAPUTO };
const restaurantRows = [
  { scope: "CARD_PRODUCT", cardProductId: "cp-bci-gold", benefit: "PERCENT", value: 10 },
  { scope: "CARD_PRODUCT", cardProductId: "cp-absa-wealth", benefit: "PERCENT", value: 12 },
  { scope: "WALLET", walletId: "wl-mpesa", benefit: "PERCENT", value: 5 },
  { scope: "ANY_BANK_CARD", benefit: "PERCENT", value: 3 },
];
const discountBody = (premiseIds: string[], extra: object = {}) => ({
  title: { pt: "IT Almoço com cartão", en: "IT Lunch with your card" }, premiseIds, eligibility: restaurantRows,
  schedule: { days: ["MON", "TUE", "WED", "THU", "FRI"], from: "12:00", to: "15:00" }, validFrom: "2026-09-01", validTo: "2027-03-31", ...extra,
});

beforeAll(async () => { await cleanup(); await cleanupBusinesses(); });
afterAll(async () => { await cleanupBusinesses(); await cleanup(); await db.$disconnect(); });

describe("BR-8 premises", () => {
  it("owner creates, edits and lists their premise; coordinates must be in Mozambique", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Premises Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    expect(p).toMatchObject({ lat: MAPUTO.lat, alertRadiusM: 150, status: "ACTIVE", dataOrigin: "REAL" });
    const after = await updatePremise(t.deps, owner.ctx, p.id, { alertRadiusM: 300 }, owner.meta);
    expect(after.alertRadiusM).toBe(300);
    expect(await db.auditLog.findFirst({ where: { action: "premise.update", entityId: p.id } })).toMatchObject({ changes: { before: { alertRadiusM: 150 }, after: { alertRadiusM: 300 } } });
    expect((await listPremises(t.deps, owner.ctx, {}, owner.meta)).items.map((x) => x.id)).toEqual([p.id]);
    expect(await code(createPremise(t.deps, owner.ctx, { ...premiseBody, lat: 51.5, lng: -0.12 }, owner.meta))).toBe("OUTSIDE_MOZAMBIQUE");
    expect(await code(createPremise(t.deps, owner.ctx, { categoryId: "restaurant", name: "IT Half", lat: -25.9 }, owner.meta))).toBe("BAD_COORDINATES");
    expect(await code(createPremise(t.deps, owner.ctx, { ...premiseBody, alertRadiusM: 49 }, owner.meta))).toBe("ZodError");
    expect(await code(createPremise(t.deps, owner.ctx, { ...premiseBody, alertRadiusM: 1001 }, owner.meta))).toBe("ZodError");
    expect(await code(createPremise(t.deps, owner.ctx, { ...premiseBody, categoryId: "nope" }, owner.meta))).toBe("UNKNOWN_CATEGORY");
    // a premise without coordinates is allowed (listed, never alerts)
    const noGeo = await createPremise(t.deps, owner.ctx, { categoryId: "pharmacy", name: "IT Farmácia" }, owner.meta);
    expect(noGeo.lat).toBeNull();
  });
  it("admin may override the Mozambique box for online/cross-border premises; owners may not", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner, biz } = await approvedMerchant(t, admin, "IT Border Co");
    const body = { ...premiseBody, name: "IT Lisbon HQ", lat: 38.72, lng: -9.14, allowOutsideMozambique: true };
    expect(await code(createPremise(t.deps, owner.ctx, body, owner.meta))).toBe("OUTSIDE_MOZAMBIQUE");
    expect((await createPremise(t.deps, admin.ctx, { ...body, businessId: biz.id, lat: 40.7, lng: -74 }, admin.meta)).businessId).toBe(biz.id);
  });
  it("cross-tenant access is a 404 plus a permission.denied audit row (S18); users cannot write", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const a = await approvedMerchant(t, admin, "IT Tenant A"); const b = await approvedMerchant(t, admin, "IT Tenant B");
    const p = await createPremise(t.deps, a.owner.ctx, premiseBody, a.owner.meta);
    expect(await code(getPremise(t.deps, b.owner.ctx, p.id, b.owner.meta))).toBe("NOT_FOUND");
    expect(await code(updatePremise(t.deps, b.owner.ctx, p.id, { name: "IT hacked" }, b.owner.meta))).toBe("NOT_FOUND");
    expect(await db.auditLog.count({ where: { action: "permission.denied", actorEmail: b.owner.email, entityId: p.id } })).toBe(2);
    const u = await makeCaller(t, "USER");
    expect(await code(createPremise(t.deps, u.ctx, premiseBody, u.meta))).toBe("FORBIDDEN");
  });
  it("CSV import is all-or-nothing with line-numbered errors, and supports a dry run", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Import Co");
    const good = 'name,category,address,city,lat,lng,phone,alert_radius_m\n"IT Filial, Centro",Supermercado,Av. 1,Maputo,-25.95,32.58,+258841234567,200\nIT Filial 2,supermarket,Av. 2,Matola,-25.96,32.46,,\n';
    const dry = await importPremises(t.deps, owner.ctx, { csv: good, dryRun: true }, owner.meta);
    expect(dry).toMatchObject({ created: 0, errors: [], dryRun: true });
    expect((await listPremises(t.deps, owner.ctx, {}, owner.meta)).items).toHaveLength(0);
    const bad = good + "IT Filial 3,Unknown,Av. 3,Beira,-19.8,34.8,,\nIT Filial 4,restaurant,Av. 4,London,51.5,-0.1,,\n";
    const r = await importPremises(t.deps, owner.ctx, { csv: bad }, owner.meta);
    expect(r.created).toBe(0);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
    expect((await listPremises(t.deps, owner.ctx, {}, owner.meta)).items).toHaveLength(0);
    expect(await importPremises(t.deps, owner.ctx, { csv: good }, owner.meta)).toMatchObject({ created: 2, errors: [] });
    const items = (await listPremises(t.deps, owner.ctx, {}, owner.meta)).items;
    expect(items.map((i) => i.name).sort()).toEqual(["IT Filial 2", "IT Filial, Centro"]);
    expect(items.find((i) => i.name === "IT Filial, Centro")?.alertRadiusM).toBe(200);
    expect(await code(importPremises(t.deps, owner.ctx, { csv: "name,colour\nx,y" }, owner.meta))).toBe("BAD_HEADER");
  });
  it("hard delete is admin only and blocked while a discount uses the premise", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Delete Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    expect(await code(deletePremise(t.deps, owner.ctx, p.id, owner.meta))).toBe("FORBIDDEN");
    expect(await code(deletePremise(t.deps, admin.ctx, p.id, admin.meta))).toBe("IN_USE");
  });
});

describe("BR-7 / BR-9 discounts", () => {
  it("captures the restaurant example in full (BCI Gold 10, Absa Wealth 12, M-Pesa 5, any bank card 3)", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Restaurant");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const dsc = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    expect(dsc.status).toBe("DRAFT");
    expect(dsc.eligibility.map((e) => [e.scope, e.value])).toEqual([["CARD_PRODUCT", 10], ["CARD_PRODUCT", 12], ["WALLET", 5], ["ANY_BANK_CARD", 3]]);
    expect(dsc.eligibility[0]?.issuerId).toBe("iss-bci"); // filled from the card product
    expect(dsc).toMatchObject({ scheduleDays: ["MON", "TUE", "WED", "THU", "FRI"], scheduleFrom: "12:00", scheduleTo: "15:00" });
  });
  it("rejects invalid eligibility, windows, premises and unknown fields", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const a = await approvedMerchant(t, admin, "IT Valid A"); const b = await approvedMerchant(t, admin, "IT Valid B");
    const pa = await createPremise(t.deps, a.owner.ctx, premiseBody, a.owner.meta);
    const mk = (rows: object[], extra: object = {}) => createDiscount(t.deps, a.owner.ctx, discountBody([pa.id], { eligibility: rows, ...extra }), a.owner.meta);
    expect(await code(mk([{ scope: "CARD_PRODUCT", benefit: "PERCENT", value: 10 }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", walletId: "wl-mpesa", benefit: "BOGO" }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", benefit: "PERCENT", value: 101 }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", benefit: "PERCENT" }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", benefit: "FIXED" }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", benefit: "FREE_ITEM" }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "GENERAL", benefit: "FIXED", valueMzn: 5, maxDiscountMzn: 3 }]))).toBe("BAD_ELIGIBILITY");
    expect(await code(mk([{ scope: "CARD_PRODUCT", cardProductId: "cp-nope", benefit: "PERCENT", value: 5 }]))).toBe("UNKNOWN_CARD_PRODUCT");
    expect(await code(mk([{ scope: "WALLET", walletId: "wl-nope", benefit: "PERCENT", value: 5 }]))).toBe("UNKNOWN_WALLET");
    expect(await code(mk([{ scope: "ISSUER_ANY", issuerId: "iss-nope", benefit: "PERCENT", value: 5 }]))).toBe("UNKNOWN_ISSUER");
    expect(await code(mk([{ scope: "GENERAL", benefit: "PERCENT", value: 0 }]))).toBe("ZodError");
    expect(await code(mk(restaurantRows, { validFrom: "2027-01-01", validTo: "2026-01-01" }))).toBe("BAD_DATES");
    expect(await code(mk(restaurantRows, { schedule: { days: ["MON"], from: "15:00", to: "12:00" } }))).toBe("BAD_SCHEDULE");
    expect(await code(mk(restaurantRows, { schedule: { days: ["MON"], from: "12:00" } }))).toBe("BAD_SCHEDULE");
    expect(await code(mk(restaurantRows, { schedule: { days: ["FUNDAY"] } }))).toBe("ZodError");
    expect(await code(mk(restaurantRows, { validFrom: "2026-02-30" }))).toBe("ZodError");
    expect(await code(mk(restaurantRows, { status: "PUBLISHED" }))).toBe("ZodError");
    const pb = await createPremise(t.deps, b.owner.ctx, premiseBody, b.owner.meta);
    expect(await code(createDiscount(t.deps, a.owner.ctx, discountBody([pb.id]), a.owner.meta))).toBe("UNKNOWN_PREMISE");
    // any issuer + card type + network filters and a general row are all valid shapes
    const ok = await mk([{ scope: "ISSUER_ANY", issuerId: "iss-bci", cardType: "CREDIT", benefit: "CASHBACK", value: 3 }, { scope: "ANY_BANK_CARD", networkId: "net-visa", benefit: "PERCENT", value: 2, maxDiscountMzn: 500 }, { scope: "ANY_WALLET", benefit: "BOGO" }, { scope: "GENERAL", benefit: "FREE_ITEM", valueText: { pt: "Café", en: "Coffee" } }]);
    expect(ok.eligibility).toHaveLength(4);
  });
  it("create -> edit -> pause -> republish -> archive, every step audited", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Lifecycle Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const d0 = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    const edited = await updateDiscount(t.deps, owner.ctx, d0.id, { title: { pt: "IT Novo", en: "IT New" }, eligibility: [{ scope: "ANY_WALLET", benefit: "PERCENT", value: 8 }] }, owner.meta);
    expect(edited.titleEn).toBe("IT New"); expect(edited.eligibility).toHaveLength(1);
    expect((await transitionDiscount(t.deps, owner.ctx, d0.id, "publish", owner.meta)).status).toBe("PUBLISHED");
    expect(await code(transitionDiscount(t.deps, owner.ctx, d0.id, "publish", owner.meta))).toBe("INVALID_STATE");
    const live = await updateDiscount(t.deps, owner.ctx, d0.id, { validTo: "2027-06-30" }, owner.meta); // edit while live
    expect(live.status).toBe("PUBLISHED");
    expect((await transitionDiscount(t.deps, owner.ctx, d0.id, "pause", owner.meta)).status).toBe("PAUSED");
    expect((await transitionDiscount(t.deps, owner.ctx, d0.id, "publish", owner.meta)).status).toBe("PUBLISHED");
    expect((await transitionDiscount(t.deps, owner.ctx, d0.id, "archive", owner.meta)).status).toBe("ARCHIVED");
    expect(await code(updateDiscount(t.deps, owner.ctx, d0.id, { isOnline: true }, owner.meta))).toBe("INVALID_STATE");
    expect((await transitionDiscount(t.deps, owner.ctx, d0.id, "restore", owner.meta)).status).toBe("DRAFT");
    const actions = (await db.auditLog.findMany({ where: { entityId: d0.id }, orderBy: { occurredAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["discount.create", "discount.update", "discount.publish", "discount.update", "discount.pause", "discount.publish", "discount.archive", "discount.restore"]);
    expect(await db.auditLog.findFirst({ where: { entityId: d0.id, action: "discount.pause" } })).toMatchObject({ changes: { before: { status: "PUBLISHED" }, after: { status: "PAUSED" } } });
  });
  it("publishing needs a complete discount; an edit that would break a live one is rolled back", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Complete Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const empty = await createDiscount(t.deps, owner.ctx, { title: { pt: "IT x", en: "IT x" } }, owner.meta);
    await expect(transitionDiscount(t.deps, owner.ctx, empty.id, "publish", owner.meta)).rejects.toMatchObject({ code: "INCOMPLETE_DISCOUNT", extra: { missing: ["eligibility", "premises"] } });
    const online = await updateDiscount(t.deps, owner.ctx, empty.id, { isOnline: true, eligibility: [{ scope: "GENERAL", benefit: "BOGO" }] }, owner.meta);
    expect((await transitionDiscount(t.deps, owner.ctx, online.id, "publish", owner.meta)).status).toBe("PUBLISHED");
    expect(await code(updateDiscount(t.deps, owner.ctx, online.id, { isOnline: false }, owner.meta))).toBe("INCOMPLETE_DISCOUNT");
    expect((await getDiscount(t.deps, owner.ctx, online.id, owner.meta)).isOnline).toBe(true); // rolled back
    const past = await createDiscount(t.deps, owner.ctx, discountBody([p.id], { validFrom: "2026-01-01", validTo: "2026-02-01" }), owner.meta);
    expect(await code(transitionDiscount(t.deps, owner.ctx, past.id, "publish", owner.meta))).toBe("VALIDITY_PAST");
  });
  it("S17: a business that is not approved keeps drafts but cannot publish", async () => {
    const t = makeDeps();
    const owner = await makeCaller(t, "BUSINESS_OWNER");
    const biz = await createBusiness(t.deps, owner.ctx, { type: "MERCHANT", tradingName: "IT Pending Co" }, owner.meta);
    await updateBusiness(t.deps, owner.ctx, biz.id, complete, owner.meta); await submitBusiness(t.deps, owner.ctx, biz.id, owner.meta);
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta); // premises allowed (BR-R11)
    const dsc = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    expect(await code(transitionDiscount(t.deps, owner.ctx, dsc.id, "publish", owner.meta))).toBe("FORBIDDEN");
    expect((await getDiscount(t.deps, owner.ctx, dsc.id, owner.meta)).status).toBe("DRAFT");
  });
  it("S18: another business gets 404 and an audit row for every discount action", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const a = await approvedMerchant(t, admin, "IT Cross A"); const b = await approvedMerchant(t, admin, "IT Cross B");
    const p = await createPremise(t.deps, a.owner.ctx, premiseBody, a.owner.meta);
    const dsc = await createDiscount(t.deps, a.owner.ctx, discountBody([p.id]), a.owner.meta);
    const attempts = [
      () => getDiscount(t.deps, b.owner.ctx, dsc.id, b.owner.meta), () => updateDiscount(t.deps, b.owner.ctx, dsc.id, { isOnline: true }, b.owner.meta),
      () => transitionDiscount(t.deps, b.owner.ctx, dsc.id, "publish", b.owner.meta), () => duplicateDiscount(t.deps, b.owner.ctx, dsc.id, b.owner.meta),
      () => extendValidity(t.deps, b.owner.ctx, dsc.id, { validTo: "2030-01-01" }, b.owner.meta), () => previewDiscount(t.deps, b.owner.ctx, dsc.id, "en", b.owner.meta),
    ];
    for (const attempt of attempts) expect(await code(attempt())).toBe("NOT_FOUND");
    expect(await db.auditLog.count({ where: { action: "permission.denied", actorEmail: b.owner.email, entityId: dsc.id } })).toBe(6);
    expect((await listDiscounts(t.deps, b.owner.ctx, {}, b.owner.meta)).items).toHaveLength(0);
    expect(await code(deleteDiscount(t.deps, a.owner.ctx, dsc.id, a.owner.meta))).toBe("FORBIDDEN"); // hard delete: admin only
    await deleteDiscount(t.deps, admin.ctx, dsc.id, admin.meta);
    expect(await db.discount.findUnique({ where: { id: dsc.id } })).toBeNull();
  });
  it("expiry is computed at read time, persisted by the daily job, and extending returns it as PAUSED (BR-R2)", async () => {
    const clock = mutableClock("2026-11-04T11:00:00Z"); const t = makeDeps(clock); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Expiry Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const dsc = await createDiscount(t.deps, owner.ctx, discountBody([p.id], { validFrom: "2026-11-01", validTo: "2026-11-10" }), owner.meta);
    await transitionDiscount(t.deps, owner.ctx, dsc.id, "publish", owner.meta);
    clock.advance(6 * 24 * 3_600_000 + 10 * 3_600_000); // Nov 10 21:00 UTC = 23:00 Maputo: still valid
    expect((await getDiscount(t.deps, owner.ctx, dsc.id, owner.meta)).effectiveStatus).toBe("PUBLISHED");
    clock.advance(3_600_000); // Nov 11 00:00 Maputo
    expect((await getDiscount(t.deps, owner.ctx, dsc.id, owner.meta)).effectiveStatus).toBe("EXPIRED");
    expect((await listDiscounts(t.deps, owner.ctx, { status: "EXPIRED" }, owner.meta)).items.map((x) => x.id)).toEqual([dsc.id]);
    expect((await listDiscounts(t.deps, owner.ctx, { status: "PUBLISHED" }, owner.meta)).items).toHaveLength(0);
    expect(await code(updateDiscount(t.deps, owner.ctx, dsc.id, { isOnline: true }, owner.meta))).toBe("INVALID_STATE");
    expect((await expireDueDiscounts(t.deps)).expired).toBeGreaterThanOrEqual(1);
    expect((await db.discount.findUniqueOrThrow({ where: { id: dsc.id } })).status).toBe("EXPIRED");
    expect(await code(extendValidity(t.deps, owner.ctx, dsc.id, { validTo: "2026-11-05" }, owner.meta))).toBe("BAD_DATES");
    const ext = await extendValidity(t.deps, owner.ctx, dsc.id, { validTo: "2026-12-31" }, owner.meta);
    expect(ext).toMatchObject({ status: "PAUSED", effectiveStatus: "PAUSED" });
    expect((await transitionDiscount(t.deps, owner.ctx, dsc.id, "publish", owner.meta)).effectiveStatus).toBe("PUBLISHED");
  });
  it("duplicate copies as a draft; bulk actions report each id", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Bulk Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const one = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    await transitionDiscount(t.deps, owner.ctx, one.id, "publish", owner.meta);
    const copy = await duplicateDiscount(t.deps, owner.ctx, one.id, owner.meta);
    expect(copy).toMatchObject({ status: "DRAFT", titleEn: "IT Lunch with your card (copy)" });
    expect(copy.eligibility).toHaveLength(4); expect(copy.premises).toHaveLength(1);
    const res = await bulkDiscounts(t.deps, owner.ctx, { action: "publish", ids: [copy.id, one.id, "does-not-exist"] }, owner.meta);
    expect(res).toEqual([{ id: copy.id, ok: true }, { id: one.id, ok: false, code: "INVALID_STATE" }, { id: "does-not-exist", ok: false, code: "NOT_FOUND" }]);
    expect((await bulkDiscounts(t.deps, owner.ctx, { action: "extend", ids: [copy.id], validTo: "2027-12-31" }, owner.meta))[0]?.ok).toBe(true);
    expect((await bulkDiscounts(t.deps, owner.ctx, { action: "archive", ids: [copy.id, one.id] }, owner.meta)).every((r) => r.ok)).toBe(true);
    expect((await listDiscounts(t.deps, owner.ctx, { status: "ARCHIVED" }, owner.meta)).items).toHaveLength(2);
    expect((await listDiscounts(t.deps, owner.ctx, { q: "lunch", premiseId: p.id, cardProductId: "cp-bci-gold" }, owner.meta)).items).toHaveLength(2);
    expect((await listDiscounts(t.deps, owner.ctx, { walletId: "wl-emola" }, owner.meta)).items).toHaveLength(0);
  });
  it("preview reads like the app card and notification, in PT and EN (BR-R8)", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner } = await approvedMerchant(t, admin, "IT Preview Co");
    const p = await createPremise(t.deps, owner.ctx, { ...premiseBody, name: "IT Polana Spa" }, owner.meta);
    const dsc = await createDiscount(t.deps, owner.ctx, { title: { pt: "IT 15% no Spa", en: "IT 15% at the Spa" }, premiseIds: [p.id], validTo: "2026-12-31", eligibility: [{ scope: "CARD_PRODUCT", cardProductId: "cp-absa-wealth", benefit: "PERCENT", value: 15 }, { scope: "ANY_BANK_CARD", benefit: "PERCENT", value: 3 }] }, owner.meta);
    const en = await previewDiscount(t.deps, owner.ctx, dsc.id, "en", owner.meta);
    expect(en.notification).toEqual({ title: "15% off at IT Polana Spa", body: "With your Absa Wealth. Valid until 2026-12-31. + 1 more offers" });
    const pt = await previewDiscount(t.deps, owner.ctx, dsc.id, "pt", owner.meta);
    expect(pt.notification.title).toBe("15% de desconto no IT Polana Spa");
    expect(pt.card).toMatchObject({ title: "IT 15% no Spa", benefit: "15% de desconto", moreOffers: 1, validUntil: "2026-12-31" });
    const general = await createDiscount(t.deps, owner.ctx, { title: { pt: "IT Natal", en: "IT Xmas" }, premiseIds: [p.id], eligibility: [{ scope: "GENERAL", benefit: "FIXED", valueMzn: 500, minSpendMzn: 3000 }], terms: { pt: "Mínimo 3000 MT", en: "Minimum 3000 MT" } }, owner.meta);
    expect((await previewDiscount(t.deps, owner.ctx, general.id, "en", owner.meta)).notification).toEqual({ title: "Offer near you: 500 MT off at IT Polana Spa", body: "Minimum 3000 MT" });
  });
  it("BR-R11: suspending a business pauses all its published discounts", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const { owner, biz } = await approvedMerchant(t, admin, "IT Suspend Co");
    const p = await createPremise(t.deps, owner.ctx, premiseBody, owner.meta);
    const live = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    const draft = await createDiscount(t.deps, owner.ctx, discountBody([p.id]), owner.meta);
    await transitionDiscount(t.deps, owner.ctx, live.id, "publish", owner.meta);
    await suspendBusiness(t.deps, admin.ctx, biz.id, { reason: "Policy breach" }, admin.meta);
    expect((await getDiscount(t.deps, admin.ctx, live.id, admin.meta)).status).toBe("PAUSED");
    expect((await getDiscount(t.deps, admin.ctx, draft.id, admin.meta)).status).toBe("DRAFT");
    expect(await db.auditLog.count({ where: { action: "discount.pause_all", entityId: biz.id } })).toBe(1);
    expect(await code(transitionDiscount(t.deps, owner.ctx, live.id, "publish", owner.meta))).toBe("FORBIDDEN");
    expect(await code(createPremise(t.deps, owner.ctx, premiseBody, owner.meta))).toBe("BUSINESS_SUSPENDED");
  });
});
