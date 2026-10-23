import { z } from "zod";
import type { Prisma } from "@moz/db";
import type { Locale } from "@moz/shared";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { notFoundDenied, requireCan } from "./authz";
import { buildMail } from "./emails";
import { page, pageSchema } from "./pagination";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";
import { pauseBusinessDiscounts } from "./discount";

const text = (n: number) => z.string().trim().min(1).max(n);
const phone = z.string().regex(/^\+258\d{9}$/, "Use +258 followed by 9 digits");
const catalogueId = z.string().min(1).max(60);

const fields = {
  legalName: text(160).optional(),
  tradingName: text(160),
  nuit: z.string().regex(/^\d{9}$/, "NUIT has 9 digits").optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().trim().max(2000).optional(),
  website: z.string().url().max(300).refine((u) => u.startsWith("https://"), "https only").optional(),
  contactEmail: z.string().trim().email().max(254).optional(),
  contactPhone: phone.optional(),
  address: text(300).optional(),
  issuerId: catalogueId.optional(),
  walletProviderId: catalogueId.optional(),
};

export const createBusinessSchema = z.strictObject({ type: z.enum(["BANK", "WALLET_PROVIDER", "MERCHANT"]), ...fields });
export const updateBusinessSchema = z.strictObject(fields).partial();
export const decisionSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });
export const listBusinessSchema = z.strictObject({
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
  type: z.enum(["BANK", "WALLET_PROVIDER", "MERCHANT"]).optional(),
  q: z.string().trim().max(100).optional(),
  ...pageSchema,
});

const actorOf = (c: AuthContext) => ({ userId: c.user.id, email: c.user.email, role: c.user.role });

// A bank links to one issuer, a wallet provider to one wallet, a merchant to neither (BR-6).
async function checkLinks(d: AuthDeps, type: string, issuerId?: string | null, walletProviderId?: string | null) {
  if (type === "BANK") {
    if (!issuerId || walletProviderId) throw new AppError(422, "BAD_LINK", "A bank must link to one issuer");
    const i = await d.db.issuer.findUnique({ where: { id: issuerId } });
    if (!i || !i.active) throw new AppError(422, "UNKNOWN_ISSUER", "Unknown issuer");
  } else if (type === "WALLET_PROVIDER") {
    if (!walletProviderId || issuerId) throw new AppError(422, "BAD_LINK", "A wallet provider must link to one wallet");
    const w = await d.db.walletProvider.findUnique({ where: { id: walletProviderId } });
    if (!w || !w.active) throw new AppError(422, "UNKNOWN_WALLET", "Unknown wallet provider");
  } else if (issuerId || walletProviderId) {
    throw new AppError(422, "BAD_LINK", "A merchant has no issuer or wallet link");
  }
}

async function ownerOf(d: AuthDeps, businessId: string) {
  return d.db.businessMember.findFirst({ where: { businessId }, include: { user: true } });
}

/** Loads a business the caller may see: admin any, owner only their own. Others get 404 + audit. */
async function loadVisible(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  const uuidOrSlug = z.string().min(1).max(60).safeParse(id);
  const biz = uuidOrSlug.success ? await d.db.business.findUnique({ where: { id } }) : null;
  if (ctx.user.role === "ADMIN") {
    if (!biz) throw new AppError(404, "NOT_FOUND", "Not found");
    return biz;
  }
  const member = biz ? await d.db.businessMember.findUnique({ where: { userId: ctx.user.id } }) : null;
  if (!biz || member?.businessId !== biz.id) return notFoundDenied(d, ctx, "business", id, meta);
  return biz;
}

export async function createBusiness(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "business.create", meta);
  if (ctx.user.role !== "BUSINESS_OWNER") throw new AppError(403, "FORBIDDEN", "Only business accounts can create a business profile");
  const input = createBusinessSchema.parse(raw);
  if (await d.db.businessMember.findUnique({ where: { userId: ctx.user.id } })) throw new AppError(409, "ALREADY_HAS_BUSINESS", "This account already has a business");
  await checkLinks(d, input.type, input.issuerId, input.walletProviderId);
  const biz = await d.db.business.create({
    data: { ...input, dataOrigin: "REAL", status: "DRAFT", createdAt: d.clock.now(), members: { create: { userId: ctx.user.id } } },
  });
  await writeAudit(d.db, d.clock, { action: "business.create", summary: "Business profile created", actor: { ...actorOf(ctx), businessId: biz.id }, entityType: "business", entityId: biz.id, changes: { after: biz }, meta });
  return biz;
}

export async function getMyBusiness(d: AuthDeps, ctx: AuthContext) {
  const m = await d.db.businessMember.findUnique({ where: { userId: ctx.user.id }, include: { business: true } });
  if (!m) throw new AppError(404, "NOT_FOUND", "No business yet");
  return m.business;
}

export async function getBusiness(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  const biz = await loadVisible(d, ctx, id, meta);
  if (ctx.user.role !== "ADMIN") return biz;
  const owner = await ownerOf(d, biz.id);
  return { ...biz, owner: owner ? { id: owner.user.id, email: owner.user.email, name: `${owner.user.firstName} ${owner.user.lastName}` } : null };
}

