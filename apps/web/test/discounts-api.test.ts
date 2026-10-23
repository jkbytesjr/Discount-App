import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@moz/core";
import { getDb } from "@moz/db";
import { POST as login } from "../app/api/v1/auth/login/route";
import { GET as premisesGet, POST as premisesPost } from "../app/api/v1/premises/route";
import { GET as premiseGet, PATCH as premisePatch, DELETE as premiseDelete } from "../app/api/v1/premises/[id]/route";
import { POST as importPost } from "../app/api/v1/premises/import/route";
import { GET as discountsGet, POST as discountsPost } from "../app/api/v1/discounts/route";
import { GET as discountGet, PATCH as discountPatch, DELETE as discountDelete } from "../app/api/v1/discounts/[id]/route";
import { POST as publishPost } from "../app/api/v1/discounts/[id]/publish/route";
import { POST as pausePost } from "../app/api/v1/discounts/[id]/pause/route";
import { POST as archivePost } from "../app/api/v1/discounts/[id]/archive/route";
import { POST as duplicatePost } from "../app/api/v1/discounts/[id]/duplicate/route";
import { POST as extendPost } from "../app/api/v1/discounts/[id]/extend/route";
import { GET as previewGet } from "../app/api/v1/discounts/[id]/preview/route";
import { POST as bulkPost } from "../app/api/v1/discounts/bulk/route";
import { GET as purgeGet } from "../app/api/v1/cron/purge/route";

const db = getDb();
const PW = "Str0ng-Passw0rd!";
const tag = Date.now().toString(36);
const ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const emails = { a: `it-dsc-a-${tag}@mozdiscounts.test`, b: `it-dsc-b-${tag}@mozdiscounts.test`, p: `it-dsc-p-${tag}@mozdiscounts.test` };

type Session = { cookie: string; csrf: string };
const H = (s?: Session) => ({ "content-type": "application/json", "x-forwarded-for": ip, ...(s ? { cookie: s.cookie, "x-csrf-token": s.csrf } : {}) });
const call = (h: any, method: string, s?: Session, body?: unknown, params?: Record<string, string>, url = "http://localhost/x") =>
  h(new Request(url, { method, headers: H(s), body: body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve(params ?? {}) }) as Promise<Response>;

async function signIn(email: string): Promise<Session> {
  const res = await login(new Request("http://localhost/x", { method: "POST", headers: H(), body: JSON.stringify({ email, password: PW }) }));
  expect(res.status).toBe(200);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0]!, csrf: (await res.json()).csrfToken };
}
async function mkOwner(email: string, name: string, status: "APPROVED" | "PENDING_APPROVAL") {
  const u = await db.user.create({ data: { email, role: "BUSINESS_OWNER", firstName: "W", lastName: "Owner", passwordHash: await hashPassword(PW), status: "ACTIVE", emailVerifiedAt: new Date() } });
  const biz = await db.business.create({ data: { type: "MERCHANT", tradingName: name, status, dataOrigin: "REAL", members: { create: { userId: u.id } } } });
  return biz.id;
}
const cleanDb = async () => {
  await db.discount.deleteMany({ where: { business: { tradingName: { startsWith: "IT dsc" } } } });
  await db.premise.deleteMany({ where: { business: { tradingName: { startsWith: "IT dsc" } } } });
  await db.business.deleteMany({ where: { tradingName: { startsWith: "IT dsc" } } });
  await db.user.deleteMany({ where: { email: { startsWith: "it-dsc-" } } });
};

let a: Session, b: Session, p: Session, premiseId: string, discountId: string;
const discount = () => ({
  title: { pt: "IT dsc Almoço", en: "IT dsc Lunch" }, premiseIds: [premiseId], validFrom: "2026-09-01", validTo: "2099-12-31",
  schedule: { days: ["MON", "TUE", "WED", "THU", "FRI"], from: "12:00", to: "15:00" },
  eligibility: [{ scope: "CARD_PRODUCT", cardProductId: "cp-absa-wealth", benefit: "PERCENT", value: 12 }, { scope: "WALLET", walletId: "wl-mpesa", benefit: "PERCENT", value: 5 }],
});

