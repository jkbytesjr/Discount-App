import { z } from "zod";
import type { User } from "@moz/db";
import { checkPassword, type Locale } from "@moz/shared";
import { AppError } from "../errors";
import { randomToken, decrypt, sha256 } from "../crypto";
import { dummyVerify, hashPassword, verifyPassword } from "../password";
import { CAPTCHA_AFTER, MAX_FAILED_ATTEMPTS, lockMinutes } from "../lockout";
import { writeAudit, type Actor } from "../audit";
import { buildMail } from "../emails";
import { checkTotp } from "./mfa";
import { createWebSession, issueTokenPair, type AuthContext } from "./sessions";
import { type AuthDeps, DAY, HOUR, MIN, type Meta, coarse, normalizeEmail } from "./deps";

const WINDOW_S = 15 * 60;
const IP_LIMIT = 20;

const email = z.string().trim().max(254).email().transform(normalizeEmail);
const name = z.string().trim().min(1).max(80);
const locale = z.enum(["pt-MZ", "en"]);

export const registerSchema = z.strictObject({
  accountType: z.enum(["user", "business"]),
  firstName: name,
  lastName: name,
  email,
  password: z.string().max(1024),
  confirmPassword: z.string().max(1024),
  acceptTerms: z.literal(true),
  locale: locale.default("pt-MZ"),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(1024),
  client: z.enum(["web", "ios"]).default("web"),
  captchaToken: z.string().max(4096).optional(),
  mfaCode: z.string().regex(/^\d{6}$/).optional(),
  device: z.strictObject({
    vendorId: z.string().min(1).max(100),
    model: z.string().max(100).optional(),
    osVersion: z.string().max(50).optional(),
    appVersion: z.string().max(50).optional(),
    pushToken: z.string().max(500).optional(),
  }).optional(),
  location: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
});

export const tokenSchema = z.strictObject({ token: z.string().min(20).max(200) });
export const emailOnlySchema = z.strictObject({ email });
export const resetSchema = z.strictObject({ token: z.string().min(20).max(200), password: z.string().max(1024) });

const actorOf = (u: Pick<User, "id" | "email" | "role">): Actor => ({ userId: u.id, email: u.email, role: u.role });
const link = (d: AuthDeps, path: string, token: string) => `${d.config.appUrl}${path}?token=${token}`;

async function newEmailToken(d: AuthDeps, userId: string, type: "VERIFY" | "RESET" | "EMAIL_CHANGE", ttlMs: number, newEmail?: string) {
  const token = randomToken();
  await d.db.emailToken.create({
    data: { userId, type, tokenHash: sha256(token), newEmail, expiresAt: new Date(d.clock.now().getTime() + ttlMs) },
  });
  return token;
}

async function sendVerification(d: AuthDeps, user: Pick<User, "id" | "email" | "locale">) {
  await d.db.emailToken.updateMany({ where: { userId: user.id, type: "VERIFY", usedAt: null }, data: { usedAt: d.clock.now() } });
  const token = await newEmailToken(d, user.id, "VERIFY", DAY);
  await d.mailer.send(buildMail("verify", user.locale as Locale, user.email, link(d, "/verify-email", token)));
}

