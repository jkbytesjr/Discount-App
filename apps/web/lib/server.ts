import { after } from "next/server";
import { ApnsPushSender, ConsoleMailer, ConsolePushSender, FileMailer, ResendMailer, pgRateLimiter, systemClock, type AuthDeps, type Clock, type Mailer, type PushSender } from "@moz/core";
import { getDb } from "@moz/db";

type AppEnv = AuthDeps["config"]["appEnv"];
export const appEnv = (process.env.APP_ENV ?? "local") as AppEnv;
export const isSecure = appEnv === "poc" || appEnv === "production";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let push: PushSender | undefined;
function getPush(): PushSender {
  // APNs needs the Apple Developer Program key; without it pushes are printed to the server log.
  push ??= process.env.APNS_KEY_P8 && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID
    ? new ApnsPushSender({ keyP8: process.env.APNS_KEY_P8, keyId: process.env.APNS_KEY_ID, teamId: process.env.APNS_TEAM_ID, bundleId: process.env.APNS_BUNDLE_ID, sandbox: process.env.APNS_ENV !== "production" })
    : new ConsolePushSender();
  return push;
}

// Test-only clock override: X-Test-Now is honoured only when APP_ENV is local/test (TD-2).
export function clockFor(req: Request): Clock {
  const h = req.headers.get("x-test-now");
  if (h && (appEnv === "local" || appEnv === "test")) {
    const d = new Date(h);
    if (!Number.isNaN(d.getTime())) return { now: () => new Date(d) };
  }
  return systemClock;
}

async function verifyTurnstile(token: string | undefined, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return appEnv === "local" || appEnv === "test"; // fail closed outside local dev
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  return res.ok && ((await res.json()) as { success?: boolean }).success === true;
}

let mailer: Mailer | undefined;
function getMailer(): Mailer {
  const outbox = process.env.MAIL_OUTBOX_DIR;
  mailer ??= outbox && (appEnv === "local" || appEnv === "test") ? new FileMailer(outbox)
    : process.env.RESEND_API_KEY ? new ResendMailer(process.env.RESEND_API_KEY, process.env.EMAIL_FROM ?? "Moz Discounts <onboarding@resend.dev>")
    : new ConsoleMailer();
  return mailer;
}

export function getDeps(req: Request): AuthDeps {
  const db = getDb();
  const clock = clockFor(req);
  return {
    db, clock, mailer: getMailer(), limiter: pgRateLimiter(db, clock), verifyCaptcha: verifyTurnstile, push: getPush(), defer: (fn) => { try { after(fn); } catch { void fn(); } }, // outside a Next request scope (unit tests) run inline
    config: {
      appEnv, appUrl: process.env.APP_URL ?? "http://localhost:3000",
      jwtSecret: need("JWT_SECRET"), mfaKey: need("MFA_ENC_KEY"),
      skipEmailVerification: process.env.SKIP_EMAIL_VERIFICATION === "1" && (appEnv === "local" || appEnv === "test"),
    },
  };
}
