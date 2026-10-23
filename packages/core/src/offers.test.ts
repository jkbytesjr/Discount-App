import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isActiveAt, isPastValidity, maputoParts, rankOffers, rowMatches, type OfferCandidate } from "./offers";
import { distanceM, insideMozambique } from "./geo";

interface Vector {
  id: string; name: string; now: string; mode: "PERSONALISED" | "PERSONALISED_PLUS_GENERAL" | "ALL";
  holdings: { cards: any[]; wallets: string[] }; favourites: string[]; generalIssuers: string[]; generalWallets: string[];
  offers: any[]; expected: string[];
}
const vectors: Vector[] = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../shared/test-vectors/matching.json"), "utf8"));

// TD-6: the same vectors must pass in the Swift implementation.
describe("TD-6 matching vectors (BR-R1, BR-R2, BR-R3)", () => {
  for (const v of vectors) {
    it(`${v.id}: ${v.name}`, () => {
      const now = new Date(v.now);
      const cands: OfferCandidate[] = v.offers
        .filter((o) => isActiveAt(o, o.businessApproved, now))
        .flatMap((o) => o.rows.map((row: any, rowIndex: number) => ({ discountId: o.discountId, rowIndex, row, publishedAt: o.publishedAt, isFavourite: v.favourites.includes(o.discountId) })));
      const ranked = rankOffers(cands, { holdings: v.holdings, mode: v.mode, generalIssuers: v.generalIssuers, generalWallets: v.generalWallets });
      expect(ranked.map((c) => `${c.discountId}#${c.rowIndex}`)).toEqual(v.expected);
    });
  }
});

describe("BR-R1 row matching", () => {
  const h = { cards: [{ productId: "cp-1", issuerId: "iss-1", cardType: "DEBIT" as const, networkId: "net-visa" }], wallets: [] };
  it("each scope", () => {
    expect(rowMatches({ scope: "GENERAL", benefit: "BOGO" }, { cards: [], wallets: [] })).toBe(true);
    expect(rowMatches({ scope: "CARD_PRODUCT", cardProductId: "cp-1", benefit: "PERCENT" }, h)).toBe(true);
    expect(rowMatches({ scope: "CARD_PRODUCT", cardProductId: "cp-2", benefit: "PERCENT" }, h)).toBe(false);
    expect(rowMatches({ scope: "ISSUER_ANY", issuerId: "iss-1", networkId: "net-mc", benefit: "PERCENT" }, h)).toBe(false);
    expect(rowMatches({ scope: "ANY_BANK_CARD", cardType: "DEBIT", benefit: "PERCENT" }, h)).toBe(true);
    expect(rowMatches({ scope: "ANY_BANK_CARD", benefit: "PERCENT" }, { cards: [], wallets: ["wl-mpesa"] })).toBe(false);
    expect(rowMatches({ scope: "WALLET", walletId: "wl-mpesa", benefit: "PERCENT" }, { cards: [], wallets: ["wl-mpesa"] })).toBe(true);
    expect(rowMatches({ scope: "ANY_WALLET", benefit: "BOGO" }, h)).toBe(false);
  });
});

describe("BR-R2 time in Africa/Maputo", () => {
  it("converts UTC to Maputo weekday and minutes", () => {
    expect(maputoParts(new Date("2026-11-04T11:00:00Z"))).toEqual({ day: "WED", minutes: 13 * 60, date: "2026-11-04" });
    expect(maputoParts(new Date("2026-11-04T22:30:00Z")).day).toBe("THU"); // 00:30 next day in Maputo
  });
  it("past validity is inclusive of valid_to", () => {
    expect(isPastValidity({ validTo: "2026-09-30" }, new Date("2026-09-30T21:59:59Z"))).toBe(false);
    expect(isPastValidity({ validTo: "2026-09-30" }, new Date("2026-09-30T22:00:00Z"))).toBe(true);
    expect(isPastValidity({ validTo: null }, new Date("2099-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("BR-8 geography", () => {
  it("Mozambique bounding box", () => {
    expect(insideMozambique(-25.9707, 32.6031)).toBe(true);
    expect(insideMozambique(51.5, -0.12)).toBe(false);
  });
  it("haversine: Marisco to Cinema is about 300 m; same point is 0", () => {
    expect(distanceM(-25.948, 32.613, -25.948, 32.613)).toBe(0);
    const d = distanceM(-25.948, 32.613, -25.947, 32.615);
    expect(d).toBeGreaterThan(200); expect(d).toBeLessThan(300);
  });
});
