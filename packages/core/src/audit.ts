import type { PrismaClient } from "@moz/db";
import type { Clock } from "./clock";

export interface Actor {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
  businessId?: string | null;
}
export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
}
export interface AuditEntry {
  action: string; // e.g. "auth.login"
  summary: string;
  actor?: Actor;
  entityType?: string;
  entityId?: string;
  changes?: unknown;
  result?: "success" | "failure";
  meta?: RequestMeta;
}

const SECRET_KEYS = /password|token|secret|hash|code|otp/i;

// Removes secrets from any JSON diff before it is stored.
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v)]),
    );
  }
  return value;
}

export async function writeAudit(db: PrismaClient, clock: Clock, e: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      occurredAt: clock.now(),
      actorUserId: e.actor?.userId ?? null,
      actorEmail: e.actor?.email ?? null,
      actorRole: e.actor?.role ?? null,
      businessId: e.actor?.businessId ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      summary: e.summary,
      changes: e.changes === undefined ? undefined : (redact(e.changes) as object),
      ip: e.meta?.ip ?? null,
      userAgent: e.meta?.userAgent ?? null,
      deviceId: e.meta?.deviceId ?? null,
      requestId: e.meta?.requestId ?? null,
      result: e.result ?? "success",
    },
  });
}
