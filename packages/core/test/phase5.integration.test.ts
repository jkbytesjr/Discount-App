import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AppError, MemoryPushSender, addMyCard, addMyFavourite, addMyWallet, adminStats, approveBusiness, businessStats, createBusiness, createDiscount, createPremise,
  exportAlertEvents, exportAudit, exportBusinessReport, geofenceSync, getMyPrefs, getSettings, ingestAlertEvents, listAlertEvents, listAudit, listMyCards, listMyFavourites,
  listMyWallets, myAlertEvents, myBundle, putMyPrefs, registerPushToken, removeMyCard, removeMyFavourite, removeMyWallet, submitBusiness, transitionDiscount, updateBusiness,
  updateDiscount, updateSettings,
} from "../src";
import { cleanup, cleanupBusinesses, db, makeCaller, makeDeps } from "./helpers";

async function code(p: Promise<unknown>): Promise<string> { try { await p; return "OK"; } catch (e) { return e instanceof AppError ? e.code : e instanceof Error ? e.name : "?"; } }
const complete = { contactEmail: "info@it-biz.test", contactPhone: "+258841234567", address: "Av. Marginal 1, Maputo" };
const sheet = async (buf: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as never); return wb.worksheets[0]!; };
const ev = (o: Record<string, unknown>) => ({ clientEventId: randomUUID(), type: "DELIVERED", premiseId: "x", discountIds: [], occurredAt: "2026-11-04T11:00:00Z", ...o });

const t = makeDeps();
t.deps.push = new MemoryPushSender();
const push = t.deps.push as MemoryPushSender;
let admin: Awaited<ReturnType<typeof makeCaller>>, owner: typeof admin, user: typeof admin, user2: typeof admin;
let premiseId: string, discountId: string, bizId: string;

beforeAll(async () => {
  await cleanup(); await cleanupBusinesses();
  admin = await makeCaller(t, "ADMIN"); owner = await makeCaller(t, "BUSINESS_OWNER"); user = await makeCaller(t, "USER"); user2 = await makeCaller(t, "USER");
  const biz = await createBusiness(t.deps, owner.ctx, { type: "MERCHANT", tradingName: "IT Stats Co" }, owner.meta);
  bizId = biz.id;
  await updateBusiness(t.deps, owner.ctx, biz.id, complete, owner.meta); await submitBusiness(t.deps, owner.ctx, biz.id, owner.meta); await approveBusiness(t.deps, admin.ctx, biz.id, admin.meta);
  premiseId = (await createPremise(t.deps, owner.ctx, { categoryId: "restaurant", name: "IT Stats Premise", lat: -25.95, lng: 32.6 }, owner.meta)).id;
  const dsc = await createDiscount(t.deps, owner.ctx, { title: { pt: "IT Oferta", en: "IT Offer" }, premiseIds: [premiseId], eligibility: [{ scope: "ANY_BANK_CARD", benefit: "PERCENT", value: 10 }], terms: { pt: "Condições", en: "Terms" } }, owner.meta);
  discountId = dsc.id;
  await transitionDiscount(t.deps, owner.ctx, discountId, "publish", owner.meta);
});
afterAll(async () => {
  await db.alertEvent.deleteMany({ where: { premiseId } }); await cleanupBusinesses(); await cleanup();
  await db.systemSetting.deleteMany({ where: { key: { startsWith: "cfg." } } }); await db.$disconnect();
});

