// BR-10: alert event log. Devices report lifecycle events (also from an offline queue, so ingestion is idempotent).
import { z } from "zod";
import type { Prisma } from "@moz/db";
import { TIME_ZONE } from "@moz/shared";
import { AppError } from "./errors";
import { requireCan } from "./authz";
import { page, pageSchema } from "./pagination";
import { EXPORT_ROW_CAP, toXlsx } from "./xlsx";
import { coarse } from "./auth/deps";
import { writeAudit } from "./audit";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

export const EVENT_TYPES = ["TRIGGERED", "DELIVERED", "OPENED", "DISMISSED", "DETAIL_VIEWED", "SUPPRESSED"] as const;
export const SUPPRESS_REASONS = ["ALERTS_DISABLED", "NO_MATCH", "NOT_ACTIVE", "QUIET_HOURS", "COOLDOWN", "DAILY_CAP"] as const;
const id = z.string().min(1).max(80);

export const eventSchema = z.strictObject({
  clientEventId: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  reason: z.enum(SUPPRESS_REASONS).optional(),
  premiseId: id,
  discountIds: z.array(id).max(20).default([]),
  occurredAt: z.string().datetime({ offset: true }),
  distanceM: z.number().int().min(0).max(100_000).optional(),
  lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
  deviceId: z.string().max(80).optional(), appVersion: z.string().max(30).optional(), osVersion: z.string().max(30).optional(),
});
export const ingestSchema = z.strictObject({ events: z.array(eventSchema).min(1).max(50) });

export async function ingestAlertEvents(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const { events } = ingestSchema.parse(raw);
  const now = d.clock.now();
  for (const e of events) {
    if (e.type === "SUPPRESSED" && !e.reason) throw new AppError(422, "REASON_REQUIRED", "A suppressed event needs a reason");
    if (e.type !== "SUPPRESSED" && e.reason) throw new AppError(422, "REASON_NOT_ALLOWED", "Only suppressed events carry a reason");
    if (new Date(e.occurredAt).getTime() > now.getTime() + 10 * 60_000) throw new AppError(422, "FUTURE_EVENT", "The event time is in the future");
  }
  const premises = await d.db.premise.findMany({ where: { id: { in: [...new Set(events.map((e) => e.premiseId))] } }, select: { id: true } });
  const known = new Set(premises.map((p) => p.id));
  const accepted = events.filter((e) => known.has(e.premiseId));
  const res = await d.db.alertEvent.createMany({
    skipDuplicates: true, // the same clientEventId sent twice (offline queue retry) is stored once
    data: accepted.map((e) => ({
      clientEventId: e.clientEventId, userId: ctx.user.id, deviceId: e.deviceId ?? meta.deviceId ?? null, premiseId: e.premiseId, discountIds: e.discountIds,
      type: e.type, reason: e.reason ?? null, occurredAt: new Date(e.occurredAt), receivedAt: now, distanceM: e.distanceM ?? null,
      coarseLat: e.lat === undefined ? null : coarse(e.lat), coarseLng: e.lng === undefined ? null : coarse(e.lng), // ~100 m only (privacy)
      appVersion: e.appVersion ?? null, osVersion: e.osVersion ?? null,
    })),
  });
  return { received: events.length, stored: res.count, duplicates: accepted.length - res.count, unknownPremise: events.length - accepted.length };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filterShape = { type: z.enum(EVENT_TYPES).optional(), premiseId: id.optional(), discountId: id.optional(), userId: z.string().uuid().optional(), from: day.optional(), to: day.optional() };
export const alertQuerySchema = z.strictObject({ ...filterShape, ...pageSchema });
export const alertExportSchema = z.strictObject(filterShape);

function where(q: { type?: string; premiseId?: string; discountId?: string; userId?: string; from?: string; to?: string }): Prisma.AlertEventWhereInput {
  const w: Prisma.AlertEventWhereInput = {};
  if (q.type) w.type = q.type as never;
  if (q.premiseId) w.premiseId = q.premiseId;
  if (q.discountId) w.discountIds = { has: q.discountId };
  if (q.userId) w.userId = q.userId;
  if (q.from || q.to) w.occurredAt = { ...(q.from ? { gte: new Date(`${q.from}T00:00:00+02:00`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00+02:00`).getTime() + 86_400_000) } : {}) };
  return w;
}

/** Admin sees every event (alerts.view = allow). */
export async function listAlertEvents(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "alerts.view", meta);
  if (ctx.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Admin only: businesses see aggregated reports instead");
  const q = alertQuerySchema.parse(raw);
  const rows = await d.db.alertEvent.findMany({ where: where(q), orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return page(rows, q.limit);
}

/** A user's own history ("Alerts inbox"). */
export async function myAlertEvents(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "alerts.view", meta, { isOwn: true });
  const q = alertQuerySchema.pick({ cursor: true, limit: true }).parse(raw);
  const rows = await d.db.alertEvent.findMany({ where: { userId: ctx.user.id }, orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return page(rows, q.limit);
}

const stamp = (t: Date) => new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "medium", timeZone: TIME_ZONE }).format(t);

export async function exportAlertEvents(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "alerts.view", meta);
  if (ctx.user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "Admin only");
  const q = alertExportSchema.parse(raw);
  const rows = await d.db.alertEvent.findMany({ where: where(q), orderBy: { id: "desc" }, take: EXPORT_ROW_CAP });
  await writeAudit(d.db, d.clock, { action: "alerts.export", summary: `Exported ${rows.length} alert events`, actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, changes: { filters: q, rows: rows.length }, meta });
  return {
    rows: rows.length,
    file: await toXlsx("Alert events", [
      { header: "Time (Maputo)", width: 20, value: (r) => stamp(r.occurredAt) }, { header: "Type", value: (r) => r.type }, { header: "Reason", value: (r) => r.reason },
      { header: "User", width: 38, value: (r) => r.userId }, { header: "Device", value: (r) => r.deviceId }, { header: "Premise", width: 24, value: (r) => r.premiseId },
      { header: "Discounts", width: 24, value: (r) => r.discountIds.join(", ") }, { header: "Distance (m)", value: (r) => r.distanceM },
      { header: "Lat (~100 m)", value: (r) => r.coarseLat }, { header: "Lng (~100 m)", value: (r) => r.coarseLng }, { header: "App", value: (r) => r.appVersion }, { header: "OS", value: (r) => r.osVersion },
    ], rows),
  };
}
