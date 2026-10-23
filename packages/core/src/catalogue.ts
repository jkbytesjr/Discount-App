import { z } from "zod";
import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { requireCan } from "./authz";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

// Admin-managed master data (BR-2.1). Public read returns active rows only.
// BR-R9: rows are never hard-deleted (they may be referenced later); DELETE deactivates.
const url = z.string().url().max(500).refine((u) => u.startsWith("https://"), "https only");
const text = (n: number) => z.string().trim().min(1).max(n);

export const KINDS = {
  issuers: {
    model: "issuer",
    create: z.strictObject({ name: text(120), shortName: text(60), logoUrl: url.optional(), note: z.string().max(500).optional(), active: z.boolean().default(true) }),
  },
  "card-networks": {
    model: "cardNetwork",
    create: z.strictObject({ name: text(60), logoUrl: url.optional(), active: z.boolean().default(true) }),
  },
  "card-products": {
    model: "cardProduct",
    create: z.strictObject({
      issuerId: z.string().uuid().or(z.string().regex(/^iss-[\w-]+$/)), networkId: z.string().uuid().or(z.string().regex(/^net-[\w-]+$/)),
      cardType: z.enum(["DEBIT", "CREDIT", "PREPAID"]), segment: text(60), name: text(120),
      imageUrl: url.optional(), note: z.string().max(500).optional(), active: z.boolean().default(true),
    }),
  },
  "wallet-providers": {
    model: "walletProvider",
    create: z.strictObject({ name: text(60), operator: text(80), logoUrl: url.optional(), active: z.boolean().default(true) }),
  },
  "premise-categories": {
    model: "premiseCategory",
    create: z.strictObject({ namePt: text(80), nameEn: text(80), icon: text(40), sortOrder: z.number().int().min(0).max(1000).default(100), active: z.boolean().default(true) }),
  },
} as const;
export type Kind = keyof typeof KINDS;
export const isKind = (k: string): k is Kind => k in KINDS;

// Prisma delegates have different generic types; this is the small common surface we use.
interface Delegate {
  findMany(a: object): Promise<any[]>;
  findUnique(a: object): Promise<any | null>;
  create(a: object): Promise<any>;
  update(a: object): Promise<any>;
}
const delegate = (d: AuthDeps, kind: Kind) => (d.db as unknown as Record<string, Delegate>)[KINDS[kind].model]!;
const actorOf = (c: AuthContext) => ({ userId: c.user.id, email: c.user.email, role: c.user.role });

export async function listCatalogue(d: AuthDeps, kind: Kind, includeInactive = false) {
  const order = kind === "premise-categories" ? { sortOrder: "asc" } : { name: "asc" };
  return delegate(d, kind).findMany({ where: includeInactive ? {} : { active: true }, orderBy: order });
}

export async function getCatalogueItem(d: AuthDeps, kind: Kind, id: string) {
  const row = await delegate(d, kind).findUnique({ where: { id } });
  if (!row) throw new AppError(404, "NOT_FOUND", "Not found");
  return row;
}

async function checkRefs(d: AuthDeps, kind: Kind, data: Record<string, unknown>) {
  if (kind !== "card-products") return;
  if (typeof data.issuerId === "string" && !(await d.db.issuer.findUnique({ where: { id: data.issuerId } }))) throw new AppError(422, "UNKNOWN_ISSUER", "Unknown issuer");
  if (typeof data.networkId === "string" && !(await d.db.cardNetwork.findUnique({ where: { id: data.networkId } }))) throw new AppError(422, "UNKNOWN_NETWORK", "Unknown network");
}

export async function createCatalogueItem(d: AuthDeps, ctx: AuthContext, kind: Kind, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "catalogue.manage", meta);
  const data = KINDS[kind].create.parse(raw) as Record<string, unknown>;
  await checkRefs(d, kind, data);
  const row = await delegate(d, kind).create({ data: { ...data, ...(kind === "premise-categories" ? {} : { dataOrigin: "REAL" }) } });
  await writeAudit(d.db, d.clock, { action: `catalogue.${kind}.create`, summary: `Created ${kind} item`, actor: actorOf(ctx), entityType: kind, entityId: row.id, changes: { after: row }, meta });
  return row;
}

export async function updateCatalogueItem(d: AuthDeps, ctx: AuthContext, kind: Kind, id: string, raw: unknown, meta: Meta) {
  await requireCan(d, ctx, "catalogue.manage", meta);
  const data = (KINDS[kind].create as z.ZodObject<any>).partial().parse(raw) as Record<string, unknown>;
  const before = await getCatalogueItem(d, kind, id);
  await checkRefs(d, kind, data);
  const after = await delegate(d, kind).update({ where: { id }, data });
  await writeAudit(d.db, d.clock, { action: `catalogue.${kind}.update`, summary: `Updated ${kind} item`, actor: actorOf(ctx), entityType: kind, entityId: id, changes: { before, after }, meta });
  return after;
}

export async function deactivateCatalogueItem(d: AuthDeps, ctx: AuthContext, kind: Kind, id: string, meta: Meta) {
  await requireCan(d, ctx, "catalogue.manage", meta);
  const before = await getCatalogueItem(d, kind, id);
  const after = await delegate(d, kind).update({ where: { id }, data: { active: false } });
  await writeAudit(d.db, d.clock, { action: `catalogue.${kind}.deactivate`, summary: `Deactivated ${kind} item`, actor: actorOf(ctx), entityType: kind, entityId: id, changes: { before: { active: before.active }, after: { active: false } }, meta });
  return after;
}
