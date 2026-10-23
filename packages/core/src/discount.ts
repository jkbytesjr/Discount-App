import { z } from "zod";
import type { Prisma } from "@moz/db";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { notFoundDenied, requireCan } from "./authz";
import { dateKey, isPastValidity, maputoDate, rankOffers, toMinutes, WEEKDAYS, type OfferCandidate } from "./offers";
import { actingBusiness } from "./premise";
import { page, pageSchema } from "./pagination";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

export type Lang = "pt" | "en";
const text = (n: number) => z.string().trim().min(1).max(n);
const id = z.string().min(1).max(60);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => { // V8 rolls 2026-02-30 over to March, so round-trip
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Not a real date");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const bilingual = (n: number) => z.strictObject({ pt: text(n), en: text(n) });
const optionalBilingual = (n: number) => z.strictObject({ pt: z.string().trim().max(n).optional(), en: z.string().trim().max(n).optional() });

// ---------- Eligibility rows (BR-7) ----------
export const eligibilitySchema = z.strictObject({
  scope: z.enum(["CARD_PRODUCT", "ISSUER_ANY", "ANY_BANK_CARD", "WALLET", "ANY_WALLET", "GENERAL"]),
  cardProductId: id.optional(),
  issuerId: id.optional(),
  walletId: id.optional(),
  cardType: z.enum(["DEBIT", "CREDIT", "PREPAID"]).optional(),
  networkId: id.optional(),
  benefit: z.enum(["PERCENT", "FIXED", "CASHBACK", "BOGO", "FREE_ITEM", "POINTS"]),
  value: z.number().min(0.01).max(1_000_000).optional(),
  valueMzn: z.number().int().min(1).max(100_000_000).optional(),
  valueText: optionalBilingual(120).optional(),
  minSpendMzn: z.number().int().min(0).max(100_000_000).optional(),
  maxDiscountMzn: z.number().int().min(0).max(100_000_000).optional(),
  comment: optionalBilingual(300).optional(),
});
export type EligibilityInput = z.infer<typeof eligibilitySchema>;

const SCOPE_FIELDS: Record<EligibilityInput["scope"], (keyof EligibilityInput)[]> = {
  CARD_PRODUCT: ["cardProductId"],
  ISSUER_ANY: ["issuerId", "cardType", "networkId"],
  ANY_BANK_CARD: ["cardType", "networkId"],
  WALLET: ["walletId"],
  ANY_WALLET: [],
  GENERAL: [],
};
const SCOPE_REQUIRED: Partial<Record<EligibilityInput["scope"], keyof EligibilityInput>> = {
  CARD_PRODUCT: "cardProductId", ISSUER_ANY: "issuerId", WALLET: "walletId",
};

/** Shape rules: which fields a scope and a benefit allow or require. Catalogue existence is checked separately. */
export function checkEligibilityShape(e: EligibilityInput, i: number): void {
  const bad = (message: string) => { throw new AppError(422, "BAD_ELIGIBILITY", `Eligibility row ${i + 1}: ${message}`, { row: i }); };
  const required = SCOPE_REQUIRED[e.scope];
  if (required && e[required] === undefined) bad(`${e.scope} needs ${required}`);
  for (const f of ["cardProductId", "issuerId", "walletId", "cardType", "networkId"] as const) {
    if (e[f] !== undefined && !SCOPE_FIELDS[e.scope].includes(f)) bad(`${f} does not apply to ${e.scope}`);
  }
  switch (e.benefit) {
    case "PERCENT": case "CASHBACK":
      if (e.value === undefined || e.value > 100) bad("percentage must be between 0.01 and 100");
      break;
    case "FIXED": if (e.valueMzn === undefined) bad("fixed amount (MZN) is required"); break;
    case "POINTS": if (e.value === undefined) bad("points value is required"); break;
    case "FREE_ITEM": if (!e.valueText?.pt || !e.valueText?.en) bad("describe the free item in Portuguese and English"); break;
    case "BOGO": break;
  }
  if (e.maxDiscountMzn !== undefined && e.benefit !== "PERCENT" && e.benefit !== "CASHBACK") bad("maximum discount only applies to percentage benefits");
}

// ---------- Discount input ----------
const core = {
  title: bilingual(120),
  description: optionalBilingual(1000).optional(),
  terms: optionalBilingual(2000).optional(),
  redemption: optionalBilingual(300).optional(),
  promoCode: z.string().trim().regex(/^[A-Za-z0-9_-]{2,30}$/, "2-30 letters, digits, - or _").optional(),
  validFrom: day.optional(),
  validTo: day.optional(),
  schedule: z.strictObject({ days: z.array(z.enum(WEEKDAYS as unknown as [string, ...string[]])).max(7).default([]), from: hhmm.optional(), to: hhmm.optional() }).optional(),
  isOnline: z.boolean().default(false),
  premiseIds: z.array(id).max(500).default([]),
  eligibility: z.array(eligibilitySchema).max(30).default([]),
};
export const createDiscountSchema = z.strictObject({ businessId: id.optional(), ...core });
export const updateDiscountSchema = z.strictObject({
  title: core.title, description: core.description, terms: core.terms, redemption: core.redemption, promoCode: core.promoCode.nullable(),
  validFrom: day.nullable(), validTo: day.nullable(), schedule: core.schedule.nullable(), isOnline: z.boolean(),
  premiseIds: z.array(id).max(500), eligibility: z.array(eligibilitySchema).max(30), // no defaults: an absent field must stay untouched
}).partial();

export const listDiscountSchema = z.strictObject({
  businessId: id.optional(),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "PAUSED", "EXPIRED", "ARCHIVED"]).optional(),
  q: z.string().trim().max(100).optional(),
  premiseId: id.optional(),
  categoryId: id.optional(),
  cardProductId: id.optional(),
  walletId: id.optional(),
  validity: z.enum(["current", "upcoming", "ended"]).optional(),
  sort: z.enum(["newest", "title", "ending"]).default("newest"),
  ...pageSchema,
});
export const bulkSchema = z.strictObject({
  action: z.enum(["publish", "pause", "archive", "duplicate", "extend"]),
  ids: z.array(id).min(1).max(100),
  validTo: day.optional(),
});
export const extendSchema = z.strictObject({ validTo: day });

