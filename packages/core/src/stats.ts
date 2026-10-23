// BR-12 (POC scope, assumption 1): one simple stats view for admin and for each business, plus a per-discount report.
// Business views are aggregated counts only: no personal data (BR-10).
import { z } from "zod";
import { AppError } from "./errors";
import { requireCan } from "./authz";
import { actingBusiness } from "./premise";
import { effectiveStatus } from "./discount";
import { maputoDate } from "./offers";
import { toXlsx } from "./xlsx";
import { writeAudit } from "./audit";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

const DAY = 86_400_000;
const EVENT_SCAN_CAP = 50_000;
export const statsQuerySchema = z.strictObject({ days: z.coerce.number().int().min(1).max(90).default(14), businessId: z.string().max(60).optional() });

interface Ev { type: string; occurredAt: Date; discountIds: string[]; premiseId: string }
const series = (events: Ev[], days: number, now: Date) => {
  const keys = Array.from({ length: days }, (_, i) => maputoDate(new Date(now.getTime() - (days - 1 - i) * DAY)));
  const by = new Map(keys.map((k) => [k, { date: k, delivered: 0, opened: 0 }]));
  for (const e of events) { const b = by.get(maputoDate(e.occurredAt)); if (!b) continue; if (e.type === "DELIVERED") b.delivered++; if (e.type === "OPENED") b.opened++; }
  return [...by.values()];
};
const rate = (opened: number, delivered: number) => (delivered ? Math.round((opened / delivered) * 1000) / 10 : null);

export async function adminStats(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "stats.view", meta);
  if (ctx.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Admin only");
  const q = statsQuerySchema.parse(raw);
  const now = d.clock.now();
  const since = new Date(now.getTime() - q.days * DAY);
  const [users, bizs, discounts, premises, favourites, events, topFav] = await Promise.all([
    d.db.user.groupBy({ by: ["role"], where: { status: { not: "DELETED" } }, _count: true }),
    d.db.business.groupBy({ by: ["status"], _count: true }),
    d.db.discount.groupBy({ by: ["status"], _count: true }),
    d.db.premise.count({ where: { status: "ACTIVE" } }),
    d.db.favorite.count(),
    d.db.alertEvent.findMany({ where: { occurredAt: { gte: since } }, select: { type: true, occurredAt: true, discountIds: true, premiseId: true }, take: EVENT_SCAN_CAP, orderBy: { occurredAt: "desc" } }),
    d.db.favorite.groupBy({ by: ["discountId"], _count: true, orderBy: { _count: { discountId: "desc" } }, take: 5 }),
  ]);
  const count = (t: string) => events.filter((e) => e.type === t).length;
  const perDiscount = new Map<string, { delivered: number; opened: number }>();
  for (const e of events) for (const id of e.discountIds) {
    const c = perDiscount.get(id) ?? { delivered: 0, opened: 0 };
    if (e.type === "DELIVERED") c.delivered++; if (e.type === "OPENED") c.opened++;
    perDiscount.set(id, c);
  }
  const ids = [...new Set([...perDiscount.keys(), ...topFav.map((f) => f.discountId)])];
  const titles = new Map((await d.db.discount.findMany({ where: { id: { in: ids } }, select: { id: true, titlePt: true, titleEn: true } })).map((x) => [x.id, x]));
  const top = [...perDiscount.entries()].sort((a, b) => b[1].opened - a[1].opened || b[1].delivered - a[1].delivered).slice(0, 5)
    .map(([id, c]) => ({ id, titlePt: titles.get(id)?.titlePt ?? id, titleEn: titles.get(id)?.titleEn ?? id, ...c }));
  return {
    days: q.days,
    users: Object.fromEntries(users.map((u) => [u.role, u._count])), businesses: Object.fromEntries(bizs.map((b) => [b.status, b._count])),
    discounts: Object.fromEntries(discounts.map((x) => [x.status, x._count])), premises, favourites,
    alerts: { triggered: count("TRIGGERED"), delivered: count("DELIVERED"), opened: count("OPENED"), dismissed: count("DISMISSED"), suppressed: count("SUPPRESSED"), openRatePct: rate(count("OPENED"), count("DELIVERED")) },
    series: series(events, q.days, now), topDiscounts: top,
    topFavourited: topFav.map((f) => ({ id: f.discountId, titlePt: titles.get(f.discountId)?.titlePt ?? f.discountId, titleEn: titles.get(f.discountId)?.titleEn ?? f.discountId, favourites: f._count })),
  };
}

