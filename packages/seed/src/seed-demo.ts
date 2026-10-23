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
  if (a.business) await db.businessMember.upsert({ where: { userId: user.id }, create: { userId: user.id, businessId: a.business }, update: { businessId: a.business } });
}

await writeAudit(db, systemClock, { action: "seed.demo", summary: "seed:demo executed", actor: { role: "SYSTEM" } });
console.log(`seed:demo done: ${await db.issuer.count()} issuers, ${await db.cardProduct.count()} card products, ${await db.business.count()} businesses, ${await db.user.count({ where: { dataOrigin: "SEED_ILLUSTRATIVE" } })} demo users`);
await db.$disconnect();
