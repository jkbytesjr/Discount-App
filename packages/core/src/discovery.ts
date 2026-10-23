// Public discovery (BR-11, IOS-6/7/8 API): what users and the web map may see. No login.
// Visibility is BR-R2: published discount, approved business, active premise, inside validity and schedule.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@moz/db";
import { AppError } from "./errors";
import { benefitLabel, type Lang } from "./discount";
import { distanceM } from "./geo";
import { dateKey, isActiveAt, isPastValidity, maputoDate, rankOffers, type EligibilityRowLike, type OfferCandidate } from "./offers";
import type { AuthDeps } from "./auth/deps";

export const NEARBY_RADIUS = { default: 2000, min: 500, max: 10_000 } as const;
export const RECENT_DAYS = 30;
export const ENDING_SOON_DAYS = 7;
export const GEOFENCE_LIMIT = 20; // iOS monitors at most 20 regions per app (IOS-8)
const GEOFENCE_MAX_DISTANCE_M = 50_000;
const DAY_MS = 86_400_000;

// ---------- Query schemas ----------
const csv = z.string().max(500).transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.string().min(1).max(60)).max(30));
const lang = z.enum(["pt", "en"]).default("pt");
export const filterSchema = {
  issuer: csv.optional(), wallet: csv.optional(),
  cardType: csv.pipe(z.array(z.enum(["DEBIT", "CREDIT", "PREPAID"]))).optional(),
  segment: csv.optional(), category: csv.optional(),
  general: z.enum(["0", "1", "true", "false"]).optional(),
  lang,
};
const coord = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const bboxSchema = z.strictObject({
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, "minLng,minLat,maxLng,maxLat"),
  ...filterSchema, limit: z.coerce.number().int().min(1).max(500).default(200), cursor: z.string().min(1).max(60).optional(), // premise ids may be slugs (seed data) or UUIDs
});
export const nearbySchema = z.strictObject({
  lat: coord(-90, 90), lng: coord(-180, 180), radius: z.coerce.number().min(NEARBY_RADIUS.min).max(NEARBY_RADIUS.max).default(NEARBY_RADIUS.default),
  ...filterSchema, limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const recentSchema = z.strictObject({ kind: z.enum(["recent", "ending"]).default("recent"), lang, limit: z.coerce.number().int().min(1).max(50).default(20) });
export const detailSchema = z.strictObject({ lang });
export const syncSchema = z.strictObject({ lat: coord(-90, 90), lng: coord(-180, 180) });

export interface Filters { issuers: string[]; wallets: string[]; cardTypes: string[]; segments: string[]; categories: string[]; general: boolean }
const filtersOf = (q: { issuer?: string[]; wallet?: string[]; cardType?: string[]; segment?: string[]; category?: string[]; general?: string }): Filters => ({
  issuers: q.issuer ?? [], wallets: q.wallet ?? [], cardTypes: q.cardType ?? [], segments: q.segment ?? [], categories: q.category ?? [], general: q.general === "1" || q.general === "true",
});
const hasWho = (f: Filters) => f.issuers.length + f.wallets.length + f.cardTypes.length + f.segments.length > 0 || f.general;

// ---------- Loading ----------
type DiscountFull = Prisma.DiscountGetPayload<{ include: { eligibility: true; business: true; premises: { include: { premise: true } } } }>;
interface Names { issuers: Map<string, string>; wallets: Map<string, string>; products: Map<string, { name: string; issuerId: string; cardType: string; segment: string; networkId: string }> }

async function loadNames(d: AuthDeps): Promise<Names> {
  const [is, ws, ps] = await Promise.all([d.db.issuer.findMany(), d.db.walletProvider.findMany(), d.db.cardProduct.findMany()]);
  return {
    issuers: new Map(is.map((x) => [x.id, x.shortName])), wallets: new Map(ws.map((x) => [x.id, x.name])),
    products: new Map(ps.map((x) => [x.id, { name: x.name, issuerId: x.issuerId, cardType: x.cardType, segment: x.segment, networkId: x.networkId }])),
  };
}

/** Rows a database filter can already rule out: published, approved business, validity not ended. Schedule is checked in code. */
async function loadDiscounts(d: AuthDeps, now: Date, extra: Prisma.DiscountWhereInput = {}): Promise<DiscountFull[]> {
  const today = new Date(`${maputoDate(now)}T00:00:00.000Z`);
  return d.db.discount.findMany({
    where: { status: "PUBLISHED", business: { status: "APPROVED" }, AND: [{ OR: [{ validTo: null }, { validTo: { gte: today } }] }, { OR: [{ validFrom: null }, { validFrom: { lte: today } }] }], ...extra },
    include: { eligibility: { orderBy: { position: "asc" } }, business: true, premises: { include: { premise: true } } },
  });
}

function rowMatches(r: DiscountFull["eligibility"][number], f: Filters, n: Names): boolean {
  const p = r.cardProductId ? n.products.get(r.cardProductId) : undefined;
  if (f.general && r.scope === "GENERAL") return true;
  if (f.issuers.length && ((r.scope === "CARD_PRODUCT" || r.scope === "ISSUER_ANY") && f.issuers.includes(r.issuerId ?? "") || r.scope === "ANY_BANK_CARD")) return true;
  if (f.wallets.length && ((r.scope === "WALLET" && f.wallets.includes(r.walletId ?? "")) || r.scope === "ANY_WALLET")) return true;
  if (f.cardTypes.length) {
    if (r.scope === "CARD_PRODUCT" && p && f.cardTypes.includes(p.cardType)) return true;
    if ((r.scope === "ISSUER_ANY" || r.scope === "ANY_BANK_CARD") && (!r.cardType || f.cardTypes.includes(r.cardType))) return true;
  }
  if (f.segments.length && r.scope === "CARD_PRODUCT" && p && f.segments.includes(p.segment)) return true;
  return false;
}

// ---------- DTOs ----------
const row = (r: DiscountFull["eligibility"][number], n: Names, l: Lang, matched: boolean) => ({
  scope: r.scope, benefit: r.benefit, label: benefitLabel(r, l), value: r.value, valueMzn: r.valueMzn,
  cardProductId: r.cardProductId, cardProductName: r.cardProductId ? (n.products.get(r.cardProductId)?.name ?? null) : null,
  issuerId: r.issuerId, issuerName: r.issuerId ? (n.issuers.get(r.issuerId) ?? null) : null,
  walletId: r.walletId, walletName: r.walletId ? (n.wallets.get(r.walletId) ?? null) : null,
  cardType: r.cardType ?? (r.cardProductId ? (n.products.get(r.cardProductId)?.cardType ?? null) : null), networkId: r.networkId,
  segment: r.cardProductId ? (n.products.get(r.cardProductId)?.segment ?? null) : null,
  minSpendMzn: r.minSpendMzn, maxDiscountMzn: r.maxDiscountMzn,
  comment: (l === "pt" ? r.commentPt : r.commentEn) ?? null, matched,
});

const offer = (x: DiscountFull, n: Names, l: Lang, f: Filters, now: Date) => {
  const filtering = hasWho(f);
  return {
    id: x.id, title: l === "pt" ? x.titlePt : x.titleEn, businessId: x.businessId, businessName: x.business.tradingName,
    description: (l === "pt" ? x.descriptionPt : x.descriptionEn) ?? null, terms: (l === "pt" ? x.termsPt : x.termsEn) ?? null,
    redemption: (l === "pt" ? x.redemptionPt : x.redemptionEn) ?? null, promoCode: x.promoCode,
    validFrom: dateKey(x.validFrom), validTo: dateKey(x.validTo), days: x.scheduleDays, from: x.scheduleFrom, to: x.scheduleTo,
    isOnline: x.isOnline, publishedAt: x.publishedAt, activeNow: isActiveAt(x, true, now),
    rows: x.eligibility.map((r) => row(r, n, l, !filtering || rowMatches(r, f, n))),
  };
};
type OfferDto = ReturnType<typeof offer>;

const premiseBase = (p: DiscountFull["premises"][number]["premise"]) => ({
  id: p.id, name: p.name, categoryId: p.categoryId, lat: p.lat, lng: p.lng, address: p.address, city: p.city, province: p.province,
  alertRadiusM: p.alertRadiusM, openingHours: p.openingHours, phone: p.phone,
});

/** Best row first (BR-R3 with no personal holdings: everything is in one group). */
function bestRow(offers: OfferDto[]): OfferDto["rows"][number] | null {
  const cands: OfferCandidate[] = [];
  const index: OfferDto["rows"][number][] = [];
  offers.forEach((o) => o.rows.filter((r) => r.matched).forEach((r) => {
    cands.push({ discountId: o.id, rowIndex: index.length, publishedAt: o.publishedAt, row: { scope: r.scope, benefit: r.benefit, value: r.value, valueMzn: r.valueMzn } satisfies EligibilityRowLike });
    index.push(r);
  }));
  const top = rankOffers(cands, { holdings: { cards: [], wallets: [] }, mode: "ALL" })[0];
  return top ? (index[top.rowIndex] ?? null) : null;
}

function summarise(p: ReturnType<typeof premiseBase>, offers: OfferDto[]) {
  const rows = offers.flatMap((o) => o.rows.filter((r) => r.matched));
  const best = bestRow(offers);
  return {
    ...p, offerCount: offers.length, best: best ? { label: best.label, benefit: best.benefit } : null,
    issuerIds: [...new Set(rows.map((r) => r.issuerId).filter((x): x is string => !!x))],
    walletIds: [...new Set(rows.map((r) => r.walletId).filter((x): x is string => !!x))],
    cardTypes: [...new Set(rows.map((r) => r.cardType).filter((x): x is string => !!x))],
    general: rows.some((r) => r.scope === "GENERAL"), anyCard: rows.some((r) => r.scope === "ANY_BANK_CARD"), anyWallet: rows.some((r) => r.scope === "ANY_WALLET"),
  };
}

/** Active offers grouped by premise, after filters. Premises need coordinates unless `allowNoCoords`. */
async function activeByPremise(d: AuthDeps, now: Date, f: Filters, l: Lang, opts: { where?: Prisma.DiscountWhereInput; premiseFilter?: (p: DiscountFull["premises"][number]["premise"]) => boolean; allowNoCoords?: boolean } = {}) {
  const [discounts, names] = await Promise.all([loadDiscounts(d, now, opts.where), loadNames(d)]);
  const groups = new Map<string, { premise: ReturnType<typeof premiseBase>; offers: OfferDto[] }>();
  for (const x of discounts) {
    if (!isActiveAt(x, true, now)) continue;
    if (hasWho(f) && !x.eligibility.some((r) => rowMatches(r, f, names))) continue;
    const dto = offer(x, names, l, f, now);
    for (const { premise: p } of x.premises) {
      if (p.status !== "ACTIVE" || (!opts.allowNoCoords && (p.lat === null || p.lng === null))) continue;
      if (f.categories.length && !f.categories.includes(p.categoryId)) continue;
      if (opts.premiseFilter && !opts.premiseFilter(p)) continue;
      const g = groups.get(p.id) ?? { premise: premiseBase(p), offers: [] };
      g.offers.push(dto);
      groups.set(p.id, g);
    }
  }
  return { groups, names };
}

// ---------- Public queries ----------
/** BR-11: premises inside a viewport, with chip filters. Paginated by premise id. */
export async function mapPremises(d: AuthDeps, raw: unknown) {
  const q = bboxSchema.parse(raw);
  const [minLng, minLat, maxLng, maxLat] = q.bbox.split(",").map(Number) as [number, number, number, number];
  if (minLat >= maxLat || minLng >= maxLng || minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) throw new AppError(422, "BAD_BBOX", "The bounding box is invalid");
  const f = filtersOf(q);
  const { groups } = await activeByPremise(d, d.clock.now(), f, q.lang, {
    where: { premises: { some: { premise: { status: "ACTIVE", lat: { gte: minLat, lte: maxLat }, lng: { gte: minLng, lte: maxLng } } } } },
    premiseFilter: (p) => p.lat! >= minLat && p.lat! <= maxLat && p.lng! >= minLng && p.lng! <= maxLng,
  });
  const all = [...groups.values()].sort((a, b) => (a.premise.id < b.premise.id ? 1 : -1)); // newest id first, like the other lists
  const start = q.cursor ? all.findIndex((g) => g.premise.id === q.cursor) + 1 : 0;
  const slice = all.slice(start, start + q.limit);
  const items = slice.map((g) => summarise(g.premise, g.offers));
  return { items, total: all.length, nextCursor: start + q.limit < all.length ? slice[slice.length - 1]!.premise.id : null };
}

/** IOS-6: one entry per (discount, premise) within the radius, nearest first. */
export async function nearbyDiscounts(d: AuthDeps, raw: unknown) {
  const q = nearbySchema.parse(raw);
  const f = filtersOf(q);
  const dLat = q.radius / 111_320; const dLng = q.radius / (111_320 * Math.max(0.01, Math.cos((q.lat * Math.PI) / 180)));
  const { groups } = await activeByPremise(d, d.clock.now(), f, q.lang, {
    where: { premises: { some: { premise: { status: "ACTIVE", lat: { gte: q.lat - dLat, lte: q.lat + dLat }, lng: { gte: q.lng - dLng, lte: q.lng + dLng } } } } },
    premiseFilter: (p) => distanceM(q.lat, q.lng, p.lat!, p.lng!) <= q.radius,
  });
  const items = [...groups.values()].flatMap((g) => {
    const dist = Math.round(distanceM(q.lat, q.lng, g.premise.lat!, g.premise.lng!));
    return g.offers.map((o) => ({ distanceM: dist, premise: { id: g.premise.id, name: g.premise.name, categoryId: g.premise.categoryId, lat: g.premise.lat, lng: g.premise.lng, address: g.premise.address, city: g.premise.city }, discount: o }));
  }).sort((a, b) => a.distanceM - b.distanceM || (a.discount.id < b.discount.id ? 1 : -1));
  return { items: items.slice(0, q.limit), total: items.length, radius: q.radius };
}

/** IOS-7: newest offers (30 days) or those ending within 7 days. Online offers are included. */
export async function recentDiscounts(d: AuthDeps, raw: unknown) {
  const q = recentSchema.parse(raw);
  const now = d.clock.now();
  const [all, names] = await Promise.all([loadDiscounts(d, now), loadNames(d)]);
  const noFilter = filtersOf({});
  const today = maputoDate(now); const soon = maputoDate(new Date(now.getTime() + ENDING_SOON_DAYS * DAY_MS));
  const rows = all
    .filter((x) => !isPastValidity(x, now) && (x.isOnline || x.premises.some((p) => p.premise.status === "ACTIVE")))
    .filter((x) => (q.kind === "recent" ? !!x.publishedAt && x.publishedAt.getTime() >= now.getTime() - RECENT_DAYS * DAY_MS : !!dateKey(x.validTo) && dateKey(x.validTo)! >= today && dateKey(x.validTo)! <= soon));
  rows.sort((a, b) => q.kind === "recent" ? (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) : dateKey(a.validTo)!.localeCompare(dateKey(b.validTo)!));
  const items = rows.slice(0, q.limit).map((x) => ({
    ...offer(x, names, q.lang, noFilter, now),
    premises: x.premises.filter((p) => p.premise.status === "ACTIVE").map((p) => ({ id: p.premise.id, name: p.premise.name, lat: p.premise.lat, lng: p.premise.lng })),
  }));
  return { items, kind: q.kind };
}

/** Premise panel: the premise and every offer that is active right now. */
export async function premiseDetail(d: AuthDeps, premiseId: string, raw: unknown) {
  const q = detailSchema.parse(raw);
  const { groups } = await activeByPremise(d, d.clock.now(), filtersOf({}), q.lang, { where: { premises: { some: { premiseId } } }, premiseFilter: (p) => p.id === premiseId, allowNoCoords: true });
  const g = groups.get(premiseId);
  if (g) return { ...g.premise, offers: g.offers };
  // A premise with no active offer is still public if it is active and its business approved.
  const p = await d.db.premise.findUnique({ where: { id: premiseId }, include: { business: true } });
  if (!p || p.status !== "ACTIVE" || p.business.status !== "APPROVED") throw new AppError(404, "NOT_FOUND", "Not found");
  return { ...premiseBase(p), offers: [] as OfferDto[] };
}

/** One offer that is published, approved and inside its validity (schedule shown via `activeNow`). */
export async function discountDetail(d: AuthDeps, discountId: string, raw: unknown) {
  const q = detailSchema.parse(raw);
  const now = d.clock.now();
  const [found, names] = await Promise.all([loadDiscounts(d, now, { id: discountId }), loadNames(d)]);
  const x = found[0];
  if (!x) throw new AppError(404, "NOT_FOUND", "Not found");
  return {
    ...offer(x, names, q.lang, filtersOf({}), now),
    premises: x.premises.filter((p) => p.premise.status === "ACTIVE").map((p) => ({ ...premiseBase(p.premise) })),
  };
}

/** Chip data for the filter bar: only issuers/wallets/segments that have a live offer somewhere. */
export async function mapFilters(d: AuthDeps, raw: unknown) {
  const q = detailSchema.parse(raw);
  const { groups, names } = await activeByPremise(d, d.clock.now(), filtersOf({}), q.lang);
  const issuers = new Set<string>(), wallets = new Set<string>(), segments = new Set<string>(), categories = new Set<string>(), types = new Set<string>();
  let general = false;
  for (const g of groups.values()) {
    categories.add(g.premise.categoryId);
    for (const o of g.offers) for (const r of o.rows) {
      if (r.issuerId) issuers.add(r.issuerId);
      if (r.walletId) wallets.add(r.walletId);
      if (r.segment) segments.add(r.segment);
      if (r.cardType) types.add(r.cardType);
      if (r.scope === "GENERAL") general = true;
    }
  }
  const cats = await d.db.premiseCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return {
    issuers: [...issuers].map((id) => ({ id, name: names.issuers.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
    wallets: [...wallets].map((id) => ({ id, name: names.wallets.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
    cardTypes: ["DEBIT", "CREDIT", "PREPAID"].filter((t) => types.has(t)), segments: [...segments].sort(),
    categories: cats.filter((c) => categories.has(c.id)).map((c) => ({ id: c.id, name: q.lang === "pt" ? c.namePt : c.nameEn, icon: c.icon })), general,
  };
}

/** IOS-8: the nearest 20 premises with coordinates plus compact offers so the device can match and schedule on its own. */
export async function geofenceSync(d: AuthDeps, raw: unknown) {
  const q = syncSchema.parse(raw);
  const now = d.clock.now();
  const discounts = await loadDiscounts(d, now); // schedule is left to the device (it knows the local time)
  const near = new Map<string, { id: string; name: string; lat: number; lng: number; radiusM: number; dist: number; discountIds: string[] }>();
  for (const x of discounts) {
    if (isPastValidity(x, now)) continue;
    for (const { premise: p } of x.premises) {
      if (p.status !== "ACTIVE" || p.lat === null || p.lng === null) continue;
      const dist = distanceM(q.lat, q.lng, p.lat, p.lng);
      if (dist > GEOFENCE_MAX_DISTANCE_M) continue;
      const g = near.get(p.id) ?? { id: p.id, name: p.name, lat: p.lat, lng: p.lng, radiusM: p.alertRadiusM, dist, discountIds: [] };
      g.discountIds.push(x.id); near.set(p.id, g);
    }
  }
  const premises = [...near.values()].sort((a, b) => a.dist - b.dist || (a.id < b.id ? -1 : 1)).slice(0, GEOFENCE_LIMIT);
  const needed = new Set(premises.flatMap((p) => p.discountIds));
  const offers = discounts.filter((x) => needed.has(x.id)).sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) => ({
    id: x.id, titlePt: x.titlePt, titleEn: x.titleEn, businessName: x.business.tradingName, publishedAt: x.publishedAt,
    validFrom: dateKey(x.validFrom), validTo: dateKey(x.validTo), days: x.scheduleDays, from: x.scheduleFrom, to: x.scheduleTo,
    rows: x.eligibility.map((r) => ({ scope: r.scope, cardProductId: r.cardProductId, issuerId: r.issuerId, walletId: r.walletId, cardType: r.cardType, networkId: r.networkId, benefit: r.benefit, value: r.value, valueMzn: r.valueMzn, minSpendMzn: r.minSpendMzn, maxDiscountMzn: r.maxDiscountMzn })),
  }));
  const body = { premises: premises.map(({ dist: _d, ...p }) => ({ ...p, discountIds: p.discountIds.sort() })), offers, limit: GEOFENCE_LIMIT };
  const etag = `"${createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 24)}"`;
  return { body, etag };
}