type Full = Prisma.DiscountGetPayload<{ include: { premises: { include: { premise: true } }; eligibility: true } }>;
const include = { premises: { include: { premise: true } }, eligibility: { orderBy: { position: "asc" } } } satisfies Prisma.DiscountInclude;

const actorOf = (c: AuthContext, businessId?: string) => ({ userId: c.user.id, email: c.user.email, role: c.user.role, businessId });
const asDate = (s?: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

/** BR-R2 / BR-9: expiry is computed at read time, so a PUBLISHED row past valid_to reads as EXPIRED before the job persists it. */
export const effectiveStatus = (x: { status: string; validTo: Date | string | null }, now: Date) =>
  x.status === "PUBLISHED" && isPastValidity(x, now) ? "EXPIRED" : x.status;

const present = <T extends Full>(x: T, now: Date) => ({ ...x, effectiveStatus: effectiveStatus(x, now) });

function checkWindows(validFrom?: string | null, validTo?: string | null, sch?: { from?: string; to?: string } | null) {
  if (validFrom && validTo && validTo < validFrom) throw new AppError(422, "BAD_DATES", "The end date is before the start date");
  if (sch && (sch.from === undefined) !== (sch.to === undefined)) throw new AppError(422, "BAD_SCHEDULE", "Give both a start and an end time, or neither");
  if (sch?.from && sch.to && toMinutes(sch.from) >= toMinutes(sch.to)) throw new AppError(422, "BAD_SCHEDULE", "The end time must be after the start time");
}

/** Resolves catalogue references, fills the issuer of a card product, and checks premises belong to the business. */
async function resolveRefs(d: AuthDeps, businessId: string, premiseIds: string[], rows: EligibilityInput[]) {
  const unique = [...new Set(premiseIds)];
  if (unique.length) {
    const found = await d.db.premise.findMany({ where: { id: { in: unique }, businessId }, select: { id: true } });
    if (found.length !== unique.length) throw new AppError(422, "UNKNOWN_PREMISE", "A premise does not exist or belongs to another business");
  }
  const out: (EligibilityInput & { issuerId?: string })[] = [];
  for (const [i, r] of rows.entries()) {
    checkEligibilityShape(r, i);
    const row: EligibilityInput = { ...r };
    if (r.scope === "CARD_PRODUCT") {
      const cp = await d.db.cardProduct.findUnique({ where: { id: r.cardProductId! } });
      if (!cp || !cp.active) throw new AppError(422, "UNKNOWN_CARD_PRODUCT", `Eligibility row ${i + 1}: unknown card product`, { row: i });
      row.issuerId = cp.issuerId; // denormalised for matching (BR-R1) and general-alert filters
    }
    if (r.scope === "ISSUER_ANY" && !(await d.db.issuer.findFirst({ where: { id: r.issuerId!, active: true } }))) throw new AppError(422, "UNKNOWN_ISSUER", `Eligibility row ${i + 1}: unknown issuer`, { row: i });
    if (r.scope === "WALLET" && !(await d.db.walletProvider.findFirst({ where: { id: r.walletId!, active: true } }))) throw new AppError(422, "UNKNOWN_WALLET", `Eligibility row ${i + 1}: unknown wallet`, { row: i });
    if (r.networkId && !(await d.db.cardNetwork.findFirst({ where: { id: r.networkId, active: true } }))) throw new AppError(422, "UNKNOWN_NETWORK", `Eligibility row ${i + 1}: unknown card network`, { row: i });
    out.push(row);
  }
  return { premiseIds: unique, rows: out };
}

const rowData = (r: EligibilityInput, position: number): Omit<Prisma.DiscountEligibilityUncheckedCreateInput, "discountId"> => ({
  position, scope: r.scope, benefit: r.benefit, cardProductId: r.cardProductId ?? null, issuerId: r.issuerId ?? null, walletId: r.walletId ?? null,
  cardType: r.cardType ?? null, networkId: r.networkId ?? null, value: r.value ?? null, valueMzn: r.valueMzn ?? null,
  valueTextPt: r.valueText?.pt ?? null, valueTextEn: r.valueText?.en ?? null, minSpendMzn: r.minSpendMzn ?? null, maxDiscountMzn: r.maxDiscountMzn ?? null,
  commentPt: r.comment?.pt ?? null, commentEn: r.comment?.en ?? null,
});

async function loadVisible(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta): Promise<Full> {
  const x = await d.db.discount.findUnique({ where: { id: discountId }, include });
  if (ctx.user.role === "ADMIN") {
    if (!x) throw new AppError(404, "NOT_FOUND", "Not found");
    return x;
  }
  const m = x ? await d.db.businessMember.findUnique({ where: { userId: ctx.user.id } }) : null;
  if (!x || m?.businessId !== x.businessId) return notFoundDenied(d, ctx, "discount", discountId, meta);
  return x;
}

const snapshot = (x: Full) => ({
  status: x.status, titlePt: x.titlePt, titleEn: x.titleEn, validFrom: dateKey(x.validFrom), validTo: dateKey(x.validTo),
  schedule: { days: x.scheduleDays, from: x.scheduleFrom, to: x.scheduleTo }, isOnline: x.isOnline,
  premises: x.premises.map((p) => p.premiseId), eligibility: x.eligibility.map(({ id: _id, discountId: _d, ...r }) => r),
});

// ---------- CRUD ----------
export async function createDiscount(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  const input = createDiscountSchema.parse(raw);
  const biz = await actingBusiness(d, ctx, input.businessId);
  if (biz.status === "SUSPENDED") throw new AppError(409, "BUSINESS_SUSPENDED", "This business is suspended");
  checkWindows(input.validFrom, input.validTo, input.schedule);
  const refs = await resolveRefs(d, biz.id, input.premiseIds, input.eligibility);
  const created = await d.db.discount.create({
    data: {
      businessId: biz.id, titlePt: input.title.pt, titleEn: input.title.en,
      descriptionPt: input.description?.pt, descriptionEn: input.description?.en, termsPt: input.terms?.pt, termsEn: input.terms?.en,
      redemptionPt: input.redemption?.pt, redemptionEn: input.redemption?.en, promoCode: input.promoCode,
      validFrom: asDate(input.validFrom), validTo: asDate(input.validTo), isOnline: input.isOnline,
      scheduleDays: input.schedule?.days ?? [], scheduleFrom: input.schedule?.from, scheduleTo: input.schedule?.to,
      status: "DRAFT", dataOrigin: "REAL", createdAt: d.clock.now(),
      premises: { create: refs.premiseIds.map((premiseId) => ({ premiseId })) },
      eligibility: { create: refs.rows.map(rowData) },
    },
    include,
  });
  await writeAudit(d.db, d.clock, { action: "discount.create", summary: "Discount created", actor: actorOf(ctx, biz.id), entityType: "discount", entityId: created.id, changes: { after: snapshot(created) }, meta });
  return present(created, d.clock.now());
}

export async function getDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta) {
  return present(await loadVisible(d, ctx, discountId, meta), d.clock.now());
}