// ---------- Register (BR-4) ----------
export async function register(d: AuthDeps, raw: unknown, meta: Meta) {
  const input = registerSchema.parse(raw);
  if (input.password !== input.confirmPassword) throw new AppError(422, "PASSWORD_MISMATCH", "Passwords do not match");
  const issues = checkPassword(input.password, input.email);
  if (issues.length) throw new AppError(422, "PASSWORD_WEAK", "Password does not meet the policy", { issues });
  if ((await d.limiter.hit(`register:ip:${meta.ip ?? "unknown"}`, HOUR / 1000)) > 10) {
    throw new AppError(429, "RATE_LIMITED", "Too many attempts");
  }
  const passwordHash = await hashPassword(input.password); // always hash: same timing for existing emails
  const existing = await d.db.user.findUnique({ where: { email: input.email } });
  // Never honoured outside local/test, whatever the caller configured.
  const skip = d.config.skipEmailVerification === true && (d.config.appEnv === "local" || d.config.appEnv === "test");
  if (!existing) {
    const user = await d.db.user.create({
      data: {
        email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName,
        role: input.accountType === "business" ? "BUSINESS_OWNER" : "USER", locale: input.locale,
        createdAt: d.clock.now(),
        ...(skip ? { status: "ACTIVE" as const, emailVerifiedAt: d.clock.now() } : {}),
      },
    });
    if (!skip) await sendVerification(d, user);
    await writeAudit(d.db, d.clock, {
      action: "auth.register", summary: `Registered ${input.accountType} account`,
      actor: actorOf(user), entityType: "user", entityId: user.id, meta,
    });
  }
  // Same response either way, so emails cannot be enumerated. (`autoVerified` only exists when the local/test skip flag is on.)
  return skip && !existing ? { ok: true, autoVerified: true } : { ok: true };
}

// ---------- Verify email / confirm email change ----------
export async function verifyEmail(d: AuthDeps, raw: unknown, meta: Meta) {
  const { token } = tokenSchema.parse(raw);
  const now = d.clock.now();
  const row = await d.db.emailToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt <= now || (row.type !== "VERIFY" && row.type !== "EMAIL_CHANGE")) {
    throw new AppError(400, "TOKEN_INVALID", "This link is invalid or expired");
  }
  const claimed = await d.db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new AppError(400, "TOKEN_INVALID", "This link is invalid or expired");
  if (row.type === "VERIFY") {
    await d.db.user.update({ where: { id: row.userId }, data: { status: "ACTIVE", emailVerifiedAt: now } });
  } else if (row.newEmail) {
    const taken = await d.db.user.findUnique({ where: { email: row.newEmail } });
    if (taken) throw new AppError(409, "EMAIL_TAKEN", "Email already in use");
    await d.db.user.update({ where: { id: row.userId }, data: { email: row.newEmail, emailVerifiedAt: now } });
  }
  await writeAudit(d.db, d.clock, {
    action: row.type === "VERIFY" ? "auth.verify_email" : "me.email_change",
    summary: row.type === "VERIFY" ? "Email verified" : "Email changed",
    actor: actorOf(row.user), entityType: "user", entityId: row.userId, meta,
  });
  return { ok: true, type: row.type };
}

export async function resendVerification(d: AuthDeps, raw: unknown, _meta: Meta) {
  const { email: addr } = emailOnlySchema.parse(raw);
  const n = await d.limiter.hit(`resend:${sha256(addr)}`, HOUR / 1000);
  if (n > 3) throw new AppError(429, "RATE_LIMITED", "Too many requests");
  const user = await d.db.user.findUnique({ where: { email: addr } });
  if (user && user.status === "PENDING_VERIFICATION") await sendVerification(d, user);
  return { ok: true };
}

