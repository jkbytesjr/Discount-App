// Offer rules shared by the API and (as test vectors) by iOS: BR-R1 matching, BR-R2 active, BR-R3 ranking.
// Time is always passed in (Clock); Maputo is UTC+2 all year (no DST), so no tz database is needed.

export type EligibilityScope = "CARD_PRODUCT" | "ISSUER_ANY" | "ANY_BANK_CARD" | "WALLET" | "ANY_WALLET" | "GENERAL";
export type BenefitType = "PERCENT" | "FIXED" | "CASHBACK" | "BOGO" | "FREE_ITEM" | "POINTS";
export type CardTypeName = "DEBIT" | "CREDIT" | "PREPAID";
export type AlertMode = "PERSONALISED" | "PERSONALISED_PLUS_GENERAL" | "ALL";

export interface EligibilityRowLike {
  scope: EligibilityScope;
  cardProductId?: string | null;
  issuerId?: string | null;
  walletId?: string | null;
  cardType?: CardTypeName | null;
  networkId?: string | null;
  benefit: BenefitType;
  value?: number | null;
  valueMzn?: number | null;
}

export interface HeldCard { productId: string; issuerId: string; cardType: CardTypeName; networkId: string }
export interface Holdings { cards: HeldCard[]; wallets: string[] }

const passesFilters = (c: HeldCard, r: EligibilityRowLike) =>
  (!r.cardType || c.cardType === r.cardType) && (!r.networkId || c.networkId === r.networkId);

/** BR-R1: does this eligibility row match what the user holds? */
export function rowMatches(r: EligibilityRowLike, h: Holdings): boolean {
  switch (r.scope) {
    case "GENERAL": return true;
    case "CARD_PRODUCT": return h.cards.some((c) => c.productId === r.cardProductId);
    case "ISSUER_ANY": return h.cards.some((c) => c.issuerId === r.issuerId && passesFilters(c, r));
    case "ANY_BANK_CARD": return h.cards.some((c) => passesFilters(c, r));
    case "WALLET": return h.wallets.includes(r.walletId ?? "");
    case "ANY_WALLET": return h.wallets.length > 0;
  }
}

// ---------- Time in Africa/Maputo (UTC+2) ----------
const MAPUTO_OFFSET_MS = 2 * 3_600_000;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export const WEEKDAYS: readonly Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function maputoParts(t: Date): { day: Weekday; minutes: number; date: string } {
  const l = new Date(t.getTime() + MAPUTO_OFFSET_MS);
  return { day: DAYS[l.getUTCDay()] as Weekday, minutes: l.getUTCHours() * 60 + l.getUTCMinutes(), date: l.toISOString().slice(0, 10) };
}

/** Today's calendar date in Maputo as YYYY-MM-DD. */
export const maputoDate = (t: Date) => maputoParts(t).date;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Stored valid_from/valid_to are calendar dates (UTC midnight Date) read as Maputo dates. */
export const dateKey = (d: Date | string | null | undefined) => (d == null ? null : (typeof d === "string" ? d : d.toISOString()).slice(0, 10));

export interface DiscountLike {
  status: string;
  validFrom?: Date | string | null;
  validTo?: Date | string | null; // inclusive: valid through 23:59:59 Maputo
  scheduleDays?: string[];
  scheduleFrom?: string | null;
  scheduleTo?: string | null;
}

/** Has the validity window ended? (valid_to inclusive, BR-R2). Used for computed EXPIRED. */
export const isPastValidity = (d: Pick<DiscountLike, "validTo">, now: Date) => {
  const to = dateKey(d.validTo);
  return to !== null && maputoDate(now) > to;
};

/** BR-R2 (without the premise): published, business approved, inside validity and schedule. */
export function isActiveAt(d: DiscountLike, businessApproved: boolean, t: Date): boolean {
  if (d.status !== "PUBLISHED" || !businessApproved) return false;
  const p = maputoParts(t);
  const from = dateKey(d.validFrom);
  if (from !== null && p.date < from) return false;
  if (isPastValidity(d, t)) return false;
  const days = d.scheduleDays ?? [];
  if (days.length && !days.includes(p.day)) return false;
  if (d.scheduleFrom && d.scheduleTo) {
    if (p.minutes < toMinutes(d.scheduleFrom) || p.minutes >= toMinutes(d.scheduleTo)) return false;
  }
  return true;
}

// ---------- Ranking (BR-R3) ----------
export interface OfferCandidate {
  discountId: string;
  rowIndex: number;
  row: EligibilityRowLike;
  publishedAt?: Date | string | null;
  isFavourite?: boolean;
}
export interface RankInput {
  holdings: Holdings;
  mode?: AlertMode;
  /** Issuers/wallets ticked for general alerts (PERSONALISED_PLUS_GENERAL). */
  generalIssuers?: string[];
  generalWallets?: string[];
}

const benefitTier = (b: BenefitType) => (b === "PERCENT" || b === "CASHBACK" ? 0 : b === "FIXED" ? 1 : 2);
const benefitValue = (r: EligibilityRowLike) => (benefitTier(r.benefit) === 0 ? (r.value ?? 0) : benefitTier(r.benefit) === 1 ? (r.valueMzn ?? 0) : 0);
const ts = (v: Date | string | null | undefined) => (v ? new Date(v).getTime() : 0);

/** BR-R1 mode filter + BR-R3 order. Favourites are always kept and first. */
export function rankOffers(cands: OfferCandidate[], input: RankInput): OfferCandidate[] {
  const { holdings } = input;
  const empty = holdings.cards.length === 0 && holdings.wallets.length === 0;
  const mode: AlertMode = empty ? "ALL" : (input.mode ?? "PERSONALISED");
  const groupOf = (c: OfferCandidate) => (c.isFavourite ? 0 : c.row.scope !== "GENERAL" && rowMatches(c.row, holdings) ? 1 : 2);
  const keep = (c: OfferCandidate) => {
    if (c.isFavourite || mode === "ALL" || c.row.scope === "GENERAL") return true;
    if (rowMatches(c.row, holdings)) return true;
    if (mode === "PERSONALISED_PLUS_GENERAL") {
      return (!!c.row.issuerId && !!input.generalIssuers?.includes(c.row.issuerId)) || (!!c.row.walletId && !!input.generalWallets?.includes(c.row.walletId));
    }
    return false;
  };
  return cands
    .filter(keep)
    .sort((a, b) =>
      groupOf(a) - groupOf(b) ||
      benefitTier(a.row.benefit) - benefitTier(b.row.benefit) ||
      benefitValue(b.row) - benefitValue(a.row) ||
      ts(b.publishedAt) - ts(a.publishedAt) ||
      a.discountId.localeCompare(b.discountId) || a.rowIndex - b.rowIndex);
}