describe("BR-3 audit trail UI and Excel export", () => {
  it("admin lists with filters and cursor; business owner and users are refused", async () => {
    const all = await listAudit(t.deps, admin.ctx, { limit: "5" }, admin.meta);
    expect(all.items).toHaveLength(5); expect(all.nextCursor).not.toBeNull();
    const next = await listAudit(t.deps, admin.ctx, { limit: "5", cursor: all.nextCursor! }, admin.meta);
    expect(next.items.map((x) => x.id)).not.toContain(all.items[0]!.id);
    const pub = await listAudit(t.deps, admin.ctx, { action: "discount.publish", entityId: discountId }, admin.meta);
    expect(pub.items).toHaveLength(1);
    expect((await listAudit(t.deps, admin.ctx, { actor: owner.email, from: "2020-01-01", to: "2099-01-01" }, admin.meta)).items.length).toBeGreaterThan(3);
    expect((await listAudit(t.deps, admin.ctx, { from: "2099-01-01" }, admin.meta)).items).toEqual([]);
    expect(await code(listAudit(t.deps, owner.ctx, {}, owner.meta))).toBe("FORBIDDEN");
    expect(await code(listAudit(t.deps, user.ctx, {}, user.meta))).toBe("FORBIDDEN");
    expect(await code(listAudit(t.deps, admin.ctx, { sql: "1" }, admin.meta))).toBe("ZodError");
  });
  it("export is an .xlsx with the audit rows, is itself audited, and defuses formulas", async () => {
    await createPremise(t.deps, owner.ctx, { categoryId: "restaurant", name: "=HYPERLINK(\"http://evil.test\",\"x\")" }, owner.meta);
    const r = await exportAudit(t.deps, admin.ctx, { action: "premise.create", actor: owner.email }, admin.meta);
    expect(r.rows).toBeGreaterThanOrEqual(2);
    const ws = await sheet(r.file);
    expect(ws.getRow(1).getCell(1).value).toBe("Time (Maputo)");
    const summaries = [...Array(ws.rowCount - 1)].map((_, i) => String(ws.getRow(i + 2).getCell(10).value ?? ""));
    expect(summaries.some((s) => s.includes("HYPERLINK"))).toBe(true);
    expect(summaries.every((s) => !s.startsWith("="))).toBe(true); // changes JSON starts with "{": the name never leads a cell
    expect(await db.auditLog.count({ where: { action: "audit.export", actorEmail: admin.email } })).toBe(1);
    expect(await code(exportAudit(t.deps, owner.ctx, {}, owner.meta))).toBe("FORBIDDEN");
  });
});

describe("BR-10 alert events", () => {
  it("devices post events; the same clientEventId is stored once; coarse location only", async () => {
    const a = ev({ premiseId, discountIds: [discountId], type: "DELIVERED", distanceM: 120, lat: -25.94781, lng: 32.61333 });
    const res = await ingestAlertEvents(t.deps, user.ctx, { events: [a, ev({ premiseId, discountIds: [discountId], type: "OPENED" }), ev({ premiseId: "pr-unknown-xyz" })] }, user.meta);
    expect(res).toMatchObject({ received: 3, stored: 2, unknownPremise: 1 });
    expect(await ingestAlertEvents(t.deps, user.ctx, { events: [a] }, user.meta)).toMatchObject({ stored: 0, duplicates: 1 }); // offline queue retry
    const row = await db.alertEvent.findUniqueOrThrow({ where: { clientEventId: a.clientEventId } });
    expect(row).toMatchObject({ userId: user.ctx.user.id, coarseLat: -25.948, coarseLng: 32.613, distanceM: 120 });
  });
  it("validates: reason rules, future events, batch size, unknown fields", async () => {
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [ev({ premiseId, type: "SUPPRESSED" })] }, user.meta))).toBe("REASON_REQUIRED");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [ev({ premiseId, type: "OPENED", reason: "COOLDOWN" })] }, user.meta))).toBe("REASON_NOT_ALLOWED");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [ev({ premiseId, occurredAt: "2099-01-01T00:00:00Z" })] }, user.meta))).toBe("FUTURE_EVENT");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [] }, user.meta))).toBe("ZodError");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: Array.from({ length: 51 }, () => ev({ premiseId })) }, user.meta))).toBe("ZodError");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [{ ...ev({ premiseId }), userId: "someone-else" }] }, user.meta))).toBe("ZodError");
    expect(await code(ingestAlertEvents(t.deps, user.ctx, { events: [ev({ premiseId, type: "SUPPRESSED", reason: "COOLDOWN" })] }, user.meta))).toBe("OK");
  });
  it("admin sees all events and exports them; owners and users do not see raw logs; users see their own history", async () => {
    await ingestAlertEvents(t.deps, user2.ctx, { events: [ev({ premiseId, discountIds: [discountId], type: "DETAIL_VIEWED" })] }, user2.meta);
    const list = await listAlertEvents(t.deps, admin.ctx, { premiseId }, admin.meta);
    expect(list.items.length).toBeGreaterThanOrEqual(4);
    expect(new Set(list.items.map((e) => e.userId))).toEqual(new Set([user.ctx.user.id, user2.ctx.user.id]));
    expect((await listAlertEvents(t.deps, admin.ctx, { type: "OPENED", discountId }, admin.meta)).items.every((e) => e.type === "OPENED")).toBe(true);
    expect(await code(listAlertEvents(t.deps, owner.ctx, {}, owner.meta))).toBe("FORBIDDEN");
    expect(await code(exportAlertEvents(t.deps, owner.ctx, {}, owner.meta))).toBe("FORBIDDEN");
    const mine = await myAlertEvents(t.deps, user.ctx, {}, user.meta);
    expect(mine.items.every((e) => e.userId === user.ctx.user.id)).toBe(true);
    const xl = await exportAlertEvents(t.deps, admin.ctx, { premiseId }, admin.meta);
    const ws = await sheet(xl.file);
    expect(ws.getRow(1).getCell(2).value).toBe("Type"); expect(ws.rowCount - 1).toBe(xl.rows);
  });
});