// ---------- Login (BR-1, IOS-2) ----------
export async function login(d: AuthDeps, raw: unknown, meta: Meta) {
  const input = loginSchema.parse(raw);
  const now = d.clock.now();
  const failKey = `login:fail:${sha256(input.email)}`;

  if ((await d.limiter.hit(`login:ip:${meta.ip ?? "unknown"}`, WINDOW_S)) > IP_LIMIT) {
    throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  }
  const failures = await d.limiter.peek(failKey, WINDOW_S);
  if (failures >= MAX_FAILED_ATTEMPTS) throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  if (input.client === "web" && failures >= CAPTCHA_AFTER && !(await d.verifyCaptcha(input.captchaToken, meta.ip))) {
    throw new AppError(403, "CAPTCHA_REQUIRED", "Please complete the challenge");
  }

  const user = await d.db.user.findUnique({ where: { email: input.email } });
  if (user?.lockedUntil && user.lockedUntil > now) {
    throw new AppError(429, "ACCOUNT_LOCKED", "Account temporarily locked", { lockedUntil: user.lockedUntil.toISOString() });
  }

  let ok = false;
  if (user) ok = await verifyPassword(user.passwordHash, input.password);
  else await dummyVerify(input.password);

  const fail = async (reason: string): Promise<never> => {
    await d.limiter.hit(failKey, WINDOW_S);
    await d.db.loginEvent.create({ data: { userId: user?.id, success: false, failureReason: reason, ip: meta.ip, userAgent: meta.userAgent, occurredAt: now } });
    await writeAudit(d.db, d.clock, {
      action: "auth.login.failure", summary: "Login failed", result: "failure",
      actor: user ? actorOf(user) : { email: input.email }, meta, changes: { reason },
    });
    if (user) {
      const count = user.failedLoginCount + 1;
      if (count >= MAX_FAILED_ATTEMPTS) {
        const until = new Date(now.getTime() + lockMinutes(user.lockCount) * MIN);
        await d.db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockCount: user.lockCount + 1, lockedUntil: until } });
        await d.mailer.send(buildMail("locked", user.locale as Locale, user.email));
        await writeAudit(d.db, d.clock, { action: "auth.lockout", summary: "Account locked", actor: actorOf(user), meta, changes: { until } });
      } else {
        await d.db.user.update({ where: { id: user.id }, data: { failedLoginCount: count } });
      }
    }
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  };

  if (!user || !ok) return fail("bad_credentials");
  if (user.status === "PENDING_VERIFICATION") throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email to sign in", { canResend: true });
  if (user.status !== "ACTIVE") return fail("inactive");

  if (user.mfaEnabled) {
    if (!input.mfaCode) throw new AppError(401, "MFA_CODE_REQUIRED", "Enter your 6-digit code");
    if (!user.mfaSecretEnc || !checkTotp(decrypt(user.mfaSecretEnc, d.config.mfaKey), input.mfaCode)) return fail("bad_mfa");
  }

  // Success: clear counters.
  await d.limiter.reset(failKey);
  await d.db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockCount: 0, lockedUntil: null } });

  let deviceId: string | null = null;
  let newDevice = false;
  if (input.device) {
    const found = await d.db.device.findUnique({ where: { userId_vendorId: { userId: user.id, vendorId: input.device.vendorId } } });
    newDevice = !found || !!found.revokedAt;
    const dev = await d.db.device.upsert({
      where: { userId_vendorId: { userId: user.id, vendorId: input.device.vendorId } },
      create: { userId: user.id, ...input.device, lastSeenAt: now },
      update: { ...input.device, lastSeenAt: now, revokedAt: null },
    });
    deviceId = dev.id;
    if (newDevice) await d.mailer.send(buildMail("newDevice", user.locale as Locale, user.email));
  }
  await d.db.loginEvent.create({
    data: {
      userId: user.id, deviceId, success: true, ip: meta.ip, userAgent: meta.userAgent, occurredAt: now,
      coarseLat: input.location ? coarse(input.location.lat) : null,
      coarseLng: input.location ? coarse(input.location.lng) : null,
    },
  });
  await writeAudit(d.db, d.clock, { action: "auth.login", summary: `Login (${input.client})`, actor: actorOf(user), meta: { ...meta, deviceId } });

  const summary = { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, locale: user.locale };
  if (input.client === "ios") {
    return { user: summary, ...(await issueTokenPair(d, user, deviceId, meta.ip)) };
  }
  const mfaPassed = user.mfaEnabled; // admin without 2FA gets a restricted session until setup
  const s = await createWebSession(d, user.id, mfaPassed, meta);
  return { user: summary, sessionToken: s.token, csrfToken: s.csrfToken, mfaSetupRequired: user.role === "ADMIN" && !user.mfaEnabled };
}

