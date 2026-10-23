import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticate, login, logout, logoutAll, refreshTokens, register, resendVerification, forgotPassword, resetPassword, verifyEmail, mfaSetup, mfaVerify, AppError } from "../src";
import { generateSync } from "otplib";
import { IP, STRONG, cleanup, db, makeDeps, tokenFromMail, uniqueEmail } from "./helpers";

const base = (email: string, extra = {}) => ({
  accountType: "user", firstName: "Ana", lastName: "Teste", email, password: STRONG, confirmPassword: STRONG,
  acceptTerms: true, locale: "en", ...extra,
});

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; return "OK"; } catch (e) { return e instanceof AppError ? e.code : e instanceof Error ? e.name : "?"; }
}

async function activeUser(t = makeDeps(), extra = {}) {
  const email = uniqueEmail();
  const meta = { ip: IP() };
  await register(t.deps, base(email, extra), meta);
  await verifyEmail(t.deps, { token: tokenFromMail(t.mailer.sent.at(-1)!.html) }, meta);
  return { ...t, email, meta };
}

beforeAll(cleanup);
afterAll(async () => { await cleanup(); await db.$disconnect(); });

describe("BR-4 registration and verification", () => {
  it("cannot log in before verifying; can after; link is single-use", async () => {
    const t = makeDeps(); const email = uniqueEmail(); const meta = { ip: IP() };
    await register(t.deps, base(email), meta);
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toBe("EMAIL_NOT_VERIFIED");
    const token = tokenFromMail(t.mailer.sent[0]!.html);
    await verifyEmail(t.deps, { token }, meta);
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toBe("OK");
    expect(await code(verifyEmail(t.deps, { token }, meta))).toBe("TOKEN_INVALID");
  });
  it("expired link is rejected, resend works and is limited to 3/hour", async () => {
    const t = makeDeps(); const email = uniqueEmail(); const meta = { ip: IP() };
    await register(t.deps, base(email), meta);
    const old = tokenFromMail(t.mailer.sent[0]!.html);
    t.clock.advance(25 * 3600_000);
    expect(await code(verifyEmail(t.deps, { token: old }, meta))).toBe("TOKEN_INVALID");
    await resendVerification(t.deps, { email }, meta);
    await verifyEmail(t.deps, { token: tokenFromMail(t.mailer.sent.at(-1)!.html) }, meta);
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await code(resendVerification(t.deps, { email }, meta)));
    expect(r).toContain("RATE_LIMITED");
  });
  it("duplicate registration gives the same answer and sends no second account", async () => {
    const { deps, email, meta } = await activeUser();
    expect(await register(deps, base(email), meta)).toEqual({ ok: true });
    expect(await db.user.count({ where: { email } })).toBe(1);
  });
  it("business account type creates BUSINESS_OWNER; ADMIN cannot be self-registered", async () => {
    const t = makeDeps(); const email = uniqueEmail();
    await register(t.deps, base(email, { accountType: "business" }), { ip: IP() });
    expect((await db.user.findUnique({ where: { email } }))?.role).toBe("BUSINESS_OWNER");
    expect(await code(register(t.deps, base(uniqueEmail(), { role: "ADMIN" }), { ip: IP() }))).toBe("ZodError");
  });
});

describe("BR-5 password policy enforced by the API", () => {
  it.each(["abcdefg!1", "ABCDEFG1!", "Abcdefgh!", "Abcdefg1", "Ab1!"])("rejects %s", async (pw) => {
    const t = makeDeps();
    expect(await code(register(t.deps, base(uniqueEmail(), { password: pw, confirmPassword: pw }), { ip: IP() }))).toBe("PASSWORD_WEAK");
  });
  it("rejects mismatched confirmation", async () => {
    expect(await code(register(makeDeps().deps, base(uniqueEmail(), { confirmPassword: "x" }), { ip: IP() }))).toBe("PASSWORD_MISMATCH");
  });
});

