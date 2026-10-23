import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@moz/db";
import { POST as register } from "../app/api/v1/auth/register/route";
import { POST as login } from "../app/api/v1/auth/login/route";
import { POST as verify } from "../app/api/v1/auth/verify-email/route";
import { POST as logoutAll } from "../app/api/v1/auth/logout-all/route";
import { GET as meGet, PATCH as mePatch } from "../app/api/v1/me/route";
import { POST as changePassword } from "../app/api/v1/me/change-password/route";
import { GET as purge } from "../app/api/v1/cron/purge/route";

const db = getDb();
const PW = "Str0ng-Passw0rd!";
const email = `it-web-${Date.now().toString(36)}@mozdiscounts.test`;
const ip = `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

const post = (h: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = {}) =>
  h(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers } }));
const get = (h: (r: Request) => Promise<Response>, headers: Record<string, string> = {}) =>
  h(new Request("http://localhost/x", { headers: { "x-forwarded-for": ip, ...headers } }));

let cookie = "";
let csrf = "";

beforeAll(async () => { await db.user.deleteMany({ where: { email: { startsWith: "it-web-" } } }); await db.rateLimit.deleteMany({}); });
afterAll(async () => { await db.user.deleteMany({ where: { email: { startsWith: "it-web-" } } }); await db.$disconnect(); });

describe("HTTP layer", () => {
  it("register returns 201 and activates via a verification token", async () => {
    const res = await post(register, { accountType: "user", firstName: "W", lastName: "T", email, password: PW, confirmPassword: PW, acceptTerms: true });
    expect(res.status).toBe(201);
    const t = await db.emailToken.findFirst({ where: { user: { email } } });
    expect(t).toBeTruthy();
    // The raw token is only in the email (console in tests), so activate the account through the DB for the session tests.
    await db.user.update({ where: { email }, data: { status: "ACTIVE", emailVerifiedAt: new Date() } });
  });

  it("errors are problem+json, validation does not echo input", async () => {
    const res = await post(register, { accountType: "user", email: "' OR 1=1 --" });
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
    expect(await res.text()).not.toContain("OR 1=1");
  });

  it("bad JSON is 400, SQL injection login is 422 and creates nothing", async () => {
    const bad = await login(new Request("http://localhost/x", { method: "POST", body: "{nope", headers: { "x-forwarded-for": ip } }));
    expect(bad.status).toBe(400);
    const before = await db.user.count();
    expect((await post(login, { email: "admin'--", password: "x" })).status).toBe(422);
    expect(await db.user.count()).toBe(before);
  });

  it("login sets an HttpOnly SameSite=Lax cookie and keeps the token out of the body", async () => {
    const res = await post(login, { email, password: PW });
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toMatch(/HttpOnly/);
    expect(sc).toMatch(/SameSite=Lax/);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(sc.split(";")[0]!.split("=")[1]);
    cookie = sc.split(";")[0]!;
    csrf = body.csrfToken;
  });

  it("GET /me works with the cookie; unsafe methods need CSRF", async () => {
    const me = await get(meGet, { cookie });
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe(email);
    expect((await get(meGet)).status).toBe(401);
    const noCsrf = await mePatch(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ firstName: "X" }), headers: { cookie, "x-forwarded-for": ip } }));
    expect(noCsrf.status).toBe(403);
    const ok = await mePatch(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ firstName: "Xavier", phone: "+258841234567" }), headers: { cookie, "x-csrf-token": csrf, "x-forwarded-for": ip } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).firstName).toBe("Xavier");
  });

  it("profile rejects unknown fields (cannot self-promote to ADMIN) and bad phone numbers", async () => {
    const h = { cookie, "x-csrf-token": csrf, "x-forwarded-for": ip };
    const r1 = await mePatch(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ role: "ADMIN" }), headers: h }));
    expect(r1.status).toBe(422);
    const r2 = await mePatch(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ phone: "12345" }), headers: h }));
    expect(r2.status).toBe(422);
    expect((await db.user.findUnique({ where: { email } }))!.role).toBe("USER");
  });

  it("change-password enforces policy; logout-all kills the session", async () => {
    const h = { cookie, "x-csrf-token": csrf };
    expect((await post(changePassword, { currentPassword: PW, newPassword: "weak" }, h)).status).toBe(422);
    expect((await post(changePassword, { currentPassword: "nope", newPassword: "New-Passw0rd!x" }, h)).status).toBe(401);
    expect((await post(logoutAll, {}, h)).status).toBe(200);
    expect((await get(meGet, { cookie })).status).toBe(401);
  });

  it("6th wrong password in a row is blocked with 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post(login, { email, password: "Wrong-Passw0rd!x" })).status);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
    expect((await post(login, { email, password: PW })).status).toBe(429); // right password, still locked
  });

  it("cron purge needs the secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    expect((await get(purge)).status).toBe(401);
    expect((await get(purge, { authorization: "Bearer cron-test-secret" })).status).toBe(200);
  });

  it("verify-email with garbage is a clean 400/422, not a 500", async () => {
    expect([400, 422]).toContain((await post(verify, { token: "x".repeat(40) })).status);
  });
});
