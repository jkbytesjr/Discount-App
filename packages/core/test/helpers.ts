import { getDb } from "@moz/db";
import { MemoryMailer, pgRateLimiter, type AuthDeps, type Clock } from "../src";

export const PREFIX = "it-";
export const db = getDb();

export function mutableClock(start = "2026-11-04T11:00:00Z") {
  let t = new Date(start);
  return { now: () => new Date(t), advance: (ms: number) => { t = new Date(t.getTime() + ms); } } satisfies Clock & { advance(ms: number): void };
}

export function makeDeps(clock = mutableClock(), captchaOk = true) {
  const mailer = new MemoryMailer();
  const deps: AuthDeps = {
    db, clock, mailer, limiter: pgRateLimiter(db, clock),
    config: { appEnv: "test", appUrl: "http://localhost:3000", jwtSecret: "test-secret-test-secret-test-secret-123", mfaKey: Buffer.alloc(32, 9).toString("base64") },
    verifyCaptcha: async () => captchaOk,
  };
  return { deps, mailer, clock };
}

let n = 0;
export const uniqueEmail = () => `${PREFIX}${Date.now().toString(36)}${n++}@mozdiscounts.test`;
export const IP = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
export const STRONG = "Str0ng-Passw0rd!";

export function tokenFromMail(html: string): string {
  const m = /token=([\w-]+)/.exec(html);
  if (!m?.[1]) throw new Error("no token in mail");
  return m[1];
}

export async function cleanup() {
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await db.rateLimit.deleteMany({});
}
