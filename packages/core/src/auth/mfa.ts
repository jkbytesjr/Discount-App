import { generateSecret, generateURI, verifySync } from "otplib";
import { AppError } from "../errors";
import { decrypt, encrypt } from "../crypto";
import { writeAudit } from "../audit";
import type { AuthDeps, Meta } from "./deps";
import type { AuthContext } from "./sessions";

export function checkTotp(secret: string, code: string): boolean {
  try {
    return verifySync({ secret, token: code, epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}

export async function mfaSetup(d: AuthDeps, ctx: AuthContext) {
  if (ctx.user.mfaEnabled) throw new AppError(409, "MFA_ALREADY_ENABLED", "Two-factor already enabled");
  const secret = generateSecret();
  await d.db.user.update({ where: { id: ctx.user.id }, data: { mfaSecretEnc: encrypt(secret, d.config.mfaKey) } });
  return { secret, otpauthUrl: generateURI({ issuer: "Moz Discounts", label: ctx.user.email, secret }) };
}

export async function mfaVerify(d: AuthDeps, ctx: AuthContext, code: string, meta: Meta) {
  if (!ctx.user.mfaSecretEnc) throw new AppError(409, "MFA_NOT_SET_UP", "Start setup first");
  const secret = decrypt(ctx.user.mfaSecretEnc, d.config.mfaKey);
  if (!checkTotp(secret, code)) throw new AppError(401, "MFA_CODE_INVALID", "Invalid code");
  await d.db.user.update({ where: { id: ctx.user.id }, data: { mfaEnabled: true } });
  if (ctx.session) await d.db.session.update({ where: { id: ctx.session.id }, data: { mfaPassed: true } });
  await writeAudit(d.db, d.clock, {
    action: "auth.mfa.enable", summary: "Two-factor authentication enabled",
    actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, meta,
  });
  return { enabled: true };
}
