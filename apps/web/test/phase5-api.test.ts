import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@moz/core";
import { getDb } from "@moz/db";
import { POST as login } from "../app/api/v1/auth/login/route";
import { POST as eventsPost } from "../app/api/v1/alerts/events/route";
import { GET as bundleGet } from "../app/api/v1/me/bundle/route";
import { GET as cardsGet, POST as cardsPost } from "../app/api/v1/me/cards/route";
import { DELETE as cardDelete } from "../app/api/v1/me/cards/[id]/route";
import { POST as walletsPost } from "../app/api/v1/me/wallets/route";
import { PUT as prefsPut } from "../app/api/v1/me/alert-preferences/route";
import { PUT as favPut, DELETE as favDelete } from "../app/api/v1/me/favourites/[id]/route";
import { GET as favsGet } from "../app/api/v1/me/favourites/route";
import { PUT as pushPut } from "../app/api/v1/me/push-token/route";
import { GET as myAlertsGet } from "../app/api/v1/me/alerts/route";
import { GET as auditGet } from "../app/api/v1/admin/audit/route";
import { GET as auditExport } from "../app/api/v1/admin/audit/export/route";
import { GET as adminAlerts } from "../app/api/v1/admin/alerts/route";
import { GET as adminSettings } from "../app/api/v1/admin/settings/route";
import { GET as adminStats } from "../app/api/v1/admin/stats/route";
import { GET as bizStats } from "../app/api/v1/businesses/me/stats/route";
import { GET as bizReport } from "../app/api/v1/businesses/me/report/route";

const db = getDb();
const PW = "Str0ng-Passw0rd!";
const tag = Date.now().toString(36);
const ip = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const emails = { user: `it-p5-u-${tag}@mozdiscounts.test`, owner: `it-p5-o-${tag}@mozdiscounts.test` };
type Session = { cookie: string; csrf: string };
const H = (s?: Session, extra: Record<string, string> = {}) => ({ "content-type": "application/json", "x-forwarded-for": ip, ...(s ? { cookie: s.cookie, "x-csrf-token": s.csrf } : {}), ...extra });
const call = (h: any, method: string, s?: Session, body?: unknown, params?: Record<string, string>, url = "http://localhost/x") =>
  h(new Request(url, { method, headers: H(s), body: body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve(params ?? {}) }) as Promise<Response>;
async function signIn(email: string): Promise<Session> {
  const res = await login(new Request("http://localhost/x", { method: "POST", headers: H(), body: JSON.stringify({ email, password: PW }) }));
  expect(res.status).toBe(200);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0]!, csrf: (await res.json()).csrfToken };
}
let user: Session, owner: Session, premiseId: string, discountId: string;

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "it-p5-" } } }); await db.business.deleteMany({ where: { tradingName: { startsWith: "IT p5" } } }); await db.rateLimit.deleteMany({});
  const h = await hashPassword(PW);
  await db.user.create({ data: { email: emails.user, role: "USER", firstName: "P", lastName: "U", passwordHash: h, status: "ACTIVE", emailVerifiedAt: new Date() } });
  const o = await db.user.create({ data: { email: emails.owner, role: "BUSINESS_OWNER", firstName: "P", lastName: "O", passwordHash: h, status: "ACTIVE", emailVerifiedAt: new Date() } });
  const biz = await db.business.create({ data: { type: "MERCHANT", tradingName: "IT p5 Co", status: "APPROVED", dataOrigin: "REAL", members: { create: { userId: o.id } } } });
  const p = await db.premise.create({ data: { businessId: biz.id, categoryId: "restaurant", name: "IT p5 Premise", lat: -25.95, lng: 32.6 } });
  premiseId = p.id;
  const d = await db.discount.create({ data: { businessId: biz.id, titlePt: "IT p5 Oferta", titleEn: "IT p5 Offer", status: "PUBLISHED", publishedAt: new Date(), premises: { create: { premiseId } }, eligibility: { create: { scope: "GENERAL", benefit: "BOGO" } } } });
  discountId = d.id;
  user = await signIn(emails.user); owner = await signIn(emails.owner);
});
afterAll(async () => {
  await db.alertEvent.deleteMany({ where: { premiseId } }); await db.discount.deleteMany({ where: { id: discountId } }); await db.premise.deleteMany({ where: { id: premiseId } });
  await db.business.deleteMany({ where: { tradingName: { startsWith: "IT p5" } } }); await db.user.deleteMany({ where: { email: { startsWith: "it-p5-" } } }); await db.$disconnect();
});

