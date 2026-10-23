import Foundation

// IOS-8 / BR-R4, BR-R5, BR-R8: decide what happens when the person enters a premise region.

public struct UserContext: Sendable {
    public var holdings: Holdings
    public var mode: AlertMode
    public var generalIssuers: [String]
    public var generalWallets: [String]
    public var favourites: Set<String>
    public var alertsEnabled: Bool
    public var quietFrom: String?
    public var quietTo: String?
    public var lang: Lang
    public init(holdings: Holdings = Holdings(), mode: AlertMode = .PERSONALISED, generalIssuers: [String] = [], generalWallets: [String] = [], favourites: Set<String> = [], alertsEnabled: Bool = true, quietFrom: String? = nil, quietTo: String? = nil, lang: Lang = .pt) {
        self.holdings = holdings; self.mode = mode; self.generalIssuers = generalIssuers; self.generalWallets = generalWallets; self.favourites = favourites
        self.alertsEnabled = alertsEnabled; self.quietFrom = quietFrom; self.quietTo = quietTo; self.lang = lang
    }
}

/// What the device remembers between entries: last alert per premise and how many alerts today (Maputo day).
public struct AlertState: Codable, Sendable, Equatable {
    public var lastAlertAt: [String: Date] = [:]
    public var dayKey: String = ""
    public var countToday: Int = 0
    public init() {}
    public mutating func recordAlert(premiseId: String, at now: Date) {
        let key = maputoParts(now).date
        if key != dayKey { dayKey = key; countToday = 0 }
        countToday += 1
        lastAlertAt[premiseId] = now
    }
    public func alertsToday(_ now: Date) -> Int { maputoParts(now).date == dayKey ? countToday : 0 }
}

public struct AlertContent: Sendable, Equatable {
    public var title: String
    public var body: String
    public var premiseId: String
    public var discountIds: [String]
    public var bestDiscountId: String
    public var personal: Bool
}

public enum Decision: Sendable, Equatable {
    case suppressed(SuppressReason, discountIds: [String])
    case alert(AlertContent)
}

public enum AlertEngine {
    /// Quiet hours may cross midnight (22:00 to 07:00).
    public static func inQuietHours(_ from: String?, _ to: String?, _ now: Date) -> Bool {
        guard let from, let to else { return false }
        let m = maputoParts(now).minutes, a = toMinutes(from), b = toMinutes(to)
        if a == b { return false }
        return a < b ? (m >= a && m < b) : (m >= a || m < b)
    }

    public static func benefitLabel(_ r: EligibilityRow, _ lang: Lang) -> String {
        let pt = lang == .pt
        func n(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : String(format: "%.2f", v).replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression) }
        switch r.benefit {
        case .PERCENT: return pt ? "\(n(r.value ?? 0))% de desconto" : "\(n(r.value ?? 0))% off"
        case .FIXED: return pt ? "\(r.valueMzn ?? 0) MT de desconto" : "\(r.valueMzn ?? 0) MT off"
        case .CASHBACK: return "\(n(r.value ?? 0))% cashback"
        case .BOGO: return pt ? "2 por 1" : "2 for 1"
        case .POINTS: return pt ? "\(n(r.value ?? 0)) pontos" : "\(n(r.value ?? 0)) points"
        case .FREE_ITEM: return (pt ? r.valueTextPt : r.valueTextEn) ?? (pt ? "Oferta" : "Offer")
        }
    }

    public static func who(_ r: EligibilityRow, _ cat: Catalogue, _ lang: Lang) -> String {
        switch r.scope {
        case .CARD_PRODUCT: return cat.productName(r.cardProductId ?? "")
        case .ISSUER_ANY: return cat.issuerName(r.issuerId ?? "")
        case .WALLET: return cat.walletName(r.walletId ?? "")
        case .ANY_BANK_CARD: return lang == .pt ? "qualquer cartão" : "any card"
        case .ANY_WALLET: return lang == .pt ? "qualquer carteira" : "any wallet"
        case .GENERAL: return lang == .pt ? "todos" : "everyone"
        }
    }

    /// BR-R5 order: ALERTS_DISABLED, NO_MATCH, NOT_ACTIVE, QUIET_HOURS, COOLDOWN, DAILY_CAP.
    /// Favourites skip NO_MATCH and DAILY_CAP but not QUIET_HOURS or COOLDOWN.
    public static func decide(premise: SyncPremise, offers: [SyncOffer], user: UserContext, state: AlertState, settings: SyncSettings, catalogue: Catalogue, now: Date) -> Decision {
        let linked = offers.filter { premise.discountIds.contains($0.id) }
        let allIds = linked.map(\.id)
        if !user.alertsEnabled { return .suppressed(.ALERTS_DISABLED, discountIds: allIds) }

        func cands(_ list: [SyncOffer]) -> [OfferCandidate] {
            list.flatMap { o in o.rows.enumerated().map { OfferCandidate(discountId: o.id, rowIndex: $0.offset, row: $0.element, publishedAt: parseISO(o.publishedAt), isFavourite: user.favourites.contains(o.id)) } }
        }
        let input = RankInput(holdings: user.holdings, mode: user.mode, generalIssuers: user.generalIssuers, generalWallets: user.generalWallets)
        if rankOffers(cands(linked), input).isEmpty { return .suppressed(.NO_MATCH, discountIds: allIds) }
        let active = linked.filter { isActiveAt($0.window, now) }
        let ranked = rankOffers(cands(active), input)
        guard let best = ranked.first else { return .suppressed(.NOT_ACTIVE, discountIds: allIds) }
        let hasFavourite = ranked.contains { $0.isFavourite }

        if inQuietHours(user.quietFrom, user.quietTo, now) { return .suppressed(.QUIET_HOURS, discountIds: ranked.map(\.discountId)) }
        if let last = state.lastAlertAt[premise.id], now.timeIntervalSince(last) < TimeInterval(settings.cooldownSeconds) { return .suppressed(.COOLDOWN, discountIds: ranked.map(\.discountId)) }
        if !hasFavourite && state.alertsToday(now) >= settings.dailyCap { return .suppressed(.DAILY_CAP, discountIds: ranked.map(\.discountId)) }

        let offer = active.first { $0.id == best.discountId }!
        let personal = groupOf(best, user.holdings) < 2
        let benefit = benefitLabel(best.row, user.lang)
        let more = ranked.count - 1
        let pt = user.lang == .pt
        let suffix = more > 0 ? (pt ? " + \(more) outras ofertas" : " + \(more) more offers") : ""
        let until = offer.validTo.map { pt ? " Válido até \($0)." : " Valid until \($0)." } ?? ""
        let title: String, body: String
        if personal {
            title = pt ? "\(benefit) no \(premise.name)" : "\(benefit) at \(premise.name)"
            body = (pt ? "Com o seu \(who(best.row, catalogue, user.lang))." : "With your \(who(best.row, catalogue, user.lang)).") + until + suffix
        } else {
            title = pt ? "Oferta perto de si: \(benefit) no \(premise.name)" : "Offer near you: \(benefit) at \(premise.name)"
            body = ((pt ? best.row.commentPt : best.row.commentEn) ?? (pt ? offer.titlePt : offer.titleEn)) + suffix
        }
        return .alert(AlertContent(title: title, body: body, premiseId: premise.id, discountIds: ranked.map(\.discountId), bestDiscountId: best.discountId, personal: personal))
    }
}