async function reportRows(d: AuthDeps, businessId: string, days: number) {
  const now = d.clock.now();
  const since = new Date(now.getTime() - days * DAY);
  const discounts = await d.db.discount.findMany({ where: { businessId }, orderBy: { id: "desc" }, select: { id: true, titlePt: true, titleEn: true, status: true, validTo: true, publishedAt: true } });
  const ids = discounts.map((x) => x.id);
  const [events, favs] = await Promise.all([
    ids.length ? d.db.alertEvent.findMany({ where: { occurredAt: { gte: since }, discountIds: { hasSome: ids } }, select: { type: true, occurredAt: true, discountIds: true, premiseId: true }, take: EVENT_SCAN_CAP }) : Promise.resolve([]),
    ids.length ? d.db.favorite.groupBy({ by: ["discountId"], where: { discountId: { in: ids } }, _count: true }) : Promise.resolve([]),
  ]);
  const favBy = new Map(favs.map((f) => [f.discountId, f._count]));
  const rows = discounts.map((x) => {
    const mine = events.filter((e) => e.discountIds.includes(x.id));
    const c = (t: string) => mine.filter((e) => e.type === t).length;
    const delivered = c("DELIVERED"), opened = c("OPENED");
    return { id: x.id, titlePt: x.titlePt, titleEn: x.titleEn, status: effectiveStatus(x, now), validTo: x.validTo ? x.validTo.toISOString().slice(0, 10) : null,
      impressions: c("DETAIL_VIEWED"), alertsSent: delivered, alertsOpened: opened, dismissed: c("DISMISSED"), openRatePct: rate(opened, delivered), favourites: favBy.get(x.id) ?? 0 };
  });
  return { rows, events, now };
}

/** Business view: per-discount impressions (offer views), alerts sent, opened and favourites. Counts only. */
export async function businessStats(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "stats.view", meta, { isOwn: true });
  const q = statsQuerySchema.parse(raw);
  const biz = await actingBusiness(d, ctx, q.businessId);
  const { rows, events, now } = await reportRows(d, biz.id, q.days);
  const sum = (k: "impressions" | "alertsSent" | "alertsOpened" | "favourites") => rows.reduce((n, r) => n + r[k], 0);
  return {
    days: q.days, business: { id: biz.id, name: biz.tradingName }, discounts: rows,
    totals: { impressions: sum("impressions"), alertsSent: sum("alertsSent"), alertsOpened: sum("alertsOpened"), favourites: sum("favourites"), openRatePct: rate(sum("alertsOpened"), sum("alertsSent")) },
    series: series(events, q.days, now),
  };
}

export async function exportBusinessReport(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "stats.view", meta, { isOwn: true });
  const q = statsQuerySchema.parse(raw);
  const biz = await actingBusiness(d, ctx, q.businessId);
  const { rows } = await reportRows(d, biz.id, q.days);
  await writeAudit(d.db, d.clock, { action: "report.export", summary: `Exported discount report (${rows.length} discounts)`, actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role, businessId: biz.id }, entityType: "business", entityId: biz.id, meta });
  return {
    file: await toXlsx("Discount report", [
      { header: "Discount (PT)", width: 36, value: (r) => r.titlePt }, { header: "Discount (EN)", width: 36, value: (r) => r.titleEn }, { header: "Status", value: (r) => r.status }, { header: "Valid until", value: (r) => r.validTo },
      { header: "Offer views", value: (r) => r.impressions }, { header: "Alerts sent", value: (r) => r.alertsSent }, { header: "Alerts opened", value: (r) => r.alertsOpened },
      { header: "Dismissed", value: (r) => r.dismissed }, { header: "Open rate %", value: (r) => r.openRatePct }, { header: "Favourites", value: (r) => r.favourites },
    ], rows),
  };
}
