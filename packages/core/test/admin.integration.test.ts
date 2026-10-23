import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AppError, approveBusiness, authenticate, createBusiness, createCatalogueItem, createUser, deactivateCatalogueItem, deleteUser,
  forcePasswordReset, getBusiness, getUser, listBusinesses, listCatalogue, listUsers, login, reactivateUser, rejectBusiness,
  reinstateBusiness, resetPassword, submitBusiness, suspendBusiness, suspendUser, updateBusiness, updateCatalogueItem, updateUser,
} from "../src";
import { STRONG, cleanup, cleanupBusinesses, db, makeCaller, makeDeps, tokenFromMail } from "./helpers";

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; return "OK"; } catch (e) { return e instanceof AppError ? e.code : e instanceof Error ? e.name : "?"; }
}
const complete = { contactEmail: "info@it-biz.test", contactPhone: "+258841234567", address: "Av. Marginal 1, Maputo" };

beforeAll(async () => { await cleanup(); await cleanupBusinesses(); });
afterAll(async () => { await cleanupBusinesses(); await cleanup(); await db.$disconnect(); });

describe("BR-2.1 catalogue (admin CRUD, public read)", () => {
  it("admin creates, updates (audited before/after) and deactivates; public sees only active", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const row = await createCatalogueItem(t.deps, admin.ctx, "issuers", { name: "IT Banco Teste", shortName: "IT BT" }, admin.meta);
    expect((await listCatalogue(t.deps, "issuers")).some((r) => r.id === row.id)).toBe(true);
    await updateCatalogueItem(t.deps, admin.ctx, "issuers", row.id, { shortName: "IT BT2" }, admin.meta);
    const a = await db.auditLog.findFirst({ where: { action: "catalogue.issuers.update", entityId: row.id } });
    expect(a?.changes).toMatchObject({ before: { shortName: "IT BT" }, after: { shortName: "IT BT2" } });
    await deactivateCatalogueItem(t.deps, admin.ctx, "issuers", row.id, admin.meta);
    expect((await listCatalogue(t.deps, "issuers")).some((r) => r.id === row.id)).toBe(false);
    expect((await listCatalogue(t.deps, "issuers", true)).some((r) => r.id === row.id)).toBe(true);
    expect(await db.issuer.findUnique({ where: { id: row.id } })).not.toBeNull(); // BR-R9: never hard-deleted
  });
  it("owner and user cannot write; denial is audited", async () => {
    const t = makeDeps(); const owner = await makeCaller(t, "BUSINESS_OWNER"); const user = await makeCaller(t, "USER");
    expect(await code(createCatalogueItem(t.deps, owner.ctx, "issuers", { name: "IT x", shortName: "x" }, owner.meta))).toBe("FORBIDDEN");
    expect(await code(createCatalogueItem(t.deps, user.ctx, "card-networks", { name: "IT x" }, user.meta))).toBe("FORBIDDEN");
    expect(await db.auditLog.count({ where: { action: "permission.denied", actorEmail: owner.email } })).toBe(1);
  });
  it("validates: unknown issuer, http logo, unknown fields", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const base = { networkId: "net-visa", cardType: "DEBIT", segment: "Classic", name: "IT Card" };
    expect(await code(createCatalogueItem(t.deps, admin.ctx, "card-products", { ...base, issuerId: "iss-nope" }, admin.meta))).toBe("UNKNOWN_ISSUER");
    expect(await code(createCatalogueItem(t.deps, admin.ctx, "issuers", { name: "IT y", shortName: "y", logoUrl: "http://x.test/a.png" }, admin.meta))).toBe("ZodError");
    expect(await code(createCatalogueItem(t.deps, admin.ctx, "issuers", { name: "IT z", shortName: "z", dataOrigin: "REAL" }, admin.meta))).toBe("ZodError");
    const ok = await createCatalogueItem(t.deps, admin.ctx, "card-products", { ...base, issuerId: "iss-absa" }, admin.meta);
    expect(ok.dataOrigin).toBe("REAL");
    await db.cardProduct.delete({ where: { id: ok.id } });
  });
});

