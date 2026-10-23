import { z } from "zod";
import type { Prisma } from "@moz/db";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { notFoundDenied, requireCan } from "./authz";
import { insideMozambique } from "./geo";
import { page, pageSchema } from "./pagination";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

const text = (n: number) => z.string().trim().min(1).max(n);
const id = z.string().min(1).max(60);

const fields = {
  categoryId: id,
  name: text(160),
  address: text(300).optional(),
  city: text(80).optional(),
  province: text(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  alertRadiusM: z.number().int().min(50).max(1000).default(150),
  openingHours: text(300).optional(),
  phone: z.string().regex(/^\+258\d{9}$/, "Use +258 followed by 9 digits").optional(),
  /** Admin-only override for online or cross-border offers (BR-8). */
  allowOutsideMozambique: z.boolean().optional(),
};

export const createPremiseSchema = z.strictObject({ businessId: id.optional(), ...fields });
export const updatePremiseSchema = z.strictObject({ ...fields, alertRadiusM: fields.alertRadiusM.optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() }).partial();
export const listPremiseSchema = z.strictObject({
  businessId: id.optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional(), categoryId: id.optional(),
  q: z.string().trim().max(100).optional(), ...pageSchema,
});

const actorOf = (c: AuthContext, businessId?: string) => ({ userId: c.user.id, email: c.user.email, role: c.user.role, businessId });

/** The business the caller acts for: an owner's own, or the one an admin names. */
export async function actingBusiness(d: AuthDeps, ctx: AuthContext, businessId?: string) {
  if (ctx.user.role === "ADMIN") {
    if (!businessId) throw new AppError(422, "BUSINESS_REQUIRED", "Name the business");
    const biz = await d.db.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new AppError(404, "NOT_FOUND", "Not found");
    return biz;
  }
  const m = await d.db.businessMember.findUnique({ where: { userId: ctx.user.id }, include: { business: true } });
  if (!m) throw new AppError(409, "NO_BUSINESS", "Create a business profile first");
  if (businessId && businessId !== m.businessId) throw new AppError(404, "NOT_FOUND", "Not found");
  return m.business;
}

async function checkPlace(d: AuthDeps, ctx: AuthContext, v: { categoryId?: string; lat?: number; lng?: number; allowOutsideMozambique?: boolean }) {
  if (v.categoryId) {
    const c = await d.db.premiseCategory.findUnique({ where: { id: v.categoryId } });
    if (!c || !c.active) throw new AppError(422, "UNKNOWN_CATEGORY", "Unknown premise category");
  }
  if ((v.lat === undefined) !== (v.lng === undefined)) throw new AppError(422, "BAD_COORDINATES", "Give both latitude and longitude, or neither");
  if (v.lat !== undefined && v.lng !== undefined && !insideMozambique(v.lat, v.lng)) {
    if (!(v.allowOutsideMozambique && ctx.user.role === "ADMIN")) throw new AppError(422, "OUTSIDE_MOZAMBIQUE", "These coordinates are outside Mozambique");
  }
}

async function loadVisible(d: AuthDeps, ctx: AuthContext, premiseId: string, meta: Meta) {
  const p = await d.db.premise.findUnique({ where: { id: premiseId } });
  if (ctx.user.role === "ADMIN") {
    if (!p) throw new AppError(404, "NOT_FOUND", "Not found");
    return p;
  }
  const m = p ? await d.db.businessMember.findUnique({ where: { userId: ctx.user.id } }) : null;
  if (!p || m?.businessId !== p.businessId) return notFoundDenied(d, ctx, "premise", premiseId, meta);
  return p;
}

const strip = ({ allowOutsideMozambique: _a, businessId: _b, ...rest }: Record<string, unknown>) => rest;

export async function createPremise(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "premise.write", meta, { isOwn: true });
  const input = createPremiseSchema.parse(raw);
  const biz = await actingBusiness(d, ctx, input.businessId);
  if (biz.status === "SUSPENDED") throw new AppError(409, "BUSINESS_SUSPENDED", "This business is suspended");
  await checkPlace(d, ctx, input);
  const p = await d.db.premise.create({
    data: { ...(strip(input) as Prisma.PremiseUncheckedCreateInput), businessId: biz.id, dataOrigin: "REAL", createdAt: d.clock.now() },
  });
  await writeAudit(d.db, d.clock, { action: "premise.create", summary: "Premise created", actor: actorOf(ctx, biz.id), entityType: "premise", entityId: p.id, changes: { after: p }, meta });
  return p;
}

export async function getPremise(d: AuthDeps, ctx: AuthContext, premiseId: string, meta: Meta) {
  return loadVisible(d, ctx, premiseId, meta);
}

export async function updatePremise(d: AuthDeps, ctx: AuthContext, premiseId: string, raw: unknown, meta: Meta) {
  const before = await loadVisible(d, ctx, premiseId, meta);
  await requireCan(d, ctx, "premise.write", meta, { isOwn: true });
  const input = updatePremiseSchema.parse(raw);
  await checkPlace(d, ctx, { ...input, lat: input.lat ?? before.lat ?? undefined, lng: input.lng ?? before.lng ?? undefined });
  const after = await d.db.premise.update({ where: { id: before.id }, data: strip(input) as Prisma.PremiseUncheckedUpdateInput });
  await writeAudit(d.db, d.clock, { action: "premise.update", summary: "Premise updated", actor: actorOf(ctx, before.businessId), entityType: "premise", entityId: before.id, changes: { before, after }, meta });
  return after;
}