const EDITABLE = ["DRAFT", "PAUSED", "PUBLISHED"];

export async function updateDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, raw: unknown, meta: Meta) {
  const before = await loadVisible(d, ctx, discountId, meta);
  await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  if (!EDITABLE.includes(before.status) || effectiveStatus(before, d.clock.now()) === "EXPIRED") throw new AppError(409, "INVALID_STATE", "Extend the validity or restore the discount before editing it");
  const input = updateDiscountSchema.parse(raw);
  const validFrom = input.validFrom === undefined ? dateKey(before.validFrom) : input.validFrom;
  const validTo = input.validTo === undefined ? dateKey(before.validTo) : input.validTo;
  const sch = input.schedule === undefined ? { from: before.scheduleFrom ?? undefined, to: before.scheduleTo ?? undefined } : input.schedule;
  checkWindows(validFrom, validTo, sch);
  const refs = input.premiseIds || input.eligibility ? await resolveRefs(d, before.businessId, input.premiseIds ?? before.premises.map((p) => p.premiseId), input.eligibility ?? []) : null;
  if (input.eligibility && !refs) throw new Error("unreachable");

  const now = d.clock.now();
  const after = await d.db.$transaction(async (tx) => {
    if (input.premiseIds) {
      await tx.discountPremise.deleteMany({ where: { discountId } });
      await tx.discountPremise.createMany({ data: refs!.premiseIds.map((premiseId) => ({ discountId, premiseId })) });
    }
    if (input.eligibility) {
      await tx.discountEligibility.deleteMany({ where: { discountId } });
      await tx.discountEligibility.createMany({ data: refs!.rows.map((r, i) => ({ discountId, ...rowData(r, i) })) });
    }
    const updated = await tx.discount.update({
      where: { id: discountId },
      data: {
        ...(input.title ? { titlePt: input.title.pt, titleEn: input.title.en } : {}),
        ...(input.description ? { descriptionPt: input.description.pt ?? null, descriptionEn: input.description.en ?? null } : {}),
        ...(input.terms ? { termsPt: input.terms.pt ?? null, termsEn: input.terms.en ?? null } : {}),
        ...(input.redemption ? { redemptionPt: input.redemption.pt ?? null, redemptionEn: input.redemption.en ?? null } : {}),
        ...(input.promoCode !== undefined ? { promoCode: input.promoCode } : {}),
        ...(input.validFrom !== undefined ? { validFrom: asDate(input.validFrom) } : {}),
        ...(input.validTo !== undefined ? { validTo: asDate(input.validTo) } : {}),
        ...(input.schedule !== undefined ? { scheduleDays: input.schedule?.days ?? [], scheduleFrom: input.schedule?.from ?? null, scheduleTo: input.schedule?.to ?? null } : {}),
        ...(input.isOnline !== undefined ? { isOnline: input.isOnline } : {}),
      },
      include,
    });
    // A live discount must stay publishable after an edit; throwing here rolls the whole edit back.
    if (updated.status === "PUBLISHED") assertPublishable(updated, now);
    return updated;
  });
  await writeAudit(d.db, d.clock, { action: "discount.update", summary: "Discount updated", actor: actorOf(ctx, before.businessId), entityType: "discount", entityId: discountId, changes: { before: snapshot(before), after: snapshot(after) }, meta });
  // Phase 8 (BR-R7, IOS-7): notify users who favourited this discount when the change is material.
  return present(after, d.clock.now());
}