describe("user data over HTTP (IOS-5, IOS-7)", () => {
  it("anonymous is 401; a business account is 403; the user manages cards, wallets, preferences, favourites", async () => {
    expect((await call(bundleGet, "GET")).status).toBe(401);
    expect((await call(cardsGet, "GET", owner)).status).toBe(403);
    const added = await call(cardsPost, "POST", user, { cardProductId: "cp-bci-gold" });
    expect(added.status).toBe(201);
    expect((await call(cardsPost, "POST", user, { cardProductId: "cp-bci-gold" })).status).toBe(409);
    expect((await call(cardsPost, "POST", user, { cardProductId: "cp-bci-bio", pan: "4111111111111111" })).status).toBe(422); // never accept card digits
    expect((await call(walletsPost, "POST", user, { walletProviderId: "wl-mpesa" })).status).toBe(201);
    expect((await call(prefsPut, "PUT", user, { mode: "ALL", quietFrom: "22:00", quietTo: "07:00" })).status).toBe(200);
    expect((await call(prefsPut, "PUT", user, { quietFrom: "22:00" })).status).toBe(422);
    expect((await call(favPut, "PUT", user, undefined, { id: discountId })).status).toBe(200);
    const b = await (await call(bundleGet, "GET", user)).json();
    expect(b).toMatchObject({ cards: [{ cardProductId: "cp-bci-gold" }], wallets: [{ walletProviderId: "wl-mpesa" }], prefs: { mode: "ALL", quietFrom: "22:00" }, favouriteIds: [discountId] });
    expect((await (await call(favsGet, "GET", user)).json()).items[0].id).toBe(discountId);
    expect((await call(favDelete, "DELETE", user, undefined, { id: discountId })).status).toBe(204);
    const cardId = (await (await call(cardsGet, "GET", user)).json())[0].id;
    expect((await call(cardDelete, "DELETE", owner, undefined, { id: cardId })).status).toBe(403);
    expect((await call(cardDelete, "DELETE", user, undefined, { id: cardId })).status).toBe(204);
  });
  it("registers a push token (hex only) and never echoes it", async () => {
    const r = await call(pushPut, "PUT", user, { vendorId: "dev-1", pushToken: "cd".repeat(32) });
    expect(r.status).toBe(200); expect(JSON.stringify(await r.json())).not.toContain("cdcdcd");
    expect((await call(pushPut, "PUT", user, { vendorId: "dev-1", pushToken: "<script>" })).status).toBe(422);
  });
});

describe("alert events over HTTP (BR-10)", () => {
  it("accepts a batch (202), stores a repeated clientEventId once, and the user sees their history", async () => {
    const e = { clientEventId: randomUUID(), type: "OPENED", premiseId, discountIds: [discountId], occurredAt: new Date().toISOString(), lat: -25.94781, lng: 32.61333, distanceM: 90 };
    const first = await call(eventsPost, "POST", user, { events: [e, { ...e, clientEventId: randomUUID(), type: "DELIVERED" }] });
    expect(first.status).toBe(202); expect(await first.json()).toMatchObject({ received: 2, stored: 2 });
    expect(await (await call(eventsPost, "POST", user, { events: [e] })).json()).toMatchObject({ stored: 0, duplicates: 1 });
    expect((await call(eventsPost, "POST", undefined, { events: [e] })).status).toBe(401);
    expect((await call(eventsPost, "POST", user, { events: [{ ...e, clientEventId: "not-a-uuid" }] })).status).toBe(422);
    expect((await (await call(myAlertsGet, "GET", user)).json()).items.length).toBeGreaterThanOrEqual(2);
  });
  it("admin-only endpoints are 403 for businesses and users; business stats are counts only", async () => {
    for (const h of [auditGet, auditExport, adminAlerts, adminSettings, adminStats]) {
      expect((await call(h, "GET", owner)).status).toBe(403); expect((await call(h, "GET", user)).status).toBe(403); expect((await call(h, "GET")).status).toBe(401);
    }
    const s = await (await call(bizStats, "GET", owner)).json();
    expect(s.discounts.find((x: { id: string }) => x.id === discountId)).toMatchObject({ alertsSent: 1, alertsOpened: 1 });
    expect(JSON.stringify(s)).not.toContain(emails.user);
    const x = await call(bizReport, "GET", owner);
    expect(x.status).toBe(200);
    expect(x.headers.get("content-type")).toContain("spreadsheetml"); expect(x.headers.get("content-disposition")).toContain("discount-report.xlsx");
    expect((await x.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect((await call(bizReport, "GET", user)).status).toBe(403);
  });
});
