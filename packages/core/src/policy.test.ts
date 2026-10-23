import { describe, expect, it } from "vitest";
import { ACTIONS, can, grantFor, type Action, type Grant, type PolicyRole } from "./policy";

// Independent copy of the spec table (one row per action). A change to the matrix must change this too.
const SPEC: Record<Action, Record<PolicyRole, Grant>> = {
  "map.view":          { ADMIN: "allow", BUSINESS_OWNER: "allow", USER: "allow", ANONYMOUS: "allow" },
  "self.manage":       { ADMIN: "allow", BUSINESS_OWNER: "allow", USER: "allow", ANONYMOUS: "deny" },
  "self.cards":        { ADMIN: "deny", BUSINESS_OWNER: "deny", USER: "allow", ANONYMOUS: "deny" },
  "business.create":   { ADMIN: "allow", BUSINESS_OWNER: "allow", USER: "deny", ANONYMOUS: "deny" },
  "business.edit":     { ADMIN: "allow", BUSINESS_OWNER: "own", USER: "deny", ANONYMOUS: "deny" },
  "team.manage":       { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "premise.write":     { ADMIN: "allow", BUSINESS_OWNER: "own", USER: "deny", ANONYMOUS: "deny" },
  "discount.draft":    { ADMIN: "allow", BUSINESS_OWNER: "own", USER: "deny", ANONYMOUS: "deny" },
  "discount.publish":  { ADMIN: "allow", BUSINESS_OWNER: "own_if_approved", USER: "deny", ANONYMOUS: "deny" },
  "record.hard_delete": { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "business.approve":  { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "catalogue.manage":  { ADMIN: "allow", BUSINESS_OWNER: "request", USER: "deny", ANONYMOUS: "deny" },
  "stats.view":        { ADMIN: "allow", BUSINESS_OWNER: "own", USER: "deny", ANONYMOUS: "deny" },
  "alerts.view":       { ADMIN: "allow", BUSINESS_OWNER: "own", USER: "own", ANONYMOUS: "deny" },
  "audit.view":        { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "push.broadcast":    { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "settings.change":   { ADMIN: "allow", BUSINESS_OWNER: "deny", USER: "deny", ANONYMOUS: "deny" },
  "offer.report":      { ADMIN: "deny", BUSINESS_OWNER: "deny", USER: "allow", ANONYMOUS: "deny" },
};

const ROLES: PolicyRole[] = ["ADMIN", "BUSINESS_OWNER", "USER", "ANONYMOUS"];
const cells = ACTIONS.flatMap((a) => ROLES.map((r) => [a, r] as const));

describe("permissions matrix: one test per cell", () => {
  it.each(cells)("%s / %s", (action, role) => {
    const want = SPEC[action][role];
    expect(grantFor(role, action)).toBe(want);
    // behaviour: what can() does for own / foreign / unapproved records
    expect(can(role, action, { isOwn: true, businessApproved: true })).toBe(want === "allow" || want === "own" || want === "own_if_approved");
    expect(can(role, action, { isOwn: false, businessApproved: true })).toBe(want === "allow");
    expect(can(role, action, { isOwn: true, businessApproved: false })).toBe(want === "allow" || want === "own");
  });

  it("covers every action in the spec table", () => expect(Object.keys(SPEC).sort()).toEqual([...ACTIONS].sort()));
});
