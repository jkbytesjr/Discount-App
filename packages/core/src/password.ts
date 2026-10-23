import argon2 from "argon2";

// OWASP: Argon2id, memory >= 19 MiB, iterations >= 2, parallelism 1.
const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => argon2.hash(pw, OPTS);

export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pw);
  } catch {
    return false;
  }
}

// Verified against when the account does not exist, so response time looks the same.
let dummy: Promise<string> | undefined;
export async function dummyVerify(pw: string): Promise<void> {
  dummy ??= hashPassword("not-a-real-password-Xx1!");
  await verifyPassword(await dummy, pw);
}
