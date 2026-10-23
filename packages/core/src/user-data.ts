// IOS-5 / IOS-7: a person's cards, wallets, alert preferences and favourites. Product-level only: never a card number, expiry, CVV or last 4.
import { z } from "zod";
import { AppError } from "./errors";
import { requireCan } from "./authz";
import { writeAudit } from "./audit";
import { effectiveStatus } from "./discount";
import { pageSchema } from "./pagination";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

const MAX_CARDS = 20;
const id = z.string().min(1).max(60);
const actor = (c: AuthContext) => ({ userId: c.user.id, email: c.user.email, role: c.user.role });
const own = (d: AuthDeps, c: AuthContext, m: Meta) => requireCan(d, c, "self.cards", m);

export const addCardSchema = z.strictObject({ cardProductId: id, nickname: z.string().trim().min(1).max(40).optional() });
export const addWalletSchema = z.strictObject({ walletProviderId: id });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const prefsSchema = z.strictObject({
  alertsEnabled: z.boolean(), mode: z.enum(["PERSONALISED", "PERSONALISED_PLUS_GENERAL", "ALL"]),
  quietFrom: hhmm.nullable(), quietTo: hhmm.nullable(), generalIssuers: z.array(id).max(30), generalWallets: z.array(id).max(10),
}).partial().refine((p) => (p.quietFrom === undefined) === (p.quietTo === undefined) && ((p.quietFrom === null) === (p.quietTo === null)), { message: "Give both quiet hours, or clear both" });

// ---- Cards ----
export async function listMyCards(d: AuthDeps, ctx: AuthContext, meta: Meta) {
  await own(d, ctx, meta);
  const rows = await d.db.userCard.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "asc" }, include: { cardProduct: { include: { issuer: true, network: true } } } });
  return rows.map((r) => ({ id: r.id, nickname: r.nickname, cardProductId: r.cardProductId, name: r.cardProduct.name, issuerId: r.cardProduct.issuerId, issuerName: r.cardProduct.issuer.shortName, networkId: r.cardProduct.networkId, networkName: r.cardProduct.network.name, cardType: r.cardProduct.cardType, segment: r.cardProduct.segment }));
}
export async function addMyCard(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await own(d, ctx, meta);
  const input = addCardSchema.parse(raw);
  const cp = await d.db.cardProduct.findUnique({ where: { id: input.cardProductId } });
  if (!cp || !cp.active) throw new AppError(422, "UNKNOWN_CARD_PRODUCT", "Unknown card");
  if (await d.db.userCard.count({ where: { userId: ctx.user.id } }) >= MAX_CARDS) throw new AppError(409, "TOO_MANY", `At most ${MAX_CARDS} cards`);
  if (await d.db.userCard.findUnique({ where: { userId_cardProductId: { userId: ctx.user.id, cardProductId: cp.id } } })) throw new AppError(409, "ALREADY_ADDED", "You already added this card");
  const row = await d.db.userCard.create({ data: { userId: ctx.user.id, cardProductId: cp.id, nickname: input.nickname, createdAt: d.clock.now() } });
  await writeAudit(d.db, d.clock, { action: "me.card_add", summary: "Card added", actor: actor(ctx), entityType: "user_card", entityId: row.id, changes: { cardProductId: cp.id }, meta });
  return row;
}
export async function removeMyCard(d: AuthDeps, ctx: AuthContext, cardId: string, meta: Meta) {
  await own(d, ctx, meta);
  const res = await d.db.userCard.deleteMany({ where: { id: cardId, userId: ctx.user.id } }); // another person's id simply matches nothing
  if (!res.count) throw new AppError(404, "NOT_FOUND", "Not found");
  await writeAudit(d.db, d.clock, { action: "me.card_remove", summary: "Card removed", actor: actor(ctx), entityType: "user_card", entityId: cardId, meta });
}

// ---- Wallets ----
export async function listMyWallets(d: AuthDeps, ctx: AuthContext, meta: Meta) {
  await own(d, ctx, meta);
  const rows = await d.db.userWallet.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: "asc" }, include: { walletProvider: true } });
  return rows.map((r) => ({ walletProviderId: r.walletProviderId, name: r.walletProvider.name, operator: r.walletProvider.operator }));
}
export async function addMyWallet(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await own(d, ctx, meta);
  const { walletProviderId } = addWalletSchema.parse(raw);
  const w = await d.db.walletProvider.findUnique({ where: { id: walletProviderId } });
  if (!w || !w.active) throw new AppError(422, "UNKNOWN_WALLET", "Unknown wallet");
  if (await d.db.userWallet.findUnique({ where: { userId_walletProviderId: { userId: ctx.user.id, walletProviderId } } })) throw new AppError(409, "ALREADY_ADDED", "You already added this wallet");
  const row = await d.db.userWallet.create({ data: { userId: ctx.user.id, walletProviderId, createdAt: d.clock.now() } });
  await writeAudit(d.db, d.clock, { action: "me.wallet_add", summary: "Wallet added", actor: actor(ctx), entityType: "user_wallet", entityId: walletProviderId, meta });
  return row;
}
export async function removeMyWallet(d: AuthDeps, ctx: AuthContext, walletProviderId: string, meta: Meta) {
  await own(d, ctx, meta);
  const res = await d.db.userWallet.deleteMany({ where: { userId: ctx.user.id, walletProviderId } });
  if (!res.count) throw new AppError(404, "NOT_FOUND", "Not found");
  await writeAudit(d.db, d.clock, { action: "me.wallet_remove", summary: "Wallet removed", actor: actor(ctx), entityType: "user_wallet", entityId: walletProviderId, meta });
}

