import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { encrypt, hashPassword } from "@moz/core";
import { getDb } from "@moz/db";
import { generateSync } from "otplib";

export const db = getDb();
export const PW = "E2e-Passw0rd!x";
export const OUTBOX = path.resolve(import.meta.dirname, "../.e2e-outbox");
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function lastMailTo(to: string): { subject: string; html: string } | undefined {
  if (!fs.existsSync(OUTBOX)) return undefined;
  const mails = fs.readdirSync(OUTBOX).sort().map((f) => JSON.parse(fs.readFileSync(path.join(OUTBOX, f), "utf8")) as { to: string; subject: string; html: string });
  return mails.filter((m) => m.to === to).at(-1);
}
export async function waitForMail(to: string, match = /./) {
  for (let i = 0; i < 40; i++) { const m = lastMailTo(to); if (m && match.test(m.subject)) return m; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error(`no mail to ${to}`);
}
export const linkIn = (html: string) => /href="([^"]+)"/.exec(html)![1]!;

/** Admin with 2FA already enabled, so it can log in with a TOTP code. */
export async function makeAdmin(email: string) {
  const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  await db.user.create({ data: { email, role: "ADMIN", firstName: "E2E", lastName: "Admin", passwordHash: await hashPassword(PW), status: "ACTIVE", emailVerifiedAt: new Date(), mfaEnabled: true, mfaSecretEnc: encrypt(secret, process.env.MFA_ENC_KEY!) } });
  return { totp: () => generateSync({ secret }) };
}

export async function login(page: Page, email: string, password = PW, totp?: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/palavra-passe|password/i).first().fill(password);
  await page.getByRole("button", { name: /iniciar sessão|sign in/i }).click();
  if (totp) { await page.getByLabel(/código|code/i).fill(totp); await page.getByRole("button", { name: /iniciar sessão|sign in/i }).click(); }
}

/** Fails on serious/critical WCAG A/AA violations. */
export async function expectAccessible(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), "axe").toEqual([]);
}

export async function cleanupE2E() {
  await db.user.deleteMany({ where: { email: { startsWith: "e2e-" } } });
  await db.business.deleteMany({ where: { tradingName: { startsWith: "E2E " } } });
  await db.issuer.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await db.rateLimit.deleteMany({});
  fs.rmSync(OUTBOX, { recursive: true, force: true });
}