describe("BR-6 business profiles and BR-12 approval", () => {
  it("each of the three types can be created, edited and submitted", async () => {
    const t = makeDeps();
    for (const [type, link] of [["BANK", { issuerId: "iss-bci" }], ["WALLET_PROVIDER", { walletProviderId: "wl-emola" }], ["MERCHANT", {}]] as const) {
      const o = await makeCaller(t, "BUSINESS_OWNER");
      const b = await createBusiness(t.deps, o.ctx, { type, tradingName: `IT ${type}`, ...link }, o.meta);
      expect(b.status).toBe("DRAFT");
      await updateBusiness(t.deps, o.ctx, b.id, { description: "desc", ...complete }, o.meta);
      expect((await submitBusiness(t.deps, o.ctx, b.id, o.meta)).status).toBe("PENDING_APPROVAL");
    }
  });
  it("link rules: bank needs issuer, wallet needs wallet, merchant has none; one business per account; users cannot create", async () => {
    const t = makeDeps(); const o = await makeCaller(t, "BUSINESS_OWNER"); const u = await makeCaller(t, "USER");
    const mk = (x: object) => code(createBusiness(t.deps, o.ctx, { tradingName: "IT bad", ...x }, o.meta));
    expect(await mk({ type: "BANK" })).toBe("BAD_LINK");
    expect(await mk({ type: "WALLET_PROVIDER", issuerId: "iss-bci" })).toBe("BAD_LINK");
    expect(await mk({ type: "MERCHANT", issuerId: "iss-bci" })).toBe("BAD_LINK");
    expect(await mk({ type: "BANK", issuerId: "iss-unknown" })).toBe("UNKNOWN_ISSUER");
    expect(await mk({ type: "MERCHANT", id: "x" })).toBe("ZodError");
    expect(await mk({ type: "MERCHANT" })).toBe("OK");
    expect(await mk({ type: "MERCHANT" })).toBe("ALREADY_HAS_BUSINESS");
    expect(await code(createBusiness(t.deps, u.ctx, { type: "MERCHANT", tradingName: "IT u" }, u.meta))).toBe("FORBIDDEN");
  });
  it("submit needs a complete profile; links lock after submit", async () => {
    const t = makeDeps(); const o = await makeCaller(t, "BUSINESS_OWNER");
    const b = await createBusiness(t.deps, o.ctx, { type: "BANK", tradingName: "IT lock", issuerId: "iss-bci" }, o.meta);
    expect(await code(submitBusiness(t.deps, o.ctx, b.id, o.meta))).toBe("INCOMPLETE_PROFILE");
    await updateBusiness(t.deps, o.ctx, b.id, complete, o.meta);
    await submitBusiness(t.deps, o.ctx, b.id, o.meta);
    expect(await code(updateBusiness(t.deps, o.ctx, b.id, { issuerId: "iss-absa" }, o.meta))).toBe("INVALID_STATE");
    expect(await code(submitBusiness(t.deps, o.ctx, b.id, o.meta))).toBe("INVALID_STATE");
  });
  it("tenant isolation: another owner gets 404 (not 403) and an audit row; admin can read", async () => {
    const t = makeDeps(); const a = await makeCaller(t, "BUSINESS_OWNER"); const b = await makeCaller(t, "BUSINESS_OWNER"); const admin = await makeCaller(t, "ADMIN");
    const biz = await createBusiness(t.deps, a.ctx, { type: "MERCHANT", tradingName: "IT tenant" }, a.meta);
    expect(await code(getBusiness(t.deps, b.ctx, biz.id, b.meta))).toBe("NOT_FOUND");
    expect(await code(updateBusiness(t.deps, b.ctx, biz.id, { description: "hack" }, b.meta))).toBe("NOT_FOUND");
    expect(await code(submitBusiness(t.deps, b.ctx, biz.id, b.meta))).toBe("NOT_FOUND");
    expect(await code(getBusiness(t.deps, b.ctx, "' OR 1=1 --", b.meta))).toBe("NOT_FOUND");
    expect(await db.auditLog.count({ where: { action: "permission.denied", actorEmail: b.email, entityId: biz.id } })).toBe(3);
    expect((await db.business.findUnique({ where: { id: biz.id } }))!.description).toBeNull();
    expect((await getBusiness(t.deps, admin.ctx, biz.id, admin.meta)).id).toBe(biz.id);
  });
  it("approve/reject/suspend/reinstate workflow with emails and audit", async () => {
    const t = makeDeps(); const o = await makeCaller(t, "BUSINESS_OWNER"); const admin = await makeCaller(t, "ADMIN");
    const b = await createBusiness(t.deps, o.ctx, { type: "MERCHANT", tradingName: "IT flow", ...complete }, o.meta);
    expect(await code(approveBusiness(t.deps, admin.ctx, b.id, admin.meta))).toBe("INVALID_STATE"); // still a draft
    await submitBusiness(t.deps, o.ctx, b.id, o.meta);
    expect(await code(approveBusiness(t.deps, o.ctx, b.id, o.meta))).toBe("FORBIDDEN");
    expect(await code(rejectBusiness(t.deps, admin.ctx, b.id, { reason: "no" }, admin.meta))).toBe("ZodError");
    await rejectBusiness(t.deps, admin.ctx, b.id, { reason: "Missing <b>NUIT</b> document" }, admin.meta);
    const mail = t.mailer.sent.find((m) => m.to === o.email && /not approved/i.test(m.subject))!;
    expect(mail.html).toContain("&lt;b&gt;NUIT&lt;/b&gt;"); // reason is HTML-escaped
    expect((await db.business.findUnique({ where: { id: b.id } }))!.rejectionReason).toContain("NUIT");
    await submitBusiness(t.deps, o.ctx, b.id, o.meta); // rejected profiles can resubmit
    const ok = await approveBusiness(t.deps, admin.ctx, b.id, admin.meta);
    expect(ok).toMatchObject({ status: "APPROVED", approvedBy: admin.ctx.user.id, rejectionReason: null });
    expect(t.mailer.sent.some((m) => m.to === o.email && /approved/i.test(m.subject) && !/not/i.test(m.subject))).toBe(true);
    expect(await code(approveBusiness(t.deps, admin.ctx, b.id, admin.meta))).toBe("INVALID_STATE");
    await suspendBusiness(t.deps, admin.ctx, b.id, { reason: "Complaint received" }, admin.meta);
    expect((await reinstateBusiness(t.deps, admin.ctx, b.id, admin.meta)).status).toBe("APPROVED");
    const actions = (await db.auditLog.findMany({ where: { entityId: b.id } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["business.create", "business.submit", "business.reject", "business.approve", "business.suspend", "business.reinstate"]));
  });
  it("admin list filters by status and search; others are refused", async () => {
    const t = makeDeps(); const o = await makeCaller(t, "BUSINESS_OWNER"); const admin = await makeCaller(t, "ADMIN");
    await createBusiness(t.deps, o.ctx, { type: "MERCHANT", tradingName: "IT findme" }, o.meta);
    const r = await listBusinesses(t.deps, admin.ctx, { status: "DRAFT", q: "it findme" }, admin.meta);
    expect(r.items.length).toBeGreaterThanOrEqual(1);
    expect(r.items.every((x) => x.status === "DRAFT")).toBe(true);
    expect(await code(listBusinesses(t.deps, o.ctx, {}, o.meta))).toBe("FORBIDDEN");
    expect(await code(listBusinesses(t.deps, admin.ctx, { status: "'; DROP TABLE businesses;--" }, admin.meta))).toBe("ZodError");
  });
});

describe("BR-2.1 admin user management", () => {
  it("list/search/filter/view; non-admin refused", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN"); const user = await makeCaller(t, "USER");
    const r = await listUsers(t.deps, admin.ctx, { q: user.email.slice(0, 12), role: "USER", limit: 5 }, admin.meta);
    expect(r.items.some((u) => u.email === user.email)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/passwordHash|mfaSecret/);
    const one = await getUser(t.deps, admin.ctx, user.ctx.user.id, admin.meta);
    expect(one.recentLogins.length).toBeGreaterThan(0);
    expect(await code(listUsers(t.deps, user.ctx, {}, user.meta))).toBe("FORBIDDEN");
  });
  it("create sends a verification email; duplicate refused", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN");
    const email = `it-created-${Date.now()}@mozdiscounts.test`;
    const u = await createUser(t.deps, admin.ctx, { email, firstName: "N", lastName: "U", role: "USER" }, admin.meta);
    expect(u.status).toBe("PENDING_VERIFICATION");
    expect(t.mailer.sent.some((m) => m.to === email)).toBe(true);
    expect(await code(createUser(t.deps, admin.ctx, { email, firstName: "N", lastName: "U", role: "USER" }, admin.meta))).toBe("EMAIL_TAKEN");
  });
  it("role change revokes sessions and is audited; cannot change own role", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN"); const user = await makeCaller(t, "USER");
    await updateUser(t.deps, admin.ctx, user.ctx.user.id, { role: "BUSINESS_OWNER", firstName: "Renamed" }, admin.meta);
    expect(await code(authenticate(t.deps, { cookieToken: user.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
    expect(await db.auditLog.count({ where: { action: "admin.user.role_change", entityId: user.ctx.user.id } })).toBe(1);
    expect(await code(updateUser(t.deps, admin.ctx, admin.ctx.user.id, { role: "USER" }, admin.meta))).toBe("SELF_ROLE_CHANGE");
  });
  it("suspend blocks login and kills sessions; reactivate restores; cannot suspend self", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN"); const user = await makeCaller(t, "USER");
    await suspendUser(t.deps, admin.ctx, user.ctx.user.id, { reason: "abuse" }, admin.meta);
    expect(await code(authenticate(t.deps, { cookieToken: user.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
    expect(await code(login(t.deps, { email: user.email, password: STRONG }, user.meta))).toBe("INVALID_CREDENTIALS");
    await reactivateUser(t.deps, admin.ctx, user.ctx.user.id, admin.meta);
    expect(await code(login(t.deps, { email: user.email, password: STRONG }, user.meta))).toBe("OK");
    expect(await code(suspendUser(t.deps, admin.ctx, admin.ctx.user.id, {}, admin.meta))).toBe("SELF_ACTION");
  });
  it("force reset invalidates the old password and sessions and emails a working link", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN"); const user = await makeCaller(t, "USER");
    await forcePasswordReset(t.deps, admin.ctx, user.ctx.user.id, admin.meta);
    expect(await code(login(t.deps, { email: user.email, password: STRONG }, user.meta))).toBe("INVALID_CREDENTIALS");
    const token = tokenFromMail(t.mailer.sent.at(-1)!.html);
    await resetPassword(t.deps, { token, password: "Brand-New-Passw0rd!" }, user.meta);
    expect(await code(login(t.deps, { email: user.email, password: "Brand-New-Passw0rd!" }, user.meta))).toBe("OK");
  });
  it("delete anonymises the account", async () => {
    const t = makeDeps(); const admin = await makeCaller(t, "ADMIN"); const user = await makeCaller(t, "USER");
    await deleteUser(t.deps, admin.ctx, user.ctx.user.id, admin.meta);
    const u = await db.user.findUnique({ where: { id: user.ctx.user.id } });
    expect(u).toMatchObject({ status: "DELETED", firstName: "Deleted" });
    expect(u!.email).toMatch(/^deleted\+/);
    expect(await code(deleteUser(t.deps, admin.ctx, user.ctx.user.id, admin.meta))).toBe("INVALID_STATE");
    expect(await code(getUser(t.deps, admin.ctx, "not-a-uuid", admin.meta))).toBe("NOT_FOUND");
  });
});
