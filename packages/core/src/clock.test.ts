import { describe, expect, it } from "vitest";
import { fixedClock, systemClock } from "./clock";

describe("Clock", () => {
  it("fixedClock returns the given instant", () => {
    expect(fixedClock("2026-11-04T11:00:00Z").now().toISOString()).toBe("2026-11-04T11:00:00.000Z");
  });
  it("fixedClock rejects bad input", () => {
    expect(() => fixedClock("nope")).toThrow();
  });
  it("systemClock returns a Date", () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});
