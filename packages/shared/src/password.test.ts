import { describe, expect, it } from "vitest";
import { checkPassword } from "./password";

describe("checkPassword (BR-5, POC rules)", () => {
  it("accepts a strong password", () => expect(checkPassword("Abcdefg1!")).toEqual([]));
  it("POC adds a number rule: Abcdefg! fails", () => expect(checkPassword("Abcdefg!")).toEqual(["NO_NUMBER"]));
  it("rejects lower-case only", () => expect(checkPassword("abcdefg!")).toContain("NO_UPPER"));
  it("rejects ABCDEFG1", () => {
    const i = checkPassword("ABCDEFG1");
    expect(i).toContain("NO_LOWER");
    expect(i).toContain("NO_SPECIAL");
  });
  it("rejects short", () => expect(checkPassword("Ab1!")).toContain("TOO_SHORT"));
  it("rejects over 128 chars", () => expect(checkPassword("Aa1!" + "x".repeat(130))).toContain("TOO_LONG"));
  it("rejects email local part", () => expect(checkPassword("Joaosilva1!", "joaosilva@x.test")).toContain("CONTAINS_EMAIL"));
  it("allows spaces and unicode", () => expect(checkPassword("Árvore forte 7#")).toEqual([]));
});