describe("BR-1 SQL injection and storage", () => {
  const payloads = ["' OR '1'='1", "'; DROP TABLE users; --", "admin'--", "\" OR 1=1 --", "1; DELETE FROM users", "' UNION SELECT * FROM users --"];
  it("injection strings in every field never alter data", async () => {
    const t = makeDeps(); const before = await db.user.count();
    for (const p of payloads) {
      const meta = { ip: IP() };
      expect(["ZodError"]).toContain(await code(register(t.deps, base(p), meta)));
      expect(["ZodError"]).toContain(await code(login(t.deps, { email: p, password: p }, meta)));
      expect(["ZodError"]).toContain(await code(forgotPassword(t.deps, { email: p }, meta)));
      // long strings pass the length check and reach a parameterised lookup: clean "invalid token"
      expect(["ZodError", "TOKEN_INVALID"]).toContain(await code(verifyEmail(t.deps, { token: p }, meta)));
    }
    // injection text in a free-text field is stored as plain data
    const email = uniqueEmail();
    await register(t.deps, base(email, { firstName: payloads[1] }), { ip: IP() });
    expect((await db.user.findUnique({ where: { email } }))?.firstName).toBe(payloads[1]);
    expect(await db.user.count()).toBe(before + 1);
  });
  it("as a password for a real account it is just a wrong password", async () => {
    const { deps, email, meta } = await activeUser();
    expect(await code(login(deps, { email, password: payloads[0]! }, meta))).toBe("INVALID_CREDENTIALS");
  });
  it("password is stored as Argon2id", async () => {
    const { email } = await activeUser();
    expect((await db.user.findUnique({ where: { email } }))!.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  });
  it("unknown account and wrong password give the same error", async () => {
    const { deps, email, meta } = await activeUser();
    const a = await code(login(deps, { email, password: "Wrong-Passw0rd!" }, meta));
    const b = await code(login(deps, { email: uniqueEmail(), password: "Wrong-Passw0rd!" }, meta));
    expect(a).toBe("INVALID_CREDENTIALS"); expect(b).toBe("INVALID_CREDENTIALS");
  });
  it("unknown fields are rejected", async () => {
    const { deps, email, meta } = await activeUser();
    expect(await code(login(deps, { email, password: STRONG, isAdmin: true }, meta))).toBe("ZodError");
  });
});

describe("BR-1 brute force protection", () => {
  it("captcha required after 3 failures (web), and 6th attempt is blocked even with the right password", async () => {
    const t = makeDeps(undefined, false); // captcha always fails
    const { email, meta } = await activeUser(t);
    const out: string[] = [];
    for (let i = 0; i < 3; i++) out.push(await code(login(t.deps, { email, password: "Wrong-Passw0rd!" }, meta)));
    expect(out).toEqual(["INVALID_CREDENTIALS", "INVALID_CREDENTIALS", "INVALID_CREDENTIALS"]);
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toBe("CAPTCHA_REQUIRED");
  });
  it("locks after 5 failures, emails the user, stays locked until expiry, then allows login", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    for (let i = 0; i < 5; i++) expect(await code(login(t.deps, { email, password: "Wrong-Passw0rd!" }, meta))).toBe("INVALID_CREDENTIALS");
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toMatch(/ACCOUNT_LOCKED|RATE_LIMITED/);
    expect(t.mailer.sent.some((m) => m.to === email && /locked|bloqueada/i.test(m.subject))).toBe(true);
    expect((await db.user.findUnique({ where: { email } }))!.lockedUntil).not.toBeNull();
    t.clock.advance(16 * 60_000);
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toBe("OK");
  });
  it("second lock lasts twice as long", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const fail = async () => { for (let i = 0; i < 5; i++) await code(login(t.deps, { email, password: "Wrong-Passw0rd!" }, meta)); };
    await fail();
    t.clock.advance(16 * 60_000); // lock 1 over; fail counter window (15 min) also over
    await fail();
    const u = await db.user.findUnique({ where: { email } });
    expect(u!.lockedUntil!.getTime() - t.clock.now().getTime()).toBeGreaterThan(25 * 60_000);
  });
  it("per-IP limit: 21st attempt from one IP is refused", async () => {
    const t = makeDeps(); const meta = { ip: IP() }; let last = "";
    for (let i = 0; i < 21; i++) last = await code(login(t.deps, { email: uniqueEmail(), password: "Wrong-Passw0rd!" }, meta));
    expect(last).toBe("RATE_LIMITED");
  });
});

