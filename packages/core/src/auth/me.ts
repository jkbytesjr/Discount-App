import { z } from "zod";
import { checkPassword, type Locale } from "@moz/shared";
import { AppError } from "../errors";
import { randomToken, sha256 } from "../crypto";
import { hashPassword, verifyPassword } from "../password";
import { writeAudit } from "../audit";
import { buildMail } from "../emails";
import { type AuthDeps, DAY, type Meta, normalizeEmail } from "./deps";
import { revokeAllCredentials } from "./service";
import type { AuthContext } from "./sessions";

const actor = (c: AuthContext) => ({ userId: c.user.id, email: c.user.email, role: c.user.role });

export const profileSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().regex(/^\+258\d{9}$/, "Use +258 followed by 9 digits").nullable().optional(),
  locale: z.enum(["pt-MZ", "en"]).optional(),
});
export const changePasswordSchema = z.strictObject({ currentPassword: z.string().max(1024), newPassword: z.string().max(1024) });
export const changeEmailSchema = z.strictObject({ password: z.string().max(1024), newEmail: z.string().trim().max(254).email().transform(normalizeEmail) });
export const deleteAccountSchema = z.strictObject({ password: z.string().max(1024) });

export const publicUser = (u: AuthContext["user"]) => ({
  id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName,
  phone: u.phone, avatarUrl: u.avatarUrl, locale: u.locale, mfaEnabled: u.mfaEnabled,
  emailVerified: !!u.emailVerifiedAt,
});

export async function updateProfile(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const input = profileSchema.parse(raw);
  const before = publicUser(ctx.user);
  const user = await d.db.user.update({ where: { id: ctx.user.id }, data: input });
  await writeAudit(d.db, d.clock, {
    action: "me.update", summary: "Profile updated", actor: actor(ctx), entityType: "user", entityId: user.id,
    changes: { before, after: publicUser(user) }, meta,
  });
  return publicUser(user);
}

async function requirePassword(ctx: AuthContext, pw: string) {
  if (!(await verifyPassword(ctx.user.passwordHash, pw))) throw new AppError(401, "INVALID_CREDENTIALS", "Password is incorrect");
}

export async function changePassword(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const input = changePasswordSchema.parse(raw);
  await requirePassword(ctx, input.currentPassword);
  const issues = checkPassword(input.newPassword, ctx.user.email);
  if (issues.length) throw new AppError(422, "PASSWORD_WEAK", "Password does not meet the policy", { issues });
  await d.db.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  await revokeAllCredentials(d, ctx.user.id, ctx.session?.id); // keep this session, drop the rest
  await writeAudit(d.db, d.clock, { action: "me.change_password", summary: "Password changed", actor: actor(ctx), meta });
  return { ok: true };
}

export async function requestEmailChange(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const input = changeEmailSchema.parse(raw);
  await requirePassword(ctx, input.password);
  const taken = await d.db.user.findUnique({ where: { email: input.newEmail } });
  if (!taken) {
    const token = randomToken();
    await d.db.emailToken.create({
      data: { userId: ctx.user.id, type: "EMAIL_CHANGE", tokenHash: sha256(token), newEmail: input.newEmail, expiresAt: new Date(d.clock.now().getTime() + DAY) },
    });
    await d.mailer.send(buildMail("emailChange", ctx.user.locale as Locale, input.newEmail, `${d.config.appUrl}/verify-email?token=${token}`));
  }
  await writeAudit(d.db, d.clock, { action: "me.email_change_request", summary: "Email change requested", actor: actor(ctx), meta });
  return { ok: true }; // same answer whether or not the address is taken
}

export async function listDevices(d: AuthDeps, ctx: AuthContext) {
  const rows = await d.db.device.findMany({ where: { userId: ctx.user.id, revokedAt: null }, orderBy: { lastSeenAt: "desc" } });
  return rows.map(({ pushToken: _p, userId: _u, ...r }) => r);
}

export async function revokeDevice(d: AuthDeps, ctx: AuthContext, deviceId: string, meta: Meta) {
  const dev = await d.db.device.findFirst({ where: { id: deviceId, userId: ctx.user.id } });
  if (!dev) throw new AppError(404, "NOT_FOUND", "Not found");
  const now = d.clock.now();
  await d.db.device.update({ where: { id: dev.id }, data: { revokedAt: now, pushToken: null } });
  await d.db.refreshToken.updateMany({ where: { deviceId: dev.id, revokedAt: null }, data: { revokedAt: now } });
  await writeAudit(d.db, d.clock, { action: "me.device_revoke", summary: "Device revoked", actor: actor(ctx), entityType: "device", entityId: dev.id, meta });
  return { ok: true };
}

// Soft delete + anonymise. Audit rows keep the pseudonymous user id (BR-R10).
export async function deleteAccount(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const input = deleteAccountSchema.parse(raw);
  await requirePassword(ctx, input.password);
  const now = d.clock.now();
  await revokeAllCredentials(d, ctx.user.id);
  await d.db.user.update({
    where: { id: ctx.user.id },
    data: {
      status: "DELETED", deletedAt: now, email: `deleted+${ctx.user.id}@deleted.invalid`, firstName: "Deleted", lastName: "User",
      phone: null, avatarUrl: null, mfaSecretEnc: null, mfaEnabled: false, passwordHash: await hashPassword(randomToken()),
    },
  });
  await d.db.device.deleteMany({ where: { userId: ctx.user.id } });
  await writeAudit(d.db, d.clock, { action: "me.delete", summary: "Account deleted", actor: { userId: ctx.user.id, role: ctx.user.role }, entityType: "user", entityId: ctx.user.id, meta });
  return { ok: true };
}
