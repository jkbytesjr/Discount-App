import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateSync } from "otplib";
import { hashPassword } from "@moz/core";
import { getDb } from "@moz/db";
import { POST as login } from "../app/api/v1/auth/login/route";
import { POST as mfaSetup } from "../app/api/v1/auth/mfa/setup/route";
import { POST as mfaVerify } from "../app/api/v1/auth/mfa/verify/route";
import { GET as issuersGet, POST as issuersPost } from "../app/api/v1/issuers/route";
import { PATCH as issuerPatch, DELETE as issuerDelete } from "../app/api/v1/issuers/[id]/route";
import { POST as businessPost } from "../app/api/v1/businesses/route";
import { GET as businessGet, PATCH as businessPatch } from "../app/api/v1/businesses/[id]/route";
import { POST as submitPost } from "../app/api/v1/businesses/[id]/submit/route";
import { GET as adminBusinesses } from "../app/api/v1/admin/businesses/route";
import { POST as approvePost } from "../app/api/v1/admin/businesses/[id]/approve/route";
import { POST as rejectPost } from "../app/api/v1/admin/businesses/[id]/reject/route";
import { GET as adminUsers } from "../app/api/v1/admin/users/route";
import { POST as suspendPost } from "../app/api/v1/admin/users/[id]/suspend/route";

const db = getDb();
const PW = "Str0ng-Passw0rd!";
const tag = Date.now().toString(36);
const ip = `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const emails = { admin: `it-web-adm-${tag}@mozdiscounts.test`, ownerA: `it-web-a-${tag}@mozdiscounts.test`, ownerB: `it-web-b-${tag}@mozdiscounts.test` };

type Session = { cookie: string; csrf: string };
const H = (s?: Session, extra: Record<string, string> = {}) => ({ "content-type": "application/json", "x-forwarded-for": ip, ...(s ? { cookie: s.cookie, "x-csrf-token": s.csrf } : {}), ...extra });
const call = (h: any, method: string, s?: Session, body?: unknown, params?: Record<string, string>, url = "http://localhost/x") =>
  h(new Request(url, { method, headers: H(s), body: body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve(params ?? {}) }) as Promise<Response>;

async function signIn(email: string): Promise<Session> {
  const res = await login(new Request("http://localhost/x", { method: "POST", headers: H(), body: JSON.stringify({ email, password: PW }) }));
  expect(res.status).toBe(200);
  return { cookie: res.headers.get("set-cookie")!.split(";")[0]!, csrf: (await res.json()).csrfToken };
}
async function mkUser(email: string, role: "ADMIN" | "BUSINESS_OWNER") {
  await db.user.create({ data: { email, role, firstName: "W", lastName: role, passwordHash: await hashPassword(PW), status: "ACTIVE", emailVerifiedAt: new Date() } });
}

let admin: Session, a: Session, b: Session, bizId: string;

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "it-web-" } } });
  await db.business.deleteMany({ where: { tradingName: { startsWith: "IT web" } } });
  await db.issuer.deleteMany({ where: { name: { startsWith: "IT web" } } });
  await db.rateLimit.deleteMany({});
  await mkUser(emails.admin, "ADMIN"); await mkUser(emails.ownerA, "BUSINESS_OWNER"); await mkUser(emails.ownerB, "BUSINESS_OWNER");
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "it-web-" } } });
  await db.business.deleteMany({ where: { tradingName: { startsWith: "IT web" } } });
  await db.issuer.deleteMany({ where: { name: { startsWith: "IT web" } } });
  await db.$disconnect();
});

describe("admin 2FA gate (BR-1)", () => {
  it("an admin without 2FA is refused on admin APIs until setup is completed", async () => {
    admin = await signIn(emails.admin);
    expect((await call(adminUsers, "GET", admin)).status).toBe(403);
    expect((await call(adminUsers, "GET", admin)).headers.get("content-type")).toContain("problem+json");
    const { secret } = await (await call(mfaSetup, "POST", admin, {})).json();
    expect((await call(mfaVerify, "POST", admin, { code: "000000" })).status).toBe(401);
    expect((await call(mfaVerify, "POST", admin, { code: generateSync({ secret }) })).status).toBe(200);
    expect((await call(adminUsers, "GET", admin)).status).toBe(200);
  });
});

describe("catalogue over HTTP", () => {
  let issuerId: string;
  it("public list needs no login and is cacheable; anonymous write is 401; owner write is 403", async () => {
    const pub = await call(issuersGet, "GET");
    expect(pub.status).toBe(200);
    expect(pub.headers.get("cache-control")).toContain("max-age");
    expect((await pub.json()).length).toBeGreaterThanOrEqual(14);
    expect((await call(issuersPost, "POST", undefined, { name: "IT web x", shortName: "x" })).status).toBe(401);
    a = await signIn(emails.ownerA);
    expect((await call(issuersPost, "POST", a, { name: "IT web x", shortName: "x" })).status).toBe(403);
  });
  it("admin creates, updates, deactivates", async () => {
    const created = await call(issuersPost, "POST", admin, { name: "IT web Banco", shortName: "ITW" });
    expect(created.status).toBe(201);
    issuerId = (await created.json()).id;
    expect((await call(issuerPatch, "PATCH", admin, { shortName: "ITW2" }, { id: issuerId })).status).toBe(200);
    expect((await call(issuerDelete, "DELETE", admin, undefined, { id: issuerId })).status).toBe(200);
    const list = await (await call(issuersGet, "GET")).json();
    expect(list.some((i: { id: string }) => i.id === issuerId)).toBe(false);
  });
});

describe("business lifecycle over HTTP (J1 start)", () => {
  it("owner creates, completes and submits; a second owner cannot see it (404); admin approves", async () => {
    const created = await call(businessPost, "POST", a, { type: "MERCHANT", tradingName: "IT web Restaurante" });
    expect(created.status).toBe(201);
    bizId = (await created.json()).id;
    expect((await call(businessPatch, "PATCH", a, { contactEmail: "r@it.test", contactPhone: "+258841234567", address: "Av. Marginal" }, { id: bizId })).status).toBe(200);
    expect((await call(submitPost, "POST", a, undefined, { id: bizId })).status).toBe(200);

    b = await signIn(emails.ownerB);
    expect((await call(businessGet, "GET", b, undefined, { id: bizId })).status).toBe(404);
    expect((await call(businessPatch, "PATCH", b, { description: "hacked" }, { id: bizId })).status).toBe(404);
    expect((await call(approvePost, "POST", b, undefined, { id: bizId })).status).toBe(403);
    expect((await db.business.findUnique({ where: { id: bizId } }))!.description).toBeNull();

    const queue = await (await call(adminBusinesses, "GET", admin, undefined, undefined, "http://localhost/x?status=PENDING_APPROVAL&q=IT%20web")).json();
    expect(queue.items.map((x: { id: string }) => x.id)).toContain(bizId);
    expect((await call(rejectPost, "POST", admin, { reason: "no" }, { id: bizId })).status).toBe(422);
    expect((await call(approvePost, "POST", admin, undefined, { id: bizId })).status).toBe(200);
    expect((await call(approvePost, "POST", admin, undefined, { id: bizId })).status).toBe(409);
  });
  it("admin suspends a user; the suspended user's session stops working", async () => {
    const target = await db.user.findUnique({ where: { email: emails.ownerB } });
    expect((await call(suspendPost, "POST", admin, { reason: "test" }, { id: target!.id })).status).toBe(200);
    expect((await call(businessGet, "GET", b, undefined, { id: bizId })).status).toBe(401);
  });
});
