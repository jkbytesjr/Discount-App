// BR-5 password rules (POC: min 8, upper, lower, number, special; no breach check / history).
export type PasswordIssue =
  | "TOO_SHORT" | "TOO_LONG" | "NO_UPPER" | "NO_LOWER" | "NO_NUMBER" | "NO_SPECIAL" | "CONTAINS_EMAIL";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function checkPassword(password: string, email?: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if ([...password].length < PASSWORD_MIN) issues.push("TOO_SHORT");
  if ([...password].length > PASSWORD_MAX) issues.push("TOO_LONG");
  if (!/\p{Lu}/u.test(password)) issues.push("NO_UPPER");
  if (!/\p{Ll}/u.test(password)) issues.push("NO_LOWER");
  if (!/\d/.test(password)) issues.push("NO_NUMBER");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) issues.push("NO_SPECIAL");
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) issues.push("CONTAINS_EMAIL");
  return issues;
}