describe("BR-12 stats (POC scope)", () => {
  it("business stats count views, alerts sent, opened and favourites without personal data", async () => {
    await addMyFavourite(t.deps, user.ctx, discountId, user.meta);
    const s = await businessStats(t.deps, owner.ctx, { days: "30" }, owner.meta);
    const row = s.discounts.find((x) => x.id === discountId)!;
    expect(row).toMatchObject({ alertsSent: 1, alertsOpened: 1, impressions: 1, favourites: 1, openRatePct: 100 });
    expect(s.totals).toMatchObject({ alertsSent: 1, alertsOpened: 1 });
    expect(s.series).toHaveLength(30);
    expect(JSON.stringify(s)).not.toContain(user.email); expect(JSON.stringify(s)).not.toContain(user.ctx.user.id);
    expect(await code(businessStats(t.deps, user.ctx, {}, user.meta))).toBe("FORBIDDEN");
    const other = await makeCaller(t, "BUSINESS_OWNER");
    expect(await code(businessStats(t.deps, other.ctx, {}, other.meta))).toBe("NO_BUSINESS");
    expect(await code(businessStats(t.deps, other.ctx, { businessId: bizId }, other.meta))).toBe("NO_BUSINESS");
    expect((await businessStats(t.deps, admin.ctx, { businessId: bizId }, admin.meta)).business.id).toBe(bizId);
  });
  it("report export is an .xlsx with one row per discount", async () => {
    const ws = await sheet((await exportBusinessReport(t.deps, owner.ctx, {}, owner.meta)).file);
    expect(ws.getRow(1).getCell(1).value).toBe("Discount (PT)");
    expect(ws.getRow(2).getCell(1).value).toBe("IT Oferta");
    expect(ws.getRow(2).getCell(6).value).toBe(1);
  });
  it("admin stats: totals, alert counts and series", async () => {
    const s = await adminStats(t.deps, admin.ctx, { days: "14" }, admin.meta);
    expect(s.users).toMatchObject({ ADMIN: expect.any(Number), USER: expect.any(Number) });
    expect(s.alerts.delivered).toBeGreaterThanOrEqual(1);
    expect(s.series).toHaveLength(14);
    expect(s.favourites).toBeGreaterThanOrEqual(1);
    expect(await code(adminStats(t.deps, owner.ctx, {}, owner.meta))).toBe("FORBIDDEN");
  });
});

