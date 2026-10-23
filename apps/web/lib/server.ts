import { ConsoleMailer, ResendMailer, pgRateLimiter, systemClock, type AuthDeps, type Clock, type Mailer } from "@moz/core";
import { getDb } from "@moz/db";

type AppEnv = AuthDeps["config"]["appEnv"];
export const appEnv = (process.env.APP_ENV ?? "local") as AppEnv;
export const isSecure = appEnv === "poc" || appEnv === "production";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
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
  mailer ??= process.env.RESEND_API_KEY
    ? new ResendMailer(process.env.RESEND_API_KEY, process.env.EMAIL_FROM ?? "Moz Discounts <onboarding@resend.dev>")
    : new ConsoleMailer();
  return mailer;
}

export function getDeps(req: Request): AuthDeps {
  const db = getDb();
  const clock = clockFor(req);
  return {
    db, clock, mailer: getMailer(), limiter: pgRateLimiter(db, clock), verifyCaptcha: verifyTurnstile,
    config: {
      appEnv, appUrl: process.env.APP_URL ?? "http://localhost:3000",
      jwtSecret: need("JWT_SECRET"), mfaKey: need("MFA_ENC_KEY"),
    },
  };
}
