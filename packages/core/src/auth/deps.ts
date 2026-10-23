import type { PrismaClient } from "@moz/db";
import type { Clock } from "../clock";
import type { Mailer } from "../mailer";
import type { RateLimiter } from "../rate-limit";
import type { RequestMeta } from "../audit";
import type { PushSender } from "../push";

export interface AuthConfig {
  appEnv: "local" | "test" | "poc" | "production";
  appUrl: string; // used in email links
  jwtSecret: string;
  mfaKey: string; // base64, 32 bytes
  /** Local/test only: new accounts are verified on registration and no email is sent (POC convenience). */
  skipEmailVerification?: boolean;
}

export interface AuthDeps {
  db: PrismaClient;
  clock: Clock;
  mailer: Mailer;
  limiter: RateLimiter;
  config: AuthConfig;
  /** APNs (or a stand-in) for favourite-update pushes. */
  push?: PushSender;
  /** Run work after the response (Next `after()`); absent = run inline, which keeps tests deterministic. */
  defer?: (fn: () => Promise<unknown>) => void;
  /** Returns true when the Turnstile token is valid. */
  verifyCaptcha: (token: string | undefined, ip?: string | null) => Promise<boolean>;
}

export type Meta = RequestMeta;

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();
// ~100 m precision (3 decimals of a degree) for coarse location (privacy)
export const coarse = (n: number) => Math.round(n * 1000) / 1000;