/** Soft delete is archive. Hard delete is admin only (BR-9). */
export async function deleteDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta) {
  await requireCan(d, ctx, "record.hard_delete", meta);
  const x = await d.db.discount.findUnique({ where: { id: discountId }, include });
  if (!x) throw new AppError(404, "NOT_FOUND", "Not found");
  await d.db.discount.delete({ where: { id: discountId } });
  await writeAudit(d.db, d.clock, { action: "discount.delete", summary: "Discount deleted", actor: actorOf(ctx, x.businessId), entityType: "discount", entityId: discountId, changes: { before: snapshot(x) }, meta });
}

// ---------- Lifecycle (BR-9) ----------
/** What must be true before a discount may go live. */
export function assertPublishable(x: Full, now: Date): void {
  const missing: string[] = [];
  if (!x.titlePt || !x.titleEn) missing.push("title");
  if (x.eligibility.length === 0) missing.push("eligibility");
  if (x.premises.length === 0 && !x.isOnline) missing.push("premises");
  if (missing.length) throw new AppError(422, "INCOMPLETE_DISCOUNT", "Complete the discount before publishing", { missing });
  if (isPastValidity(x, now)) throw new AppError(422, "VALIDITY_PAST", "The validity has ended; extend it first", { today: maputoDate(now) });
}