beforeAll(async () => {
  await cleanDb(); await db.rateLimit.deleteMany({});
  await mkOwner(emails.a, "IT dsc A", "APPROVED"); await mkOwner(emails.b, "IT dsc B", "APPROVED"); await mkOwner(emails.p, "IT dsc Pending", "PENDING_APPROVAL");
  a = await signIn(emails.a); b = await signIn(emails.b); p = await signIn(emails.p);
});
afterAll(async () => { await cleanDb(); await db.$disconnect(); });

describe("premises over HTTP (BR-8)", () => {
  it("anonymous is 401; owner creates (201), reads, edits; bad input is problem+json 422", async () => {
    expect((await call(premisesGet, "GET")).status).toBe(401);
    const created = await call(premisesPost, "POST", a, { categoryId: "restaurant", name: "IT dsc Marisco", city: "Maputo", lat: -25.948, lng: 32.613 });
    expect(created.status).toBe(201);
    premiseId = (await created.json()).id;
    expect((await call(premiseGet, "GET", a, undefined, { id: premiseId })).status).toBe(200);
    expect((await (await call(premisePatch, "PATCH", a, { alertRadiusM: 250 }, { id: premiseId })).json()).alertRadiusM).toBe(250);
    const bad = await call(premisesPost, "POST", a, { categoryId: "restaurant", name: "x", alertRadiusM: 5000 });
    expect(bad.status).toBe(422); expect(bad.headers.get("content-type")).toContain("problem+json");
    expect((await (await call(premisesPost, "POST", a, { categoryId: "restaurant", name: "x", lat: 51.5, lng: -0.1 })).json()).code).toBe("OUTSIDE_MOZAMBIQUE");
    expect((await call(premisesPost, "POST", a, { categoryId: "restaurant", name: "x", ownerId: "someone" })).status).toBe(422); // unknown field
  });
  it("another business gets 404 for read, edit and delete; a pending business may still create premises", async () => {
    expect((await call(premiseGet, "GET", b, undefined, { id: premiseId })).status).toBe(404);
    expect((await call(premisePatch, "PATCH", b, { name: "IT dsc hacked" }, { id: premiseId })).status).toBe(404);
    expect((await call(premiseDelete, "DELETE", b, undefined, { id: premiseId })).status).toBe(403); // hard delete: admin only
    expect((await db.premise.findUnique({ where: { id: premiseId } }))!.name).toBe("IT dsc Marisco");
    expect(await db.auditLog.count({ where: { action: "permission.denied", entityId: premiseId } })).toBeGreaterThanOrEqual(2);
    expect((await call(premisesPost, "POST", p, { categoryId: "cafe-bakery", name: "IT dsc Pending Café" })).status).toBe(201);
    expect((await (await call(premisesGet, "GET", b)).json()).items).toEqual([]);
  });
  it("CSV import reports line errors without saving, then imports", async () => {
    const bad = await (await call(importPost, "POST", b, { csv: "name,category,lat,lng\nIT dsc One,restaurant,-25.9,32.5\nIT dsc Two,nope,-25.9,32.5\n" })).json();
    expect(bad).toMatchObject({ created: 0, errors: [{ line: 3 }] });
    const ok = await (await call(importPost, "POST", b, { csv: "name,category,lat,lng\nIT dsc One,restaurant,-25.9,32.5\n" })).json();
    expect(ok.created).toBe(1);
    expect((await call(importPost, "POST", b, { csv: "x,y\n1,2" })).status).toBe(422);
  });
});