export async function listPremises(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "premise.write", meta, { isOwn: true });
  const q = listPremiseSchema.parse(raw);
  let businessId = q.businessId;
  if (ctx.user.role !== "ADMIN") businessId = (await actingBusiness(d, ctx, q.businessId)).id;
  const where: Prisma.PremiseWhereInput = {
    ...(businessId ? { businessId } : {}), ...(q.status ? { status: q.status } : {}), ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { city: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await d.db.premise.findMany({ where, orderBy: { id: "desc" }, take: q.limit + 1, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  return page(rows, q.limit);
}

/** Deactivating hides the premise from users; it stays linked for history (BR-R9 spirit). */
export async function setPremiseStatus(d: AuthDeps, ctx: AuthContext, premiseId: string, status: "ACTIVE" | "INACTIVE", meta: Meta) {
  return updatePremise(d, ctx, premiseId, { status }, meta);
}

/** Hard delete: admin only (BR-9) and only while no discount references the premise. */
export async function deletePremise(d: AuthDeps, ctx: AuthContext, premiseId: string, meta: Meta) {
  await requireCan(d, ctx, "record.hard_delete", meta);
  const p = await d.db.premise.findUnique({ where: { id: premiseId } });
  if (!p) throw new AppError(404, "NOT_FOUND", "Not found");
  if (await d.db.discountPremise.count({ where: { premiseId } })) throw new AppError(409, "IN_USE", "A discount still uses this premise; deactivate it instead");
  await d.db.premise.delete({ where: { id: premiseId } });
  await writeAudit(d.db, d.clock, { action: "premise.delete", summary: "Premise deleted", actor: actorOf(ctx, p.businessId), entityType: "premise", entityId: premiseId, changes: { before: p }, meta });
}

// ---------- CSV import (BR-8) ----------
export const MAX_IMPORT_ROWS = 500;
export const CSV_COLUMNS = ["name", "category", "address", "city", "province", "lat", "lng", "phone", "alert_radius_m", "opening_hours"] as const;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF. */
export function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ""; let quoted = false;
  const s = src.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export interface ImportResult { created: number; errors: { line: number; message: string }[]; dryRun: boolean }

export const importPremisesSchema = z.strictObject({ businessId: id.optional(), csv: z.string().max(500_000), dryRun: z.boolean().default(false) });

/** All-or-nothing: any invalid row means nothing is created and every error is reported by line number. */
export async function importPremises(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta): Promise<ImportResult> {
  await requireCan(d, ctx, "premise.write", meta, { isOwn: true });
  const input = importPremisesSchema.parse(raw);
  const biz = await actingBusiness(d, ctx, input.businessId);
  if (biz.status === "SUSPENDED") throw new AppError(409, "BUSINESS_SUSPENDED", "This business is suspended");
  const [header, ...body] = parseCsv(input.csv);
  if (!header) throw new AppError(422, "EMPTY_CSV", "The file is empty");
  const cols = header.map((h) => h.trim().toLowerCase());
  for (const required of ["name", "category"]) if (!cols.includes(required)) throw new AppError(422, "BAD_HEADER", `Missing column: ${required}`, { expected: CSV_COLUMNS });
  const unknown = cols.filter((c) => !(CSV_COLUMNS as readonly string[]).includes(c));
  if (unknown.length) throw new AppError(422, "BAD_HEADER", `Unknown columns: ${unknown.join(", ")}`, { expected: CSV_COLUMNS });
  if (body.length > MAX_IMPORT_ROWS) throw new AppError(422, "TOO_MANY_ROWS", `At most ${MAX_IMPORT_ROWS} rows per import`);

  const categories = await d.db.premiseCategory.findMany({ where: { active: true } });
  const byKey = new Map<string, string>();
  for (const c of categories) for (const k of [c.id, c.namePt, c.nameEn]) byKey.set(k.toLowerCase(), c.id);

  const errors: ImportResult["errors"] = [];
  const data: Prisma.PremiseUncheckedCreateInput[] = [];
  body.forEach((cells, idx) => {
    const line = idx + 2;
    const get = (c: string) => cells[cols.indexOf(c)]?.trim() || undefined;
    const num = (c: string) => { const v = get(c); return v === undefined ? undefined : Number(v.replace(",", ".")); };
    const categoryId = byKey.get((get("category") ?? "").toLowerCase());
    if (!categoryId) { errors.push({ line, message: `Unknown category "${get("category") ?? ""}"` }); return; }
    const parsed = createPremiseSchema.safeParse({
      categoryId, name: get("name"), address: get("address"), city: get("city"), province: get("province"),
      lat: num("lat"), lng: num("lng"), phone: get("phone"), openingHours: get("opening_hours"),
      ...(get("alert_radius_m") ? { alertRadiusM: num("alert_radius_m") } : {}),
    });
    if (!parsed.success) { errors.push({ line, message: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ") }); return; }
    const v = parsed.data;
    if ((v.lat === undefined) !== (v.lng === undefined)) { errors.push({ line, message: "Give both latitude and longitude, or neither" }); return; }
    if (v.lat !== undefined && v.lng !== undefined && !insideMozambique(v.lat, v.lng)) { errors.push({ line, message: "Coordinates are outside Mozambique" }); return; }
    data.push({ ...(strip(v) as Prisma.PremiseUncheckedCreateInput), businessId: biz.id, dataOrigin: "REAL", createdAt: d.clock.now() });
  });

  if (errors.length || input.dryRun) return { created: 0, errors, dryRun: input.dryRun };
  await d.db.premise.createMany({ data });
  await writeAudit(d.db, d.clock, { action: "premise.import", summary: `Imported ${data.length} premises`, actor: actorOf(ctx, biz.id), entityType: "business", entityId: biz.id, changes: { count: data.length }, meta });
  return { created: data.length, errors: [], dryRun: false };
}