// ---- Alert preferences ----
export async function getMyPrefs(d: AuthDeps, ctx: AuthContext, meta: Meta) {
  await own(d, ctx, meta);
  const p = await d.db.alertPreference.findUnique({ where: { userId: ctx.user.id } });
  return p ?? { userId: ctx.user.id, alertsEnabled: true, mode: "PERSONALISED" as const, quietFrom: null, quietTo: null, generalIssuers: [] as string[], generalWallets: [] as string[] };
}
export async function putMyPrefs(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await own(d, ctx, meta);
  const input = prefsSchema.parse(raw);
  if (input.generalIssuers?.length && (await d.db.issuer.count({ where: { id: { in: input.generalIssuers } } })) !== new Set(input.generalIssuers).size) throw new AppError(422, "UNKNOWN_ISSUER", "Unknown bank");
  if (input.generalWallets?.length && (await d.db.walletProvider.count({ where: { id: { in: input.generalWallets } } })) !== new Set(input.generalWallets).size) throw new AppError(422, "UNKNOWN_WALLET", "Unknown wallet");
  const row = await d.db.alertPreference.upsert({ where: { userId: ctx.user.id }, create: { userId: ctx.user.id, ...input }, update: input });
  await writeAudit(d.db, d.clock, { action: "me.alert_prefs", summary: "Alert preferences changed", actor: actor(ctx), entityType: "alert_preferences", entityId: ctx.user.id, changes: input, meta });
  return row;
}

// ---- Favourites ----
export async function listMyFavourites(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  await own(d, ctx, meta);
  const q = z.strictObject(pageSchema).parse(raw);
  const rows = await d.db.favorite.findMany({ where: { userId: ctx.user.id }, orderBy: { discountId: "desc" }, take: q.limit + 1, include: { discount: { include: { business: true, premises: { include: { premise: true } } } } }, ...(q.cursor ? { cursor: { userId_discountId: { userId: ctx.user.id, discountId: q.cursor } }, skip: 1 } : {}) });
  const items = rows.slice(0, q.limit).map((f) => ({ id: f.discountId, titlePt: f.discount.titlePt, titleEn: f.discount.titleEn, businessName: f.discount.business.tradingName, status: effectiveStatus(f.discount, d.clock.now()), validTo: f.discount.validTo, premises: f.discount.premises.map((p) => ({ id: p.premiseId, name: p.premise.name })), favouritedAt: f.createdAt }));
  return { items, nextCursor: rows.length > q.limit ? items[items.length - 1]!.id : null };
}
export async function addMyFavourite(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta) {
  await own(d, ctx, meta);
  const x = await d.db.discount.findUnique({ where: { id: discountId }, include: { business: true } });
  if (!x || x.status === "DRAFT" || x.status === "ARCHIVED" || x.business.status !== "APPROVED") throw new AppError(404, "NOT_FOUND", "Not found");
  await d.db.favorite.upsert({ where: { userId_discountId: { userId: ctx.user.id, discountId } }, create: { userId: ctx.user.id, discountId, createdAt: d.clock.now() }, update: {} });
  return { ok: true };
}
export async function removeMyFavourite(d: AuthDeps, ctx: AuthContext, discountId: string, meta: Meta) {
  await own(d, ctx, meta);
  await d.db.favorite.deleteMany({ where: { userId: ctx.user.id, discountId } });
  return { ok: true };
}

/** One call for the app's first screen: holdings, preferences and favourite ids. */
export async function myBundle(d: AuthDeps, ctx: AuthContext, meta: Meta) {
  const [cards, wallets, prefs, favs] = await Promise.all([listMyCards(d, ctx, meta), listMyWallets(d, ctx, meta), getMyPrefs(d, ctx, meta), d.db.favorite.findMany({ where: { userId: ctx.user.id }, select: { discountId: true } })]);
  return { cards, wallets, prefs, favouriteIds: favs.map((f) => f.discountId) };
}

/** Registers or refreshes the APNs token for a device (IOS-2/IOS-7). The token is never logged. */
export const pushTokenSchema = z.strictObject({ vendorId: z.string().min(1).max(80), pushToken: z.string().regex(/^[0-9a-fA-F]{32,200}$/, "hex APNs token"), model: z.string().max(60).optional(), osVersion: z.string().max(30).optional(), appVersion: z.string().max(30).optional() });
export async function registerPushToken(d: AuthDeps, ctx: AuthContext, raw: unknown, meta: Meta) {
  const i = pushTokenSchema.parse(raw);
  const dev = await d.db.device.upsert({
    where: { userId_vendorId: { userId: ctx.user.id, vendorId: i.vendorId } },
    create: { userId: ctx.user.id, vendorId: i.vendorId, pushToken: i.pushToken, model: i.model, osVersion: i.osVersion, appVersion: i.appVersion, lastSeenAt: d.clock.now() },
    update: { pushToken: i.pushToken, model: i.model, osVersion: i.osVersion, appVersion: i.appVersion, lastSeenAt: d.clock.now(), revokedAt: null },
  });
  await writeAudit(d.db, d.clock, { action: "me.push_token", summary: "Push token registered", actor: actor(ctx), entityType: "device", entityId: dev.id, meta });
  return { ok: true, deviceId: dev.id };
}
