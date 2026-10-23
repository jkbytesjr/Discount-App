// pnpm seed:demo — deterministic and idempotent (upserts). Non-production only.
import path from "node:path";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { getDb } from "@moz/db";
import { hashPassword, systemClock, writeAudit } from "@moz/core";

config({ path: path.resolve(import.meta.dirname, "../../../.env") });

// SEED_TARGET=test seeds the Neon TEST branch instead of dev.
if (process.env.SEED_TARGET === "test") {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const appEnv = process.env.APP_ENV ?? "local";
if (!["local", "test", "poc", "staging"].includes(appEnv)) throw new Error(`seed:demo refuses APP_ENV=${appEnv}`);
const password = process.env.SEED_DEMO_PASSWORD;
if (!password) throw new Error("SEED_DEMO_PASSWORD is not set");

const load = <T>(f: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../data", f), "utf8")) as T;
const db = getDb();
type Origin = "SEED_VERIFIED" | "SEED_ILLUSTRATIVE";

const cat = load<any>("catalogue.json");
const verifiedIssuers = true; // bank names come from the Banco de Moçambique register (SD-1, SRC-6)

for (const i of cat.issuers) {
  const data = { name: i.name, shortName: i.shortName, note: i.note ?? null, dataOrigin: (verifiedIssuers ? "SEED_VERIFIED" : "SEED_ILLUSTRATIVE") as Origin, sourceUrl: "https://en.wikipedia.org/wiki/List_of_banks_in_Mozambique" };
  await db.issuer.upsert({ where: { id: i.id }, create: { id: i.id, ...data }, update: data });
}
for (const n of cat.networks) await db.cardNetwork.upsert({ where: { id: n.id }, create: n, update: { name: n.name } });
for (const c of cat.cardProducts) {
  const data = {
    issuerId: c.issuer, networkId: c.network, cardType: c.type, segment: c.segment, name: c.name, note: c.note ?? null,
    dataOrigin: (c.origin ?? "SEED_ILLUSTRATIVE") as Origin, sourceUrl: c.sourceUrl ?? null,
  };
  await db.cardProduct.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
}
for (const w of cat.wallets) {
  const data = { name: w.name, operator: w.operator, dataOrigin: "SEED_VERIFIED" as Origin };
  await db.walletProvider.upsert({ where: { id: w.id }, create: { id: w.id, ...data }, update: data });
}
for (const [idx, [id, pt, en, icon]] of cat.categories.entries()) {
  const data = { namePt: pt, nameEn: en, icon, sortOrder: idx };
  await db.premiseCategory.upsert({ where: { id }, create: { id, ...data }, update: data });
}

for (const b of load<any[]>("businesses.json")) {
  const data = {
    type: b.type, tradingName: b.tradingName, issuerId: b.issuerId ?? null, walletProviderId: b.walletProviderId ?? null,
    status: b.status, dataOrigin: "SEED_ILLUSTRATIVE" as Origin,
    ...(b.status === "APPROVED" ? { approvedAt: new Date() } : {}),
  };
  await db.business.upsert({ where: { id: b.id }, create: { id: b.id, ...data }, update: data });
}

for (const p of load<any[]>("premises.json")) {
  const data = {
    businessId: p.businessId, categoryId: p.categoryId, name: p.name, address: p.address, city: p.city,
    lat: p.lat, lng: p.lng, approx: p.approx, dataOrigin: "SEED_ILLUSTRATIVE" as Origin,
  };
  await db.premise.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
}

const productIssuer = new Map<string, string>(cat.cardProducts.map((c: any) => [c.id, c.issuer]));
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
for (const d of load<any[]>("discounts.json")) {
  const data = {
    businessId: d.business, titlePt: d.title.pt, titleEn: d.title.en, status: d.status,
    dataOrigin: (d.dataOrigin ?? "SEED_ILLUSTRATIVE") as Origin, sourceRef: d.source ?? null, isOnline: d.isOnline,
    validFrom: day(d.validFrom), validTo: day(d.validTo),
    scheduleDays: d.schedule?.days ?? [], scheduleFrom: d.schedule?.from ?? null, scheduleTo: d.schedule?.to ?? null,
    publishedAt: d.status === "PUBLISHED" || d.status === "EXPIRED" ? (day(d.validFrom) ?? new Date()) : null,
  };
  await db.discount.upsert({ where: { id: d.id }, create: { id: d.id, ...data }, update: data });
  await db.discountPremise.deleteMany({ where: { discountId: d.id } });
  await db.discountEligibility.deleteMany({ where: { discountId: d.id } });
  await db.discountPremise.createMany({ data: d.premises.map((premiseId: string) => ({ discountId: d.id, premiseId })) });
  await db.discountEligibility.createMany({
    data: d.eligibility.map((e: any, position: number) => ({
      discountId: d.id, position, scope: e.scope, benefit: e.benefit,
      cardProductId: e.cardProduct ?? null, issuerId: e.issuer ?? productIssuer.get(e.cardProduct) ?? null, // CARD_PRODUCT rows carry the product's issuer
      walletId: e.wallet ?? null, cardType: e.cardType ?? null,
      value: e.value ?? null, valueMzn: e.valueMzn ?? null, valueTextPt: e.valueText?.pt ?? null, valueTextEn: e.valueText?.en ?? null,
      minSpendMzn: e.minSpendMzn ?? null, maxDiscountMzn: e.maxDiscountMzn ?? null, commentPt: e.comment?.pt ?? null, commentEn: e.comment?.en ?? null,
    })),
  });
}

for (const a of load<any[]>("accounts.json")) {
  const now = new Date();
  const data = {
    firstName: a.first, lastName: a.last, role: a.role, dataOrigin: "SEED_ILLUSTRATIVE" as Origin,
    status: a.unverified ? ("PENDING_VERIFICATION" as const) : ("ACTIVE" as const),
    emailVerifiedAt: a.unverified ? null : now, locale: "pt-MZ",
  };
  const existing = await db.user.findUnique({ where: { email: a.email } });
  // Re-hash only when the account is new, so re-runs stay fast; use seed:reset-passwords to change them.
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data })
    : await db.user.create({ data: { email: a.email, passwordHash: await hashPassword(password), ...data } });
  // SD-8 personas: cards, wallets, alert preferences and favourites (product level only: no card numbers)
  if (a.cards || a.wallets || a.prefs || a.favourites) {
    await db.userCard.deleteMany({ where: { userId: user.id } });
    await db.userWallet.deleteMany({ where: { userId: user.id } });
    await db.favorite.deleteMany({ where: { userId: user.id } });
    if (a.cards?.length) await db.userCard.createMany({ data: a.cards.map((cardProductId: string) => ({ userId: user.id, cardProductId })) });
    if (a.wallets?.length) await db.userWallet.createMany({ data: a.wallets.map((walletProviderId: string) => ({ userId: user.id, walletProviderId })) });
    if (a.favourites?.length) await db.favorite.createMany({ data: a.favourites.map((discountId: string) => ({ userId: user.id, discountId })) });
    if (a.prefs) await db.alertPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...a.prefs }, update: a.prefs });
  }
  if (a.business) await db.businessMember.upsert({ where: { userId: user.id }, create: { userId: user.id, businessId: a.business }, update: { businessId: a.business } });
}

await writeAudit(db, systemClock, { action: "seed.demo", summary: "seed:demo executed", actor: { role: "SYSTEM" } });
console.log(`seed:demo done: ${await db.issuer.count()} issuers, ${await db.cardProduct.count()} card products, ${await db.business.count()} businesses, ${await db.premise.count()} premises, ${await db.discount.count()} discounts, ${await db.user.count({ where: { dataOrigin: "SEED_ILLUSTRATIVE" } })} demo users`);
await db.$disconnect();
