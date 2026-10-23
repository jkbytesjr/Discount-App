import { SignJWT, jwtVerify } from "jose";
import type { Session, User } from "@moz/db";
import { AppError } from "../errors";
import { randomToken, safeEqual, sha256 } from "../crypto";
import { type AuthDeps, DAY, MIN, type Meta } from "./deps";

export const WEB_IDLE_MS = 30 * MIN;
export const WEB_ABSOLUTE_MS = 12 * 60 * MIN;
export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_MS = 30 * DAY;

// ---- Web session (cookie holds a random token; DB stores only its hash) ----
export async function createWebSession(d: AuthDeps, userId: string, mfaPassed: boolean, meta: Meta) {
  const token = randomToken();
  const csrfToken = randomToken(16);
  const now = d.clock.now();
  await d.db.session.create({
    data: {
      userId, tokenHash: sha256(token), csrfToken, mfaPassed,
      ip: meta.ip ?? null, userAgent: meta.userAgent ?? null,
      createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + WEB_ABSOLUTE_MS),
    },
  });
  return { token, csrfToken };
}

// ---- iOS tokens ----
export async function signAccessToken(d: AuthDeps, user: Pick<User, "id" | "role">) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("moz-discounts")
    .setIssuedAt(Math.floor(d.clock.now().getTime() / 1000))
    .setExpirationTime(Math.floor(d.clock.now().getTime() / 1000) + ACCESS_TTL_S)
    .sign(new TextEncoder().encode(d.config.jwtSecret));
}

export async function issueRefreshToken(d: AuthDeps, userId: string, deviceId: string | null, familyId: string | null, ip?: string | null) {
  const token = randomToken();
  const now = d.clock.now();
  const row = await d.db.refreshToken.create({
    data: {
      userId, deviceId, tokenHash: sha256(token), ip: ip ?? null,
      familyId: familyId ?? crypto.randomUUID(), expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
    },
  });
  return { token, familyId: row.familyId };
}

export async function issueTokenPair(d: AuthDeps, user: Pick<User, "id" | "role">, deviceId: string | null, ip?: string | null) {
  const [accessToken, refresh] = await Promise.all([
    signAccessToken(d, user),
    issueRefreshToken(d, user.id, deviceId, null, ip),
  ]);
  return { accessToken, refreshToken: refresh.token, expiresIn: ACCESS_TTL_S };
}

// Rotating refresh with reuse detection: replaying a used token revokes the whole family.
export async function refreshTokens(d: AuthDeps, token: string, meta: Meta) {
  const row = await d.db.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  const now = d.clock.now();
  if (!row) throw new AppError(401, "TOKEN_INVALID", "Invalid token");
  if (row.usedAt) {
    await d.db.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: now } });
    throw new AppError(401, "TOKEN_REUSED", "Invalid token");
  }
  if (row.revokedAt || row.expiresAt <= now || row.user.status !== "ACTIVE") throw new AppError(401, "TOKEN_INVALID", "Invalid token");
  if (row.deviceId) {
    const dev = await d.db.device.findUnique({ where: { id: row.deviceId } });
    if (!dev || dev.revokedAt) throw new AppError(401, "TOKEN_INVALID", "Invalid token");
  }
  // Atomic "mark used": only one concurrent caller wins.
  const won = await d.db.refreshToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (won.count !== 1) {
    await d.db.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: now } });
    throw new AppError(401, "TOKEN_REUSED", "Invalid token");
  }
  const next = await issueRefreshToken(d, row.userId, row.deviceId, row.familyId, meta.ip);
  return { accessToken: await signAccessToken(d, row.user), refreshToken: next.token, expiresIn: ACCESS_TTL_S };
}

// ---- Resolving the caller ----
export interface AuthContext {
  user: User;
  via: "cookie" | "bearer";
  session?: Session;
  /** Admin who has not completed 2FA yet: only MFA setup/verify is allowed. */
  mfaPending: boolean;
}

export interface Credentials {
  cookieToken?: string | null;
  bearer?: string | null;
  csrfHeader?: string | null;
  method: string;
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export async function authenticate(d: AuthDeps, c: Credentials): Promise<AuthContext> {
  const now = d.clock.now();
  if (c.bearer) {
    try {
      const { payload } = await jwtVerify(c.bearer, new TextEncoder().encode(d.config.jwtSecret), {
        issuer: "moz-discounts", algorithms: ["HS256"], currentDate: now,
      });
      const user = payload.sub ? await d.db.user.findUnique({ where: { id: payload.sub } }) : null;
      if (!user || user.status !== "ACTIVE") throw new Error("inactive");
      return { user, via: "bearer", mfaPending: false };
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    }
  }
  if (c.cookieToken) {
    const s = await d.db.session.findUnique({ where: { tokenHash: sha256(c.cookieToken) }, include: { user: true } });
    const idleOk = s && s.lastSeenAt.getTime() + WEB_IDLE_MS > now.getTime();
    if (!s || s.revokedAt || s.expiresAt <= now || !idleOk || s.user?.status !== "ACTIVE") {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    }
    // CSRF: state-changing cookie requests must echo the session's token.
    if (!SAFE.has(c.method.toUpperCase()) && !(c.csrfHeader && safeEqual(c.csrfHeader, s.csrfToken))) {
      throw new AppError(403, "CSRF_INVALID", "Invalid CSRF token");
    }
    // The session or user can vanish between the read and this write (account deleted, logged out elsewhere): that is a 401, not a 500.
    await d.db.session.update({ where: { id: s.id }, data: { lastSeenAt: now } }).catch(() => { throw new AppError(401, "UNAUTHENTICATED", "Authentication required"); });
    const { user, ...session } = s;
    return { user, via: "cookie", session, mfaPending: user.role === "ADMIN" && !s.mfaPassed };
  }
  throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
}

export function requireFullAuth(ctx: AuthContext): AuthContext {
  if (ctx.mfaPending) throw new AppError(403, "MFA_REQUIRED", "Two-factor authentication required");
  return ctx;
}