// ---------- Logout ----------
export async function logout(d: AuthDeps, ctx: AuthContext, refreshToken: string | undefined, meta: Meta) {
  const now = d.clock.now();
  if (ctx.session) await d.db.session.update({ where: { id: ctx.session.id }, data: { revokedAt: now } });
  if (refreshToken) {
    const rt = await d.db.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (rt && rt.userId === ctx.user.id) await d.db.refreshToken.updateMany({ where: { familyId: rt.familyId }, data: { revokedAt: now } });
  }
  await writeAudit(d.db, d.clock, { action: "auth.logout", summary: "Logout", actor: actorOf(ctx.user), meta });
  return { ok: true };
}

export async function revokeAllCredentials(d: AuthDeps, userId: string, exceptSessionId?: string) {
  const now = d.clock.now();
  await d.db.session.updateMany({ where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) }, data: { revokedAt: now } });
  await d.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
}

export async function logoutAll(d: AuthDeps, ctx: AuthContext, meta: Meta) {
  await revokeAllCredentials(d, ctx.user.id);
  await writeAudit(d.db, d.clock, { action: "auth.logout_all", summary: "Logged out of all devices", actor: actorOf(ctx.user), meta });
  return { ok: true };
}

// ---------- Forgot / reset password ----------
export async function forgotPassword(d: AuthDeps, raw: unknown, meta: Meta) {
  const { email: addr } = emailOnlySchema.parse(raw);
  if ((await d.limiter.hit(`forgot:${sha256(addr)}`, HOUR / 1000)) > 3) throw new AppError(429, "RATE_LIMITED", "Too many requests");
  const user = await d.db.user.findUnique({ where: { email: addr } });
  if (user && user.status === "ACTIVE") {
    const token = await newEmailToken(d, user.id, "RESET", HOUR);
    await d.mailer.send(buildMail("reset", user.locale as Locale, user.email, link(d, "/reset-password", token)));
    await writeAudit(d.db, d.clock, { action: "auth.forgot_password", summary: "Password reset requested", actor: actorOf(user), meta });
  }
  return { ok: true };
}

export async function resetPassword(d: AuthDeps, raw: unknown, meta: Meta) {
  const input = resetSchema.parse(raw);
  const now = d.clock.now();
  const row = await d.db.emailToken.findUnique({ where: { tokenHash: sha256(input.token) }, include: { user: true } });
  if (!row || row.type !== "RESET" || row.usedAt || row.expiresAt <= now) throw new AppError(400, "TOKEN_INVALID", "This link is invalid or expired");
  const issues = checkPassword(input.password, row.user.email);
  if (issues.length) throw new AppError(422, "PASSWORD_WEAK", "Password does not meet the policy", { issues });
  const claimed = await d.db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new AppError(400, "TOKEN_INVALID", "This link is invalid or expired");
  await d.db.user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockCount: 0, lockedUntil: null },
  });
  await revokeAllCredentials(d, row.userId); // reset invalidates all sessions
  await writeAudit(d.db, d.clock, { action: "auth.reset_password", summary: "Password reset", actor: actorOf(row.user), meta });
  return { ok: true };
}

// ---------- Daily clean-up (Vercel Cron) ----------
export async function purgeStale(d: AuthDeps, unverifiedDays = 7) {
  const now = d.clock.now();
  const cutoff = new Date(now.getTime() - unverifiedDays * DAY);
  const users = await d.db.user.deleteMany({ where: { status: "PENDING_VERIFICATION", createdAt: { lt: cutoff }, dataOrigin: "REAL" } });
  const tokens = await d.db.emailToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } });
  const sessions = await d.db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const refresh = await d.db.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
  const limits = await d.db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - DAY) } } });
  return { users: users.count, tokens: tokens.count, sessions: sessions.count, refresh: refresh.count, limits: limits.count };
}