describe("IOS-5 / IOS-7 cards, wallets, preferences, favourites", () => {
  it("cards: add, duplicate, unknown, remove; another person's id is 404; only app users", async () => {
    const c = await addMyCard(t.deps, user2.ctx, { cardProductId: "cp-absa-wealth", nickname: "Principal" }, user2.meta);
    expect(await code(addMyCard(t.deps, user2.ctx, { cardProductId: "cp-absa-wealth" }, user2.meta))).toBe("ALREADY_ADDED");
    expect(await code(addMyCard(t.deps, user2.ctx, { cardProductId: "cp-nope" }, user2.meta))).toBe("UNKNOWN_CARD_PRODUCT");
    expect(await code(addMyCard(t.deps, user2.ctx, { cardProductId: "cp-bci-gold", lastFour: "1234" }, user2.meta))).toBe("ZodError"); // never store card digits
    expect(await code(addMyCard(t.deps, user2.ctx, { cardProductId: "cp-bci-gold", pan: "4111111111111111" }, user2.meta))).toBe("ZodError");
    expect((await listMyCards(t.deps, user2.ctx, user2.meta))[0]).toMatchObject({ name: "Absa Wealth Visa Crédito", issuerName: "Absa", cardType: "CREDIT", segment: "Wealth", nickname: "Principal" });
    expect(await code(removeMyCard(t.deps, user.ctx, c.id, user.meta))).toBe("NOT_FOUND");
    await removeMyCard(t.deps, user2.ctx, c.id, user2.meta);
    expect(await listMyCards(t.deps, user2.ctx, user2.meta)).toEqual([]);
    expect(await code(addMyCard(t.deps, owner.ctx, { cardProductId: "cp-bci-gold" }, owner.meta))).toBe("FORBIDDEN");
    expect(await code(listMyCards(t.deps, admin.ctx, admin.meta))).toBe("FORBIDDEN");
  });
  it("wallets and the one-call bundle", async () => {
    await addMyWallet(t.deps, user2.ctx, { walletProviderId: "wl-mpesa" }, user2.meta);
    expect(await code(addMyWallet(t.deps, user2.ctx, { walletProviderId: "wl-mpesa" }, user2.meta))).toBe("ALREADY_ADDED");
    expect(await code(addMyWallet(t.deps, user2.ctx, { walletProviderId: "wl-nope" }, user2.meta))).toBe("UNKNOWN_WALLET");
    await addMyCard(t.deps, user2.ctx, { cardProductId: "cp-bci-gold" }, user2.meta);
    expect(await myBundle(t.deps, user2.ctx, user2.meta)).toMatchObject({ cards: [{ cardProductId: "cp-bci-gold" }], wallets: [{ walletProviderId: "wl-mpesa" }], prefs: { mode: "PERSONALISED", alertsEnabled: true }, favouriteIds: [] });
    await removeMyWallet(t.deps, user2.ctx, "wl-mpesa", user2.meta);
    expect(await listMyWallets(t.deps, user2.ctx, user2.meta)).toEqual([]);
    expect(await code(removeMyWallet(t.deps, user2.ctx, "wl-mpesa", user2.meta))).toBe("NOT_FOUND");
  });
  it("alert preferences validate quiet hours and catalogue ids", async () => {
    expect(await getMyPrefs(t.deps, user2.ctx, user2.meta)).toMatchObject({ mode: "PERSONALISED", quietFrom: null });
    const p = await putMyPrefs(t.deps, user2.ctx, { mode: "PERSONALISED_PLUS_GENERAL", quietFrom: "22:00", quietTo: "07:00", generalIssuers: ["iss-absa"], alertsEnabled: true }, user2.meta);
    expect(p).toMatchObject({ mode: "PERSONALISED_PLUS_GENERAL", quietFrom: "22:00", generalIssuers: ["iss-absa"] });
    expect(await code(putMyPrefs(t.deps, user2.ctx, { quietFrom: "22:00" }, user2.meta))).toBe("ZodError");
    expect(await code(putMyPrefs(t.deps, user2.ctx, { quietFrom: "25:00", quietTo: "07:00" }, user2.meta))).toBe("ZodError");
    expect(await code(putMyPrefs(t.deps, user2.ctx, { mode: "EVERYTHING" }, user2.meta))).toBe("ZodError");
    expect(await code(putMyPrefs(t.deps, user2.ctx, { generalIssuers: ["iss-nope"] }, user2.meta))).toBe("UNKNOWN_ISSUER");
    expect(await putMyPrefs(t.deps, user2.ctx, { quietFrom: null, quietTo: null }, user2.meta)).toMatchObject({ quietFrom: null });
  });
  it("favourites: published offers only; list and remove", async () => {
    const draft = await createDiscount(t.deps, owner.ctx, { title: { pt: "IT Rascunho", en: "IT Draft" } }, owner.meta);
    expect(await code(addMyFavourite(t.deps, user2.ctx, draft.id, user2.meta))).toBe("NOT_FOUND");
    expect(await code(addMyFavourite(t.deps, user2.ctx, "nope", user2.meta))).toBe("NOT_FOUND");
    await addMyFavourite(t.deps, user2.ctx, discountId, user2.meta); await addMyFavourite(t.deps, user2.ctx, discountId, user2.meta); // idempotent
    const l = await listMyFavourites(t.deps, user2.ctx, {}, user2.meta);
    expect(l.items).toMatchObject([{ id: discountId, status: "PUBLISHED", businessName: "IT Stats Co", premises: [{ name: "IT Stats Premise" }] }]);
    await removeMyFavourite(t.deps, user2.ctx, discountId, user2.meta);
    expect((await listMyFavourites(t.deps, user2.ctx, {}, user2.meta)).items).toEqual([]);
  });
});