describe("discounts over HTTP (BR-7, BR-9)", () => {
  it("create (201) -> get -> edit -> preview -> publish -> pause -> publish -> archive", async () => {
    const created = await call(discountsPost, "POST", a, discount());
    expect(created.status).toBe(201);
    const dto = await created.json();
    discountId = dto.id;
    expect(dto).toMatchObject({ status: "DRAFT", effectiveStatus: "DRAFT" });
    expect(dto.eligibility).toHaveLength(2);
    expect((await call(discountsPost, "POST", a, { ...discount(), status: "PUBLISHED" })).status).toBe(422);
    expect((await (await call(discountPatch, "PATCH", a, { title: { pt: "IT dsc Novo", en: "IT dsc New" } }, { id: discountId })).json()).titleEn).toBe("IT dsc New");
    const prev = await (await call(previewGet, "GET", a, undefined, { id: discountId }, "http://localhost/x?lang=en")).json();
    expect(prev.notification.title).toBe("12% off at IT dsc Marisco");
    expect((await call(publishPost, "POST", a, undefined, { id: discountId })).status).toBe(200);
    expect((await call(publishPost, "POST", a, undefined, { id: discountId })).status).toBe(409);
    expect((await (await call(pausePost, "POST", a, undefined, { id: discountId })).json()).status).toBe("PAUSED");
    expect((await call(publishPost, "POST", a, undefined, { id: discountId })).status).toBe(200);
    expect((await call(archivePost, "POST", a, undefined, { id: discountId })).status).toBe(200);
  });
  it("S17: a pending business saves a draft but its publish is 403", async () => {
    const pr = await (await call(premisesGet, "GET", p)).json();
    const d = await call(discountsPost, "POST", p, { ...discount(), premiseIds: [pr.items[0].id] });
    expect(d.status).toBe(201);
    const id = (await d.json()).id;
    const res = await call(publishPost, "POST", p, undefined, { id });
    expect(res.status).toBe(403);
    expect((await db.discount.findUnique({ where: { id } }))!.status).toBe("DRAFT");
  });
  it("S18: another business cannot read, edit, publish, extend or delete (404 / 403) and sees an empty list", async () => {
    for (const [h, m, body] of [[discountGet, "GET"], [discountPatch, "PATCH", { isOnline: true }], [publishPost, "POST"], [duplicatePost, "POST"], [extendPost, "POST", { validTo: "2100-01-01" }]] as const) {
      expect((await call(h, m, b, body, { id: discountId })).status).toBe(404);
    }
    expect((await call(previewGet, "GET", b, undefined, { id: discountId })).status).toBe(404);
    expect((await call(discountDelete, "DELETE", b, undefined, { id: discountId })).status).toBe(403);
    expect((await (await call(discountsGet, "GET", b)).json()).items).toEqual([]);
    expect((await db.discount.findUnique({ where: { id: discountId } }))!.status).toBe("ARCHIVED");
    expect(await db.auditLog.count({ where: { action: "permission.denied", entityId: discountId } })).toBeGreaterThanOrEqual(6);
  });
  it("list filters, duplicate, bulk and extend", async () => {
    const list = await (await call(discountsGet, "GET", a, undefined, undefined, "http://localhost/x?status=ARCHIVED&q=novo&cardProductId=cp-absa-wealth")).json();
    expect(list.items.map((x: { id: string }) => x.id)).toEqual([discountId]);
    expect((await call(discountsGet, "GET", a, undefined, undefined, "http://localhost/x?status=BOGUS")).status).toBe(422);
    const copy = await (await call(duplicatePost, "POST", a, undefined, { id: discountId })).json();
    expect(copy).toMatchObject({ status: "DRAFT" });
    const { results } = await (await call(bulkPost, "POST", a, { action: "publish", ids: [copy.id, discountId] })).json();
    expect(results).toEqual([{ id: copy.id, ok: true }, { id: discountId, ok: false, code: "INVALID_STATE" }]);
    expect((await call(bulkPost, "POST", a, { action: "extend", ids: [copy.id] })).status).toBe(422);
    expect((await call(extendPost, "POST", a, { validTo: "2099-12-31" }, { id: copy.id })).status).toBe(422); // not later than current
    expect((await (await call(extendPost, "POST", a, { validTo: "2100-06-30" }, { id: copy.id })).json()).validTo).toContain("2100-06-30");
  });
  it("the daily cron needs its secret and also persists expired discounts", async () => {
    expect((await call(purgeGet, "GET")).status).toBe(401);
    process.env.CRON_SECRET = "cron-test-secret";
    const old = await db.discount.create({ data: { businessId: (await db.business.findFirstOrThrow({ where: { tradingName: "IT dsc A" } })).id, titlePt: "IT dsc velho", titleEn: "IT dsc old", status: "PUBLISHED", validTo: new Date("2020-01-01T00:00:00Z") } });
    const res = await purgeGet(new Request("http://localhost/x", { headers: { authorization: "Bearer cron-test-secret", "x-forwarded-for": ip } }));
    expect(res.status).toBe(200);
    expect((await res.json()).expired).toBeGreaterThanOrEqual(1);
    expect((await db.discount.findUnique({ where: { id: old.id } }))!.status).toBe("EXPIRED");
  });
});
