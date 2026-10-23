import { z } from "zod";
import type { Prisma } from "@moz/db";
import type { Locale } from "@moz/shared";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { requireCan } from "./authz";
import { buildMail } from "./emails";
import { randomToken, sha256 } from "./crypto";
import { hashPassword } from "./password";
import { page, pageSchema } from "./pagination";
import { anonymiseUser } from "./auth/me";
import { revokeAllCredentials } from "./auth/service";
import type { AuthContext } from "./auth/sessions";
import { type AuthDeps, DAY, HOUR, type Meta, normalizeEmail } from "./auth/deps";

const name = z.string().trim().min(1).max(80);
export const createUserSchema = z.strictObject({
  email: z.string().trim().max(254).email().transform(normalizeEmail),
  firstName: name, lastName: name,
  role: z.enum(["ADMIN", "BUSINESS_OWNER", "USER"]),
  locale: z.enum(["pt-MZ", "en"]).default("pt-MZ"),
});
export const adminUpdateSchema = z.strictObject({
  firstName: name.optional(), lastName: name.optional(), locale: z.enum(["pt-MZ", "en"]).optional(),
  phone: z.string().regex(/^\+258\d{9}$/).nullable().optional(), role: z.enum(["ADMIN", "BUSINESS_OWNER", "USER"]).optional(),
});
export const listUsersSchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["ADMIN", "BUSINESS_OWNER", "USER"]).optional(),
  status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  ...pageSchema,
});
const reasonSchema = z.strictObject({ reason: z.string().trim().min(3).max(500).optional() });

const view = (u: Prisma.UserGetPayload<object>) => ({
  id: u.id, email: u.email, role: u.role, status: u.status, firstName: u.firstName, lastName: u.lastName, phone: u.phone,
  locale: u.locale, mfaEnabled: u.mfaEnabled, emailVerifiedAt: u.emailVerifiedAt, lockedUntil: u.lockedUntil,
  createdAt: u.createdAt, dataOrigin: u.dataOrigin,
});
const actorOf = (c: AuthContext) => ({ userId: c.user.id, email: c.user.email, role: c.user.role });

async function target(d: AuthDeps, id: string) {
  const u = await d.db.user.findUnique({ where: { id: z.string().uuid().catch("00000000-0000-0000-0000-000000000000").parse(id) } });
  if (!u) throw new AppError(404, "NOT_FOUND", "Not found");
  return u;
}

async function adminCount(d: AuthDeps) {
  return d.db.user.count({ where: { role: "ADMIN", status: { in: ["ACTIVE", "PENDING_VERIFICATION"] } } });
}

async function audit(d: AuthDeps, ctx: AuthContext, meta: Meta, action: string, summary: string, id: string, changes?: unknown) {
  await writeAudit(d.db, d.clock, { action: `admin.user.${action}`, summary, actor: actorOf(ctx), entityType: "user", entityId: id, changes, meta });
}