export async function updateBusiness(d: AuthDeps, ctx: AuthContext, id: string, raw: unknown, meta: Meta) {
  const biz = await loadVisible(d, ctx, id, meta);
  await requireCan(d, ctx, "business.edit", meta, { isOwn: true });
  const input = updateBusinessSchema.parse(raw);
  const linkChange = "issuerId" in input || "walletProviderId" in input;
  if (linkChange) {
    if (biz.status !== "DRAFT" && biz.status !== "REJECTED") throw new AppError(409, "INVALID_STATE", "Links can only change while the profile is a draft or rejected");
    await checkLinks(d, biz.type, input.issuerId ?? biz.issuerId, input.walletProviderId ?? biz.walletProviderId);
  }
  const after = await d.db.business.update({ where: { id: biz.id }, data: input as Prisma.BusinessUpdateInput });
  await writeAudit(d.db, d.clock, { action: "business.update", summary: "Business profile updated", actor: { ...actorOf(ctx), businessId: biz.id }, entityType: "business", entityId: biz.id, changes: { before: biz, after }, meta });
  return after;
}

export async function submitBusiness(d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) {
  const biz = await loadVisible(d, ctx, id, meta);
  await requireCan(d, ctx, "business.edit", meta, { isOwn: true });
  if (biz.status !== "DRAFT" && biz.status !== "REJECTED") throw new AppError(409, "INVALID_STATE", "Only a draft or rejected profile can be submitted");
  const missing = (["contactEmail", "contactPhone", "address"] as const).filter((f) => !biz[f]);
  if (missing.length) throw new AppError(422, "INCOMPLETE_PROFILE", "Complete the profile before submitting", { missing });
  const after = await d.db.business.update({ where: { id: biz.id }, data: { status: "PENDING_APPROVAL", rejectionReason: null } });
  await writeAudit(d.db, d.clock, { action: "business.submit", summary: "Business submitted for approval", actor: { ...actorOf(ctx), businessId: biz.id }, entityType: "business", entityId: biz.id, changes: { before: { status: biz.status }, after: { status: after.status } }, meta });
  return after;
}

// ---------- Admin ----------
export async function listBusinesses(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "business.approve", meta);
  const q = listBusinessSchema.parse(raw);
  const where: Prisma.BusinessWhereInput = {
    ...(q.status ? { status: q.status } : {}), ...(q.type ? { type: q.type } : {}),
    ...(q.q ? { OR: [{ tradingName: { contains: q.q, mode: "insensitive" } }, { legalName: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await d.db.business.findMany({ where, orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return page(rows, q.limit);
}

async function decide(
  d: AuthDeps, ctx: AuthContext, id: string, meta: Meta,
  opts: { from: string[]; to: "APPROVED" | "REJECTED" | "SUSPENDED"; action: string; reason?: string; mail?: "businessApproved" | "businessRejected" | "businessSuspended" },
) {
  await requireCan(d, ctx, "business.approve", meta);
  const biz = await d.db.business.findUnique({ where: { id } });
  if (!biz) throw new AppError(404, "NOT_FOUND", "Not found");
  if (!opts.from.includes(biz.status)) throw new AppError(409, "INVALID_STATE", `Cannot ${opts.action} a business that is ${biz.status}`);
  const now = d.clock.now();
  const after = await d.db.business.update({
    where: { id },
    data: {
      status: opts.to,
      rejectionReason: opts.to === "APPROVED" ? null : (opts.reason ?? biz.rejectionReason),
      ...(opts.to === "APPROVED" ? { approvedBy: ctx.user.id, approvedAt: now } : {}),
    },
  });
  if (opts.to === "SUSPENDED") await pauseBusinessDiscounts(d, id, actorOf(ctx), meta); // BR-R11
  await writeAudit(d.db, d.clock, { action: `business.${opts.action}`, summary: `Business ${opts.action}`, actor: actorOf(ctx), entityType: "business", entityId: id, changes: { before: { status: biz.status }, after: { status: after.status, reason: opts.reason } }, meta });
  const owner = await ownerOf(d, id);
  if (owner && opts.mail) await d.mailer.send(buildMail(opts.mail, owner.user.locale as Locale, owner.user.email, opts.mail === "businessApproved" ? d.config.appUrl : undefined, opts.reason));
  return after;
}

export const approveBusiness = async (d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) =>
  decide(d, ctx, id, meta, { from: ["PENDING_APPROVAL"], to: "APPROVED", action: "approve", mail: "businessApproved" });

export const rejectBusiness = async (d: AuthDeps, ctx: AuthContext, id: string, raw: unknown, meta: Meta) =>
  decide(d, ctx, id, meta, { from: ["PENDING_APPROVAL"], to: "REJECTED", action: "reject", reason: decisionSchema.parse(raw).reason, mail: "businessRejected" });

export const suspendBusiness = async (d: AuthDeps, ctx: AuthContext, id: string, raw: unknown, meta: Meta) =>
  decide(d, ctx, id, meta, { from: ["APPROVED"], to: "SUSPENDED", action: "suspend", reason: decisionSchema.parse(raw).reason, mail: "businessSuspended" });

export const reinstateBusiness = async (d: AuthDeps, ctx: AuthContext, id: string, meta: Meta) =>
  decide(d, ctx, id, meta, { from: ["SUSPENDED"], to: "APPROVED", action: "reinstate" });