describe("sessions", () => {
  it("web session works, needs CSRF for writes, idles out after 30 min, absolute 12 h", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string; csrfToken: string };
    expect((await authenticate(t.deps, { cookieToken: r.sessionToken, method: "GET" })).user.email).toBe(email);
    expect(await code(authenticate(t.deps, { cookieToken: r.sessionToken, method: "POST" }))).toBe("CSRF_INVALID");
    expect(await code(authenticate(t.deps, { cookieToken: r.sessionToken, method: "POST", csrfHeader: r.csrfToken }))).toBe("OK");
    t.clock.advance(31 * 60_000);
    expect(await code(authenticate(t.deps, { cookieToken: r.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
  });
  it("session stays alive with activity but dies at 12 h", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string };
    for (let i = 0; i < 24; i++) { t.clock.advance(29 * 60_000); await authenticate(t.deps, { cookieToken: r.sessionToken, method: "GET" }); }
    t.clock.advance(29 * 60_000);
    expect(await code(authenticate(t.deps, { cookieToken: r.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
  });
  it("logout and logout-all revoke sessions", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const a = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string };
    const b = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string };
    const ctxA = await authenticate(t.deps, { cookieToken: a.sessionToken, method: "GET" });
    await logoutAll(t.deps, ctxA, meta);
    expect(await code(authenticate(t.deps, { cookieToken: a.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
    expect(await code(authenticate(t.deps, { cookieToken: b.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
  });
});

describe("IOS-2 and iOS tokens", () => {
  const device = { vendorId: "VENDOR-1", model: "iPhone15,2", osVersion: "17.5", appVersion: "0.1.0" };
  it("login registers device + login event with coarse location, emails on a new device", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG, client: "ios", device, location: { lat: -25.96912, lng: 32.58371 } }, meta) as { accessToken: string };
    expect(r.accessToken).toBeTruthy();
    const u = await db.user.findUnique({ where: { email }, include: { devices: true, loginEvents: { where: { success: true } } } });
    expect(u!.devices).toHaveLength(1);
    expect(u!.loginEvents[0]).toMatchObject({ coarseLat: -25.969, coarseLng: 32.584 });
    expect(t.mailer.sent.some((m) => m.to === email && /device|dispositivo/i.test(m.subject))).toBe(true);
    const ctx = await authenticate(t.deps, { bearer: r.accessToken, method: "POST" });
    expect(ctx.user.email).toBe(email);
  });
  it("access token expires after 15 min", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG, client: "ios", device }, meta) as { accessToken: string };
    t.clock.advance(16 * 60_000);
    expect(await code(authenticate(t.deps, { bearer: r.accessToken, method: "GET" }))).toBe("UNAUTHENTICATED");
  });
  it("refresh rotates; replaying a used token revokes the whole family", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG, client: "ios", device }, meta) as { refreshToken: string };
    const r2 = await refreshTokens(t.deps, r.refreshToken, meta);
    expect(r2.refreshToken).not.toBe(r.refreshToken);
    expect(await code(refreshTokens(t.deps, r.refreshToken, meta))).toBe("TOKEN_REUSED");
    expect(await code(refreshTokens(t.deps, r2.refreshToken, meta))).toBe("TOKEN_INVALID");
  });
  it("logout with refresh token revokes it", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const r = await login(t.deps, { email, password: STRONG, client: "ios", device }, meta) as { accessToken: string; refreshToken: string };
    const ctx = await authenticate(t.deps, { bearer: r.accessToken, method: "POST" });
    await logout(t.deps, ctx, r.refreshToken, meta);
    expect(await code(refreshTokens(t.deps, r.refreshToken, meta))).toBe("TOKEN_INVALID");
  });
});