export async function listUsers(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const q = listUsersSchema.parse(raw);
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role } : {}), ...(q.status ? { status: q.status } : {}),
    ...(q.q ? { OR: [{ email: { contains: q.q.toLowerCase() } }, { firstName: { contains: q.q, mode: "insensitive" } }, { lastName: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await d.db.user.findMany({ where, orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  const p = page(rows, q.limit);
  return { items: p.items.map(view), nextCursor: p.nextCursor };
}

export async function getUser(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const u = await target(d, id);
  const [devices, logins, membership] = await Promise.all([
    d.db.device.count({ where: { userId: u.id, revokedAt: null } }),
    d.db.loginEvent.findMany({ where: { userId: u.id }, orderBy: { occurredAt: "desc" }, take: 10, select: { success: true, failureReason: true, ip: true, occurredAt: true } }),
    d.db.businessMember.findUnique({ where: { userId: u.id } }),
  ]);
  return { ...view(u), activeDevices: devices, recentLogins: logins, businessId: membership?.businessId ?? null };
}

// The new user verifies their email, then sets a password with "forgot password".
export async function createUser(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const input = createUserSchema.parse(raw);
  if (await d.db.user.findUnique({ where: { email: input.email } })) throw new AppError(409, "EMAIL_TAKEN", "Email already in use");
  const u = await d.db.user.create({ data: { ...input, passwordHash: await hashPassword(randomToken()), createdAt: d.clock.now() } });
  const token = randomToken();
  await d.db.emailToken.create({ data: { userId: u.id, type: "VERIFY", tokenHash: sha256(token), expiresAt: new Date(d.clock.now().getTime() + DAY) } });
  await d.mailer.send(buildMail("verify", u.locale as Locale, u.email, `${d.config.appUrl}/verify-email?token=${token}`));
  await audit(d, ctx, meta, "create", `Created ${input.role} user`, u.id, { after: view(u) });
  return view(u);
}

export async function updateUser(d: AuthDeps, ctx: AuthContext, id: string, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const input = adminUpdateSchema.parse(raw);
  const before = await target(d, id);
  if (input.role && input.role !== before.role) {
    if (before.id === ctx.user.id) throw new AppError(409, "SELF_ROLE_CHANGE", "You cannot change your own role");
    if (before.role === "ADMIN" && (await adminCount(d)) <= 1) throw new AppError(409, "LAST_ADMIN", "Cannot demote the last admin");
  }
  const after = await d.db.user.update({ where: { id: before.id }, data: input });
  if (input.role && input.role !== before.role) await revokeAllCredentials(d, before.id); // role change takes effect immediately
  await audit(d, ctx, meta, input.role && input.role !== before.role ? "role_change" : "update", "User updated", before.id, { before: view(before), after: view(after) });
  return view(after);
}

export async function suspendUser(d: AuthDeps, ctx: AuthContext, id: string, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const { reason } = reasonSchema.parse(raw ?? {});
  const u = await target(d, id);
  if (u.id === ctx.user.id) throw new AppError(409, "SELF_ACTION", "You cannot suspend yourself");
  if (u.status !== "ACTIVE" && u.status !== "PENDING_VERIFICATION") throw new AppError(409, "INVALID_STATE", `User is ${u.status}`);
  if (u.role === "ADMIN" && (await adminCount(d)) <= 1) throw new AppError(409, "LAST_ADMIN", "Cannot suspend the last admin");
  await d.db.user.update({ where: { id: u.id }, data: { status: "SUSPENDED" } });
  await revokeAllCredentials(d, u.id);
  await audit(d, ctx, meta, "suspend", "User suspended", u.id, { before: { status: u.status }, after: { status: "SUSPENDED", reason } });
  return { ok: true };
}

export async function reactivateUser(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const u = await target(d, id);
  if (u.status !== "SUSPENDED") throw new AppError(409, "INVALID_STATE", `User is ${u.status}`);
  const status = u.emailVerifiedAt ? "ACTIVE" : "PENDING_VERIFICATION";
  await d.db.user.update({ where: { id: u.id }, data: { status, failedLoginCount: 0, lockedUntil: null } });
  await audit(d, ctx, meta, "reactivate", "User reactivated", u.id, { before: { status: u.status }, after: { status } });
  return { ok: true };
}

// Invalidates the old password and every session, then emails a reset link (1 h).
export async function forcePasswordReset(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const u = await target(d, id);
  if (u.status === "DELETED") throw new AppError(409, "INVALID_STATE", "User is deleted");
  await d.db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(randomToken()) } });
  await revokeAllCredentials(d, u.id);
  const token = randomToken();
  await d.db.emailToken.create({ data: { userId: u.id, type: "RESET", tokenHash: sha256(token), expiresAt: new Date(d.clock.now().getTime() + HOUR) } });
  await d.mailer.send(buildMail("reset", u.locale as Locale, u.email, `${d.config.appUrl}/reset-password?token=${token}`));
  await audit(d, ctx, meta, "force_reset", "Forced password reset", u.id);
  return { ok: true };
}

export async function deleteUser(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  await requireCan(d, ctx, "settings.change", meta);
  const u = await target(d, id);
  if (u.id === ctx.user.id) throw new AppError(409, "SELF_ACTION", "You cannot delete yourself here");
  if (u.status === "DELETED") throw new AppError(409, "INVALID_STATE", "Already deleted");
  if (u.role === "ADMIN" && (await adminCount(d)) <= 1) throw new AppError(409, "LAST_ADMIN", "Cannot delete the last admin");
  await anonymiseUser(d, u.id);
  await audit(d, ctx, meta, "delete", "User deleted and anonymised", u.id, { before: { role: u.role, status: u.status } });
  return { ok: true };
}
