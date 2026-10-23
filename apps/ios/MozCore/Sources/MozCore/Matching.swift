import Foundation

// Port of packages/core/src/offers.ts: BR-R1 matching, BR-R2 active offer, BR-R3 ranking. Time is always passed in.

public enum Scope: String, Codable, Sendable { case CARD_PRODUCT, ISSUER_ANY, ANY_BANK_CARD, WALLET, ANY_WALLET, GENERAL }
public enum Benefit: String, Codable, Sendable { case PERCENT, FIXED, CASHBACK, BOGO, FREE_ITEM, POINTS }
public enum AlertMode: String, Codable, Sendable, CaseIterable { case PERSONALISED, PERSONALISED_PLUS_GENERAL, ALL }
public enum Lang: String, Sendable { case pt, en }

public struct EligibilityRow: Codable, Sendable, Equatable {
    public var scope: Scope
    public var cardProductId: String?
    public var issuerId: String?
    public var walletId: String?
    public var cardType: String?
    public var networkId: String?
    public var benefit: Benefit
    public var value: Double?
    public var valueMzn: Int?
    public var valueTextPt: String?
    public var valueTextEn: String?
    public var minSpendMzn: Int?
    public var maxDiscountMzn: Int?
    public var commentPt: String?
    public var commentEn: String?
    public init(scope: Scope, cardProductId: String? = nil, issuerId: String? = nil, walletId: String? = nil, cardType: String? = nil, networkId: String? = nil,
                benefit: Benefit, value: Double? = nil, valueMzn: Int? = nil, valueTextPt: String? = nil, valueTextEn: String? = nil,
                minSpendMzn: Int? = nil, maxDiscountMzn: Int? = nil, commentPt: String? = nil, commentEn: String? = nil) {
        self.scope = scope; self.cardProductId = cardProductId; self.issuerId = issuerId; self.walletId = walletId; self.cardType = cardType; self.networkId = networkId
        self.benefit = benefit; self.value = value; self.valueMzn = valueMzn; self.valueTextPt = valueTextPt; self.valueTextEn = valueTextEn
        self.minSpendMzn = minSpendMzn; self.maxDiscountMzn = maxDiscountMzn; self.commentPt = commentPt; self.commentEn = commentEn
    }
}

public struct HeldCard: Codable, Sendable, Equatable {
    public var productId: String, issuerId: String, cardType: String, networkId: String
    public init(productId: String, issuerId: String, cardType: String, networkId: String) { self.productId = productId; self.issuerId = issuerId; self.cardType = cardType; self.networkId = networkId }
}
public struct Holdings: Codable, Sendable, Equatable {
    public var cards: [HeldCard]
    public var wallets: [String]
    public init(cards: [HeldCard] = [], wallets: [String] = []) { self.cards = cards; self.wallets = wallets }
    public var isEmpty: Bool { cards.isEmpty && wallets.isEmpty }
}

private func passesFilters(_ c: HeldCard, _ r: EligibilityRow) -> Bool {
    (r.cardType == nil || c.cardType == r.cardType) && (r.networkId == nil || c.networkId == r.networkId)
}

/// BR-R1: does this eligibility row match what the user holds?
public func rowMatches(_ r: EligibilityRow, _ h: Holdings) -> Bool {
    switch r.scope {
    case .GENERAL: return true
    case .CARD_PRODUCT: return h.cards.contains { $0.productId == r.cardProductId }
    case .ISSUER_ANY: return h.cards.contains { $0.issuerId == r.issuerId && passesFilters($0, r) }
    case .ANY_BANK_CARD: return h.cards.contains { passesFilters($0, r) }
    case .WALLET: return h.wallets.contains(r.walletId ?? "")
    case .ANY_WALLET: return !h.wallets.isEmpty
    }
}

// MARK: Time in Africa/Maputo (UTC+2, no DST)

public let weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
private let dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
private let maputoOffset: TimeInterval = 2 * 3600

private let utc: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()

public struct MaputoParts: Equatable, Sendable { public var day: String; public var minutes: Int; public var date: String }
public func maputoParts(_ t: Date) -> MaputoParts {
    let l = t.addingTimeInterval(maputoOffset)
    let c = utc.dateComponents([.year, .month, .day, .hour, .minute, .weekday], from: l)
    let date = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    return MaputoParts(day: dayNames[(c.weekday! - 1) % 7], minutes: c.hour! * 60 + c.minute!, date: date)
}
public func toMinutes(_ hhmm: String) -> Int {
    let p = hhmm.split(separator: ":").compactMap { Int($0) }
    return (p.first ?? 0) * 60 + (p.count > 1 ? p[1] : 0)
}