const TRANSITIONS: Record<"publish" | "pause" | "archive" | "restore", { from: string[]; to: "PUBLISHED" | "PAUSED" | "ARCHIVED" | "DRAFT" }> = {
  publish: { from: ["DRAFT", "PAUSED"], to: "PUBLISHED" },
  pause: { from: ["PUBLISHED"], to: "PAUSED" },
  archive: { from: ["DRAFT", "PUBLISHED", "PAUSED", "EXPIRED"], to: "ARCHIVED" },
  restore: { from: ["ARCHIVED"], to: "DRAFT" },
};

export async function transitionDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, action: keyof typeof TRANSITIONS, meta: Meta) {
  const before = await loadVisible(d, ctx, discountId, meta);
  const t = TRANSITIONS[action];
  if (action === "publish") {
    const biz = await d.db.business.findUniqueOrThrow({ where: { id: before.businessId } });
    // S17 / BR-R11: a business that is not approved can keep drafts but never publish.
    await requireCan(d, ctx, "discount.publish", meta, { isOwn: true, businessApproved: biz.status === "APPROVED" });
    if (biz.status !== "APPROVED") throw new AppError(403, "BUSINESS_NOT_APPROVED", "Your business must be approved before you can publish");
  } else {
    await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  }
  const from = effectiveStatus(before, d.clock.now());
  if (!t.from.includes(from)) throw new AppError(409, "INVALID_STATE", `Cannot ${action} a discount that is ${from}`);
  if (action === "publish") assertPublishable(before, d.clock.now());
  const after = await d.db.discount.update({
    where: { id: discountId },
    data: { status: t.to, ...(action === "publish" ? { publishedAt: d.clock.now() } : {}) },
    include,
  });
  await writeAudit(d.db, d.clock, { action: `discount.${action}`, summary: `Discount ${action}`, actor: actorOf(ctx, before.businessId), entityType: "discount", entityId: discountId, changes: { before: { status: before.status }, after: { status: after.status } }, meta });
  return present(after, d.clock.now());
}