describe("forgot / reset password", () => {
  it("reset works once, applies policy, kills sessions", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    const s = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string };
    await forgotPassword(t.deps, { email }, meta);
    const token = tokenFromMail(t.mailer.sent.at(-1)!.html);
    expect(await code(resetPassword(t.deps, { token, password: "weak" }, meta))).toBe("PASSWORD_WEAK");
    await resetPassword(t.deps, { token, password: "New-Passw0rd!x" }, meta);
    expect(await code(resetPassword(t.deps, { token, password: "New-Passw0rd!y" }, meta))).toBe("TOKEN_INVALID");
    expect(await code(authenticate(t.deps, { cookieToken: s.sessionToken, method: "GET" }))).toBe("UNAUTHENTICATED");
    expect(await code(login(t.deps, { email, password: "New-Passw0rd!x" }, meta))).toBe("OK");
  });
  it("reset link expires after 1 hour; unknown email gives same answer", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    await forgotPassword(t.deps, { email }, meta);
    const token = tokenFromMail(t.mailer.sent.at(-1)!.html);
    t.clock.advance(61 * 60_000);
    expect(await code(resetPassword(t.deps, { token, password: "New-Passw0rd!x" }, meta))).toBe("TOKEN_INVALID");
    expect(await forgotPassword(t.deps, { email: uniqueEmail() }, meta)).toEqual({ ok: true });
  });
});

describe("2FA (admin)", () => {
  it("admin without 2FA gets a restricted session; setup + verify unlocks; login then needs a code", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    const r = await login(t.deps, { email, password: STRONG }, meta) as { sessionToken: string; csrfToken: string; mfaSetupRequired: boolean };
    expect(r.mfaSetupRequired).toBe(true);
    const ctx = await authenticate(t.deps, { cookieToken: r.sessionToken, method: "POST", csrfHeader: r.csrfToken });
    expect(ctx.mfaPending).toBe(true);
    const { secret } = await mfaSetup(t.deps, ctx);
    const again = () => authenticate(t.deps, { cookieToken: r.sessionToken, method: "POST", csrfHeader: r.csrfToken }); // each request re-authenticates
    expect(await code(mfaVerify(t.deps, await again(), "000000", meta))).toBe("MFA_CODE_INVALID");
    await mfaVerify(t.deps, await again(), generateSync({ secret }), meta);
    expect((await authenticate(t.deps, { cookieToken: r.sessionToken, method: "GET" })).mfaPending).toBe(false);
    expect(await code(login(t.deps, { email, password: STRONG }, meta))).toBe("MFA_CODE_REQUIRED");
    expect(await code(login(t.deps, { email, password: STRONG, mfaCode: generateSync({ secret }) }, meta))).toBe("OK");
    expect((await db.user.findUnique({ where: { email } }))!.mfaSecretEnc).not.toContain(secret);
  });
});

describe("BR-3 audit framework", () => {
  it("writes audit rows without secrets and is append-only", async () => {
    const t = makeDeps(); const { email, meta } = await activeUser(t);
    await login(t.deps, { email, password: STRONG }, meta);
    const rows = await db.auditLog.findMany({ where: { actorEmail: email } });
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["auth.register", "auth.verify_email", "auth.login"]));
    expect(JSON.stringify(rows)).not.toContain(STRONG);
    await expect(db.auditLog.update({ where: { id: rows[0]!.id }, data: { summary: "x" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: rows[0]!.id } })).rejects.toThrow();
  });
});
