import { AppError } from "./errors";
import { writeAudit } from "./audit";
import { can, type Action, type PolicyRole, type Scope } from "./policy";
import type { AuthContext } from "./auth/sessions";
import type { AuthDeps, Meta } from "./auth/deps";

export const roleOf = (ctx: AuthContext | null): PolicyRole => (ctx ? (ctx.user.role as PolicyRole) : "ANONYMOUS");

/** Role-level check. Denials are audited and answered with 403. */
export async function requireCan(d: AuthDeps, ctx: AuthContext, action: Action, meta: Meta, scope: Scope = {}) {
  if (can(roleOf(ctx), action, scope)) return;
  await writeAudit(d.db, d.clock, {
    action: "permission.denied", summary: `Denied: ${action}`, result: "failure",
    actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, meta, changes: { action },
  });
  throw new AppError(403, "FORBIDDEN", "You do not have access to this action");
}

/** Cross-tenant access: answer 404 (never 403) so existence is not leaked, but audit it. */
export async function notFoundDenied(d: AuthDeps, ctx: AuthContext, entityType: string, entityId: string, meta: Meta): Promise<never> {
  await writeAudit(d.db, d.clock, {
    action: "permission.denied", summary: `Denied access to ${entityType}`, result: "failure",
    actor: { userId: ctx.user.id, email: ctx.user.email, role: ctx.user.role }, entityType, entityId, meta,
  });
  throw new AppError(404, "NOT_FOUND", "Not found");
}