export async function extendValidity(d: AuthDeps, ctx: AuthContext, discountId: string, raw: unknown, meta: Meta) {
  const before = await loadVisible(d, ctx, discountId, meta);
  await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  const { validTo } = extendSchema.parse(raw);
  if (before.status === "ARCHIVED" || before.status === "DRAFT") throw new AppError(409, "INVALID_STATE", "Only live, paused or expired discounts can be extended");
  const current = dateKey(before.validTo);
  if (current && validTo <= current) throw new AppError(422, "BAD_DATES", "The new end date must be later than the current one");
  if (validTo < maputoDate(d.clock.now())) throw new AppError(422, "VALIDITY_PAST", "The new end date is in the past");
  // A persisted EXPIRED discount is not silently re-published: it returns as PAUSED for the owner to republish.
  const after = await d.db.discount.update({ where: { id: discountId }, data: { validTo: asDate(validTo), ...(before.status === "EXPIRED" ? { status: "PAUSED" } : {}) }, include });
  await writeAudit(d.db, d.clock, { action: "discount.extend", summary: "Validity extended", actor: actorOf(ctx, before.businessId), entityType: "discount", entityId: discountId, changes: { before: { validTo: current, status: before.status }, after: { validTo, status: after.status } }, meta });
  return present(after, d.clock.now());
}

export async function duplicateDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta) {
  const src = await loadVisible(d, ctx, discountId, meta);
  await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  const copy = await d.db.discount.create({
    data: {
      businessId: src.businessId, titlePt: `${src.titlePt} (cópia)`.slice(0, 120), titleEn: `${src.titleEn} (copy)`.slice(0, 120),
      descriptionPt: src.descriptionPt, descriptionEn: src.descriptionEn, termsPt: src.termsPt, termsEn: src.termsEn,
      redemptionPt: src.redemptionPt, redemptionEn: src.redemptionEn, promoCode: src.promoCode, validFrom: src.validFrom, validTo: src.validTo,
      scheduleDays: src.scheduleDays, scheduleFrom: src.scheduleFrom, scheduleTo: src.scheduleTo, isOnline: src.isOnline,
      status: "DRAFT", dataOrigin: "REAL", createdAt: d.clock.now(),
      premises: { create: src.premises.map((p) => ({ premiseId: p.premiseId })) },
      eligibility: { create: src.eligibility.map(({ id: _i, discountId: _d, position, ...r }) => ({ ...r, position })) },
    },
    include,
  });
  await writeAudit(d.db, d.clock, { action: "discount.duplicate", summary: "Discount duplicated", actor: actorOf(ctx, src.businessId), entityType: "discount", entityId: copy.id, changes: { from: src.id, after: snapshot(copy) }, meta });
  return present(copy, d.clock.now());
}

export interface BulkResult { id: string; ok: boolean; code?: string }

/** Bulk actions (BR-9). Each id is handled on its own, so one failure never blocks the rest. */
export async function bulkDiscounts(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta): Promise<BulkResult[]> {
  const input = bulkSchema.parse(raw);
  if (input.action === "extend" && !input.validTo) throw new AppError(422, "VALIDATION", "validTo is required to extend");
  const out: BulkResult[] = [];
  for (const discountId of input.ids) {
    try {
      if (input.action === "duplicate") await duplicateDiscount(d, ctx, discountId, meta);
      else if (input.action === "extend") await extendValidity(d, ctx, discountId, { validTo: input.validTo }, meta);
      else await transitionDiscount(d, ctx, discountId, input.action, meta);
      out.push({ id: discountId, ok: true });
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      out.push({ id: discountId, ok: false, code: e.code });
    }
  }
  return out;
}

