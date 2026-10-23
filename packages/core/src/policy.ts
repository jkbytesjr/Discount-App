// Permissions matrix (spec <Permissions-Matrix>) as one module. POC overrides are marked "POC".
// BUSINESS_STAFF does not exist in the POC (assumption 5), so it has no column here.
export type PolicyRole = "ADMIN" | "BUSINESS_OWNER" | "USER" | "ANONYMOUS";

export type Grant = "allow" | "own" | "own_if_approved" | "request" | "deny";

export const ACTIONS = [
  "map.view", "self.manage", "self.cards", "business.create", "business.edit", "team.manage",
  "premise.write", "discount.draft", "discount.publish", "record.hard_delete", "business.approve",
  "catalogue.manage", "stats.view", "alerts.view", "audit.view", "push.broadcast", "settings.change", "offer.report",
] as const;
export type Action = (typeof ACTIONS)[number];

// Columns: ADMIN, BUSINESS_OWNER, USER, ANONYMOUS
export const MATRIX: Record<Action, [Grant, Grant, Grant, Grant]> = {
  "map.view":          ["allow", "allow", "allow", "allow"],
  "self.manage":       ["allow", "allow", "allow", "deny"],
  "self.cards":        ["deny", "deny", "allow", "deny"],
  "business.create":   ["allow", "allow", "deny", "deny"],
  "business.edit":     ["allow", "own", "deny", "deny"],
  "team.manage":       ["allow", "deny", "deny", "deny"], // POC: no staff/invites, owners cannot manage a team
  "premise.write":     ["allow", "own", "deny", "deny"],
  "discount.draft":    ["allow", "own", "deny", "deny"],
  "discount.publish":  ["allow", "own_if_approved", "deny", "deny"],
  "record.hard_delete": ["allow", "deny", "deny", "deny"],
  "business.approve":  ["allow", "deny", "deny", "deny"],
  "catalogue.manage":  ["allow", "request", "deny", "deny"],
  "stats.view":        ["allow", "own", "deny", "deny"],
  "alerts.view":       ["allow", "own", "own", "deny"], // owner: aggregated + pseudonymised; user: own history
  "audit.view":        ["allow", "deny", "deny", "deny"], // POC: audit trail is admin-only
  "push.broadcast":    ["allow", "deny", "deny", "deny"],
  "settings.change":   ["allow", "deny", "deny", "deny"],
  "offer.report":      ["deny", "deny", "allow", "deny"],
};

const COL: Record<PolicyRole, number> = { ADMIN: 0, BUSINESS_OWNER: 1, USER: 2, ANONYMOUS: 3 };

export const grantFor = (role: PolicyRole, action: Action): Grant => MATRIX[action][COL[role]] as Grant;

export interface Scope {
  /** The record belongs to the caller's own business/account. */
  isOwn?: boolean;
  businessApproved?: boolean;
}

/** True when the role may perform the action on a record with the given scope. */
export function can(role: PolicyRole, action: Action, scope: Scope = {}): boolean {
  switch (grantFor(role, action)) {
    case "allow": return true;
    case "own": return scope.isOwn === true;
    case "own_if_approved": return scope.isOwn === true && scope.businessApproved === true;
    default: return false; // "request" means "may ask an admin", not "may do it"
  }
}
