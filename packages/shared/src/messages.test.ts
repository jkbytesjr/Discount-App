import { describe, expect, it } from "vitest";
import { MESSAGES, translate } from "./messages";

describe("messages", () => {
  it("PT and EN have exactly the same keys, none empty", () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES["pt-MZ"]).sort());
    for (const l of ["pt-MZ", "en"] as const) for (const [k, v] of Object.entries(MESSAGES[l])) expect(v.trim(), `${l}:${k}`).not.toBe("");
  });
  it("placeholders match between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) expect(ph(MESSAGES.en[k]), k).toBe(ph(MESSAGES["pt-MZ"][k]));
  });
  it("interpolates", () => expect(translate("en", "dash.welcome", { name: "Ana" })).toBe("Hello, Ana"));
});