// ---------- List ----------
export async function listDiscounts(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "discount.draft", meta, { isOwn: true });
  const q = listDiscountSchema.parse(raw);
  const businessId = ctx.user.role === "ADMIN" ? q.businessId : (await actingBusiness(d, ctx, q.businessId)).id;
  const today = asDate(maputoDate(d.clock.now()))!;
  const and: Prisma.DiscountWhereInput[] = [];
  if (q.status === "EXPIRED") and.push({ OR: [{ status: "EXPIRED" }, { status: "PUBLISHED", validTo: { lt: today } }] });
  else if (q.status === "PUBLISHED") and.push({ status: "PUBLISHED", OR: [{ validTo: null }, { validTo: { gte: today } }] });
  else if (q.status) and.push({ status: q.status });
  if (q.validity === "current") and.push({ AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: today } }] }, { OR: [{ validTo: null }, { validTo: { gte: today } }] }] });
  if (q.validity === "upcoming") and.push({ validFrom: { gt: today } });
  if (q.validity === "ended") and.push({ validTo: { lt: today } });
  if (q.q) and.push({ OR: [{ titlePt: { contains: q.q, mode: "insensitive" } }, { titleEn: { contains: q.q, mode: "insensitive" } }] });
  if (q.premiseId) and.push({ premises: { some: { premiseId: q.premiseId } } });
  if (q.categoryId) and.push({ premises: { some: { premise: { categoryId: q.categoryId } } } });
  if (q.cardProductId) and.push({ eligibility: { some: { cardProductId: q.cardProductId } } });
  if (q.walletId) and.push({ eligibility: { some: { walletId: q.walletId } } });
  const where: Prisma.DiscountWhereInput = { ...(businessId ? { businessId } : {}), ...(and.length ? { AND: and } : {}) };
  // Cursor pagination follows the id; title/ending sorts use the id as the tiebreak and page by offset-free cursor on id only when "newest".
  const orderBy: Prisma.DiscountOrderByWithRelationInput[] =
    q.sort === "title" ? [{ titlePt: "asc" }, { id: "desc" }] : q.sort === "ending" ? [{ validTo: { sort: "asc", nulls: "last" } }, { id: "desc" }] : [{ id: "desc" }];
  const rows = await d.db.discount.findMany({ where, orderBy, include, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  const p = page(rows, q.limit);
  const now = d.clock.now();
  return { items: p.items.map((x) => present(x, now)), nextCursor: p.nextCursor };
}

// ---------- Preview (BR-9, BR-R8) ----------
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

export function benefitLabel(r: { benefit: string; value: number | null; valueMzn: number | null; valueTextPt: string | null; valueTextEn: string | null }, lang: Lang): string {
  const pt = lang === "pt";
  switch (r.benefit) {
    case "PERCENT": return pt ? `${fmt(r.value ?? 0)}% de desconto` : `${fmt(r.value ?? 0)}% off`;
    case "FIXED": return pt ? `${r.valueMzn} MT de desconto` : `${r.valueMzn} MT off`;
    case "CASHBACK": return `${fmt(r.value ?? 0)}% cashback`;
    case "BOGO": return pt ? "2 por 1" : "2 for 1";
    case "POINTS": return pt ? `${fmt(r.value ?? 0)} pontos` : `${fmt(r.value ?? 0)} points`;
    default: return (pt ? r.valueTextPt : r.valueTextEn) ?? (pt ? "Oferta" : "Offer");
  }
}

/** Exactly how the discount reads on the app card and in the proximity notification (BR-R8). */
export async function previewDiscount(d: AuthDeps, ctx: AuthContext, discountId: string, lang: Lang, meta: Meta) {
  const x = await loadVisible(d, ctx, discountId, meta);
  const pt = lang === "pt";
  const names = async (r: Full["eligibility"][number]) => {
    if (r.scope === "CARD_PRODUCT") { // "Absa Wealth": short issuer name + segment, as in the BR-R8 examples
      const cp = await d.db.cardProduct.findUnique({ where: { id: r.cardProductId! }, include: { issuer: true } });
      return cp ? `${cp.issuer.shortName} ${cp.segment}` : "";
    }
    if (r.scope === "ISSUER_ANY") return (await d.db.issuer.findUnique({ where: { id: r.issuerId! } }))?.shortName ?? "";
    if (r.scope === "WALLET") return (await d.db.walletProvider.findUnique({ where: { id: r.walletId! } }))?.name ?? "";
    if (r.scope === "ANY_BANK_CARD") return pt ? "qualquer cartão bancário" : "any bank card";
    if (r.scope === "ANY_WALLET") return pt ? "qualquer carteira móvel" : "any mobile wallet";
    return pt ? "todos" : "everyone";
  };
  const cands: OfferCandidate[] = x.eligibility.map((r, rowIndex) => ({ discountId: x.id, rowIndex, row: { ...r, scope: r.scope } }));
  const ranked = rankOffers(cands, { holdings: { cards: [], wallets: [] }, mode: "ALL" });
  const best = ranked[0] ? x.eligibility[ranked[0].rowIndex]! : x.eligibility[0];
  const premise = x.premises[0]?.premise.name ?? (pt ? "online" : "online");
  const until = dateKey(x.validTo);
  const title = pt ? x.titlePt : x.titleEn;
  const who = best ? await names(best) : "";
  const benefit = best ? benefitLabel(best, lang) : "";
  const more = Math.max(0, x.eligibility.length - 1);
  const personal = best !== undefined && best.scope !== "GENERAL";
  const terms = (pt ? x.termsPt : x.termsEn) ?? (best ? (pt ? best.commentPt : best.commentEn) : null) ?? "";
  const suffix = more ? (pt ? ` + ${more} outras ofertas` : ` + ${more} more offers`) : "";
  const notification = personal
    ? { title: pt ? `${benefit} no ${premise}` : `${benefit} at ${premise}`, body: (pt ? `Com o seu ${who}.` : `With your ${who}.`) + (until ? (pt ? ` Válido até ${until}.` : ` Valid until ${until}.`) : "") + suffix }
    : { title: pt ? `Oferta perto de si: ${benefit} no ${premise}` : `Offer near you: ${benefit} at ${premise}`, body: terms + suffix };
  const business = await d.db.business.findUniqueOrThrow({ where: { id: x.businessId } });
  return {
    card: {
      title, business: business.tradingName, premises: x.premises.map((p) => p.premise.name), benefit, forWho: who, validUntil: until,
      days: x.scheduleDays, from: x.scheduleFrom, to: x.scheduleTo, terms, redemption: (pt ? x.redemptionPt : x.redemptionEn) ?? "",
      promoCode: x.promoCode, moreOffers: more, online: x.isOnline,
    },
    notification,
  };
}

// ---------- Jobs and hooks ----------
/** Daily lifecycle job: persists EXPIRED for published discounts whose last valid day has passed (BR-9). Reads already compute it. */
export async function expireDueDiscounts(d: AuthDeps) {
  const today = asDate(maputoDate(d.clock.now()))!;
  const due = await d.db.discount.findMany({ where: { status: "PUBLISHED", validTo: { lt: today } }, select: { id: true, businessId: true } });
  if (!due.length) return { expired: 0 };
  await d.db.discount.updateMany({ where: { id: { in: due.map((x) => x.id) } }, data: { status: "EXPIRED" } });
  await writeAudit(d.db, d.clock, { action: "discount.expire", summary: `Expired ${due.length} discounts`, actor: { role: "SYSTEM" }, entityType: "discount", changes: { ids: due.map((x) => x.id) } });
  return { expired: due.length };
}

/** BR-R11: suspending a business pauses every published discount at once. */
export async function pauseBusinessDiscounts(d: AuthDeps, businessId: string, actor: { userId: string; email: string; role: string }, meta: Meta) {
  const live = await d.db.discount.findMany({ where: { businessId, status: "PUBLISHED" }, select: { id: true } });
  if (!live.length) return 0;
  await d.db.discount.updateMany({ where: { id: { in: live.map((x) => x.id) } }, data: { status: "PAUSED" } });
  await writeAudit(d.db, d.clock, { action: "discount.pause_all", summary: `Paused ${live.length} discounts (business suspended)`, actor: { ...actor, businessId }, entityType: "business", entityId: businessId, changes: { ids: live.map((x) => x.id) }, meta });
  return live.length;
}
