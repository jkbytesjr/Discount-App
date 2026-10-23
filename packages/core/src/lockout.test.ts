import { describe, expect, it } from "vitest";
import { lockMinutes } from "./lockout";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto";
import { redact } from "./audit";
import { checkTotp } from "./auth/mfa";
import { generateSecret, generateSync } from "otplib";

describe("lockMinutes", () => {
  it("starts at 15 min, doubles, caps at 24 h", () => {
    expect([0, 1, 2, 3].map(lockMinutes)).toEqual([15, 30, 60, 120]);
    expect(lockMinutes(20)).toBe(1440);
  });
});

describe("crypto", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  it("round-trips AES-GCM and rejects tampering", () => {
    const c = encrypt("JBSWY3DPEHPK3PXP", key);
    expect(decrypt(c, key)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decrypt(c.slice(0, -2) + "AA", key)).toThrow();
  });
  it("tokens are >= 32 bytes and unique; hash is stable", () => {
    const a = randomToken();
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(randomToken());
    expect(sha256("x")).toBe(sha256("x"));
  });
});

describe("audit redaction", () => {
  it("hides secrets recursively", () => {
    expect(redact({ a: 1, password: "x", nested: { passwordHash: "y", tokenHash: "z", keep: 2 } })).toEqual({
      a: 1, password: "[redacted]", nested: { passwordHash: "[redacted]", tokenHash: "[redacted]", keep: 2 },
    });
  });
});

describe("TOTP", () => {
  it("accepts a current code and rejects a wrong one", () => {
    const secret = generateSecret();
    expect(checkTotp(secret, generateSync({ secret }))).toBe(true);
    expect(checkTotp(secret, "000000" === generateSync({ secret }) ? "111111" : "000000")).toBe(false);
  });
});