public struct DiscountWindow: Sendable {
    public var status: String
    public var validFrom: String?   // YYYY-MM-DD (Maputo date)
    public var validTo: String?     // inclusive through 23:59 Maputo
    public var days: [String]
    public var from: String?
    public var to: String?
    public init(status: String = "PUBLISHED", validFrom: String? = nil, validTo: String? = nil, days: [String] = [], from: String? = nil, to: String? = nil) {
        self.status = status; self.validFrom = validFrom; self.validTo = validTo; self.days = days; self.from = from; self.to = to
    }
}

public func isPastValidity(_ validTo: String?, _ now: Date) -> Bool {
    guard let to = validTo else { return false }
    return maputoParts(now).date > to
}

/// BR-R2 (without the premise): published, business approved, inside validity and schedule.
public func isActiveAt(_ d: DiscountWindow, businessApproved: Bool = true, _ t: Date) -> Bool {
    if d.status != "PUBLISHED" || !businessApproved { return false }
    let p = maputoParts(t)
    if let from = d.validFrom, p.date < from { return false }
    if isPastValidity(d.validTo, t) { return false }
    if !d.days.isEmpty && !d.days.contains(p.day) { return false }
    if let f = d.from, let to = d.to, p.minutes < toMinutes(f) || p.minutes >= toMinutes(to) { return false }
    return true
}

// MARK: Ranking (BR-R3)

public struct OfferCandidate: Sendable {
    public var discountId: String
    public var rowIndex: Int
    public var row: EligibilityRow
    public var publishedAt: Date?
    public var isFavourite: Bool
    public init(discountId: String, rowIndex: Int, row: EligibilityRow, publishedAt: Date? = nil, isFavourite: Bool = false) {
        self.discountId = discountId; self.rowIndex = rowIndex; self.row = row; self.publishedAt = publishedAt; self.isFavourite = isFavourite
    }
}

public struct RankInput: Sendable {
    public var holdings: Holdings
    public var mode: AlertMode
    public var generalIssuers: [String]
    public var generalWallets: [String]
    public init(holdings: Holdings, mode: AlertMode = .PERSONALISED, generalIssuers: [String] = [], generalWallets: [String] = []) {
        self.holdings = holdings; self.mode = mode; self.generalIssuers = generalIssuers; self.generalWallets = generalWallets
    }
}

private func tier(_ b: Benefit) -> Int { b == .PERCENT || b == .CASHBACK ? 0 : b == .FIXED ? 1 : 2 }
private func benefitValue(_ r: EligibilityRow) -> Double { tier(r.benefit) == 0 ? (r.value ?? 0) : tier(r.benefit) == 1 ? Double(r.valueMzn ?? 0) : 0 }

/// Group of a kept candidate: 0 favourite, 1 personal match, 2 everything else.
public func groupOf(_ c: OfferCandidate, _ h: Holdings) -> Int { c.isFavourite ? 0 : (c.row.scope != .GENERAL && rowMatches(c.row, h) ? 1 : 2) }

/// BR-R1 mode filter + BR-R3 order. Favourites are always kept and first.
public func rankOffers(_ cands: [OfferCandidate], _ input: RankInput) -> [OfferCandidate] {
    let mode: AlertMode = input.holdings.isEmpty ? .ALL : input.mode
    func keep(_ c: OfferCandidate) -> Bool {
        if c.isFavourite || mode == .ALL || c.row.scope == .GENERAL { return true }
        if rowMatches(c.row, input.holdings) { return true }
        if mode == .PERSONALISED_PLUS_GENERAL {
            return (c.row.issuerId.map(input.generalIssuers.contains) ?? false) || (c.row.walletId.map(input.generalWallets.contains) ?? false)
        }
        return false
    }
    return cands.filter(keep).sorted { a, b in
        let ga = groupOf(a, input.holdings), gb = groupOf(b, input.holdings)
        if ga != gb { return ga < gb }
        if tier(a.row.benefit) != tier(b.row.benefit) { return tier(a.row.benefit) < tier(b.row.benefit) }
        if benefitValue(a.row) != benefitValue(b.row) { return benefitValue(a.row) > benefitValue(b.row) }
        let ta = a.publishedAt?.timeIntervalSince1970 ?? 0, tb = b.publishedAt?.timeIntervalSince1970 ?? 0
        if ta != tb { return ta > tb }
        if a.discountId != b.discountId { return a.discountId < b.discountId }
        return a.rowIndex < b.rowIndex
    }
}

public let isoParser: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
public let isoParserPlain: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f }()
public func parseISO(_ s: String?) -> Date? { guard let s else { return nil }; return isoParser.date(from: s) ?? isoParserPlain.date(from: s) }
