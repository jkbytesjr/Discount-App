// BR-3: admin audit trail UI and Excel export. Admin only in the POC (assumption 5).
import { z } from "zod";
import type { Prisma } from "@moz/db";
import { TIME_ZONE } from "@moz/shared";
import { writeAudit } from "./audit";
import { requireCan } from "./authz";
import { page, pageSchema } from "./pagination";
import { EXPORT_ROW_CAP, toXlsx } from "./xlsx";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const auditFilterShape = {
  from: day.optional(), to: day.optional(),
  action: z.string().trim().max(80).optional(), actor: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(40).optional(), entityId: z.string().trim().max(80).optional(),
  result: z.enum(["success", "failure"]).optional(),
};
export const auditQuerySchema = z.strictObject({ ...auditFilterShape, ...pageSchema });
export const auditExportSchema = z.strictObject(auditFilterShape);

const MAPUTO = "+02:00"; // fixed offset, no DST (DEC-028)
type Filters = z.infer<typeof auditExportSchema>;
function where(q: Filters): Prisma.AuditLogWhereInput {
  const w: Prisma.AuditLogWhereInput = {};
  if (q.from || q.to) w.occurredAt = { ...(q.from ? { gte: new Date(`${q.from}T00:00:00${MAPUTO}`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00${MAPUTO}`).getTime() + 86_400_000) } : {}) };
  if (q.action) w.action = { contains: q.action, mode: "insensitive" };
  if (q.actor) w.actorEmail = { contains: q.actor, mode: "insensitive" };
  if (q.entityType) w.entityType = q.entityType;
  if (q.entityId) w.entityId = q.entityId;
  if (q.result) w.result = q.result;
  return w;
}

export async function listAudit(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "audit.view", meta);
  const q = auditQuerySchema.parse(raw);
  const rows = await d.db.auditLog.findMany({ where: where(q), orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return page(rows, q.limit);
}

const stamp = (t: Date) => new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "medium", timeZone: TIME_ZONE }).format(t);

export async function exportAudit(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "audit.view", meta);
  const q = auditExportSchema.parse(raw);
  const rows = await d.db.auditLog.findMany({ where: where(q), orderBy: { id: "desc" }, take: EXPORT_ROW_CAP });
  await writeAudit(d.db, d.clock, { action: "audit.export", summary: `Exported ${rows.length} audit rows`, actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, changes: { filters: q, rows: rows.length }, meta });
  return {
    rows: rows.length, capped: rows.length === EXPORT_ROW_CAP,
    file: await toXlsx("Audit trail", [
      { header: "Time (Maputo)", width: 20, value: (r) => stamp(r.occurredAt) }, { header: "Actor", width: 28, value: (r) => r.actorEmail }, { header: "Role", value: (r) => r.actorRole },
      { header: "Action", width: 26, value: (r) => r.action }, { header: "Entity", value: (r) => r.entityType }, { header: "Entity id", width: 26, value: (r) => r.entityId },
      { header: "Summary", width: 40, value: (r) => r.summary }, { header: "Result", value: (r) => r.result }, { header: "IP", value: (r) => r.ip },
      { header: "Changes (JSON)", width: 60, value: (r) => (r.changes ? JSON.stringify(r.changes).slice(0, 2000) : null) },
    ], rows),
  };
}
