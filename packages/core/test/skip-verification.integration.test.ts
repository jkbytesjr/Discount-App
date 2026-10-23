import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, register } from "../src";
import { IP, STRONG, cleanup, db, makeDeps, uniqueEmail } from "./helpers";

beforeAll(cleanup);
afterAll(async () => { await cleanup(); await db.$disconnect(); });

const body = (email: string) => ({ accountType: "user", firstName: "T", lastName: "S", email, password: STRONG, confirmPassword: STRONG, acceptTerms: true, locale: "en" });

describe("SKIP_EMAIL_VERIFICATION (POC convenience)", () => {
  it("auto-verifies and sends no email when on in local/test; off by default", async () => {
    const on = makeDeps(); on.deps.config.skipEmailVerification = true;
    const email = uniqueEmail();
    expect(await register(on.deps, body(email), { ip: IP() })).toEqual({ ok: true, autoVerified: true });
    expect(on.mailer.sent).toHaveLength(0);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).status).toBe("ACTIVE");
    expect(await login(on.deps, { email, password: STRONG }, { ip: IP() })).toHaveProperty("sessionToken");

    const off = makeDeps(); const other = uniqueEmail();
    expect(await register(off.deps, body(other), { ip: IP() })).toEqual({ ok: true });
    expect(off.mailer.sent).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { email: other } })).status).toBe("PENDING_VERIFICATION");
  });
  it("is ignored outside local/test, even if configured", async () => {
    const poc = makeDeps(); poc.deps.config.appEnv = "poc"; poc.deps.config.skipEmailVerification = true;
    const email = uniqueEmail();
    expect(await register(poc.deps, body(email), { ip: IP() })).toEqual({ ok: true });
    expect(poc.mailer.sent).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).status).toBe("PENDING_VERIFICATION");
  });
});