describe("IOS-7 / BR-R7 favourite-update pushes", () => {
  it("a material edit pushes to the favouriter's device in their language; typos and disabled alerts do not", async () => {
    await db.user.update({ where: { id: user.ctx.user.id }, data: { locale: "pt-MZ" } });
    await registerPushToken(t.deps, user.ctx, { vendorId: "v-1", pushToken: "ab".repeat(32), appVersion: "1.0" }, user.meta);
    expect(await code(registerPushToken(t.deps, user.ctx, { vendorId: "v-2", pushToken: "not hex!" }, user.meta))).toBe("ZodError");
    push.sent.length = 0;
    await updateDiscount(t.deps, owner.ctx, discountId, { eligibility: [{ scope: "ANY_BANK_CARD", benefit: "PERCENT", value: 15 }] }, owner.meta);
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]).toMatchObject({ token: "ab".repeat(32), msg: { title: "IT Stats Premise: oferta actualizada", body: "Valor ou cartões alterados", data: { type: "favourite_update", discountId } } });
    push.sent.length = 0;
    await updateDiscount(t.deps, owner.ctx, discountId, { title: { pt: "IT Oferta!", en: "IT Offer!" }, description: { pt: "Texto novo", en: "New text" } }, owner.meta); // typo-level: title/description only
    expect(push.sent).toHaveLength(0);
    await putMyPrefs(t.deps, user.ctx, { alertsEnabled: false }, user.meta);
    await updateDiscount(t.deps, owner.ctx, discountId, { validTo: "2099-12-31" }, owner.meta);
    expect(push.sent).toHaveLength(0);
    await putMyPrefs(t.deps, user.ctx, { alertsEnabled: true }, user.meta);
    await transitionDiscount(t.deps, owner.ctx, discountId, "pause", owner.meta);
    expect(push.sent.map((p) => p.msg.body)).toEqual(["A oferta foi pausada"]);
    await db.user.update({ where: { id: user.ctx.user.id }, data: { locale: "en" } });
    push.sent.length = 0;
    await transitionDiscount(t.deps, owner.ctx, discountId, "publish", owner.meta);
    await updateDiscount(t.deps, owner.ctx, discountId, { validTo: "2100-12-31" }, owner.meta);
    expect(push.sent[0]!.msg).toMatchObject({ title: "IT Stats Premise: offer updated", body: "Validity changed" });
  });
  it("a push failure never fails the edit", async () => {
    const bad = makeDeps(); bad.deps.push = { send: async () => { throw new Error("APNs down"); } };
    await expect(updateDiscount(bad.deps, owner.ctx, discountId, { validTo: "2101-01-01" }, owner.meta)).resolves.toMatchObject({ id: discountId });
  });
});

describe("BR-R6 settings and demo mode", () => {
  it("admin changes settings within range; demo mode shortens the device cooldown to 5 minutes", async () => {
    expect(await getSettings(t.deps)).toMatchObject({ alertRadiusM: 150, cooldownHours: 12, dailyCap: 5, demoMode: false });
    expect((await geofenceSync(t.deps, { lat: "-25.95", lng: "32.6" })).body.settings).toMatchObject({ cooldownSeconds: 43_200, dailyCap: 5 });
    await updateSettings(t.deps, admin.ctx, { demoMode: true, dailyCap: 8 }, admin.meta);
    expect((await geofenceSync(t.deps, { lat: "-25.95", lng: "32.6" })).body.settings).toMatchObject({ cooldownSeconds: 300, dailyCap: 8, demoMode: true });
    expect(await code(updateSettings(t.deps, admin.ctx, { dailyCap: 99 }, admin.meta))).toBe("ZodError");
    expect(await code(updateSettings(t.deps, admin.ctx, { alertRadiusM: 10 }, admin.meta))).toBe("ZodError");
    expect(await code(updateSettings(t.deps, owner.ctx, { dailyCap: 3 }, owner.meta))).toBe("FORBIDDEN");
    expect(await db.auditLog.count({ where: { action: "settings.update" } })).toBeGreaterThanOrEqual(1);
  });
});
