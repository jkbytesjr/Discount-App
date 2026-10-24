import Foundation

// DTOs for /api/v1 (see apps/web/app/api/v1 and packages/core/src/discovery.ts).

public struct SessionUser: Codable, Sendable, Equatable {
    public var id: String, email: String, role: String, firstName: String, lastName: String, locale: String
    public var phone: String?
    public init(id: String, email: String, role: String, firstName: String, lastName: String, locale: String, phone: String? = nil) { self.id = id; self.email = email; self.role = role; self.firstName = firstName; self.lastName = lastName; self.locale = locale; self.phone = phone }
}
public struct LoginResponse: Codable, Sendable {
    public var user: SessionUser
    public var accessToken: String?
    public var refreshToken: String?
    public var expiresIn: Int?
    public var mfaRequired: Bool?
}
public struct Tokens: Codable, Sendable, Equatable {
    public var accessToken: String, refreshToken: String
    public init(accessToken: String, refreshToken: String) { self.accessToken = accessToken; self.refreshToken = refreshToken }
}

public struct Row: Codable, Sendable, Equatable, Identifiable {
    public var scope: Scope
    public var benefit: Benefit
    public var label: String
    public var value: Double?
    public var valueMzn: Int?
    public var cardProductId: String?
    public var cardProductName: String?
    public var issuerId: String?
    public var issuerName: String?
    public var walletId: String?
    public var walletName: String?
    public var cardType: String?
    public var segment: String?
    public var minSpendMzn: Int?
    public var maxDiscountMzn: Int?
    public var comment: String?
    public var matched: Bool
    public var id: String { "\(scope.rawValue)-\(cardProductId ?? issuerId ?? walletId ?? "x")-\(label)" }
}
public struct Offer: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var title: String
    public var businessId: String
    public var businessName: String
    public var description: String?
    public var terms: String?
    public var redemption: String?
    public var promoCode: String?
    public var validFrom: String?
    public var validTo: String?
    public var days: [String]
    public var from: String?
    public var to: String?
    public var isOnline: Bool
    public var publishedAt: String?
    public var activeNow: Bool
    public var rows: [Row]
    public var premises: [PremiseRef]?
}
public struct PremiseRef: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String; public var lat: Double?, lng: Double? }

public struct PremiseSummary: Codable, Sendable, Equatable, Identifiable {
    public var id: String, name: String, categoryId: String
    public var lat: Double?, lng: Double?
    public var address: String?, city: String?, province: String?
    public var alertRadiusM: Int?
    public var openingHours: String?, phone: String?
    public var offerCount: Int?
    public var best: BestOffer?
    public var issuerIds: [String]?, walletIds: [String]?, cardTypes: [String]?
    public var general: Bool?, anyCard: Bool?, anyWallet: Bool?
    public var distanceM: Int?
    public struct BestOffer: Codable, Sendable, Equatable { public var label: String, benefit: String }
    public var coordinate: Coordinate? { lat != nil && lng != nil ? Coordinate(lat: lat!, lng: lng!) : nil }
}
public struct PremiseDetail: Codable, Sendable, Equatable, Identifiable {
    public var id: String, name: String, categoryId: String
    public var lat: Double?, lng: Double?
    public var address: String?, city: String?, province: String?, openingHours: String?, phone: String?
    public var offers: [Offer]
}
public struct MapPage: Codable, Sendable { public var items: [PremiseSummary]; public var total: Int; public var nextCursor: String? }
public struct NearbyItem: Codable, Sendable, Identifiable {
    public var distanceM: Int
    public var premise: PremiseSummary
    public var discount: Offer
    public var id: String { premise.id + discount.id }
}
public struct NearbyResponse: Codable, Sendable { public var items: [NearbyItem]; public var total: Int; public var radius: Int }
public struct RecentResponse: Codable, Sendable { public var items: [Offer]; public var kind: String }

public struct NamedItem: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String; public var icon: String? }
public struct FilterChips: Codable, Sendable {
    public var issuers: [NamedItem], wallets: [NamedItem], cardTypes: [String], segments: [String], categories: [NamedItem], general: Bool
}

// Catalogue
public struct Issuer: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String, shortName: String }
public struct WalletProvider: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String, operator_: String?
    enum CodingKeys: String, CodingKey { case id, name, operator_ = "operator" } }
public struct CardProduct: Codable, Sendable, Equatable, Identifiable { public var id: String, issuerId: String, networkId: String, cardType: String, segment: String, name: String }
public struct CardNetwork: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String }
public struct Catalogue: Sendable {
    public var issuers: [Issuer] = [], wallets: [WalletProvider] = [], products: [CardProduct] = []
    public init(issuers: [Issuer] = [], wallets: [WalletProvider] = [], products: [CardProduct] = []) { self.issuers = issuers; self.wallets = wallets; self.products = products }
    public func issuerName(_ id: String) -> String { issuers.first { $0.id == id }?.shortName ?? id }
    public func walletName(_ id: String) -> String { wallets.first { $0.id == id }?.name ?? id }
    /// "Absa Wealth": short issuer name plus segment, as in the BR-R8 examples.
    public func productName(_ id: String) -> String {
        guard let p = products.first(where: { $0.id == id }) else { return id }
        return "\(issuerName(p.issuerId)) \(p.segment)"
    }
}

// User data
public struct MyCard: Codable, Sendable, Equatable, Identifiable { public var id: String, cardProductId: String, name: String, issuerId: String, issuerName: String, networkId: String, cardType: String, segment: String; public var nickname: String? }
public struct MyWallet: Codable, Sendable, Equatable, Identifiable { public var walletProviderId: String, name: String; public var id: String { walletProviderId } }
public struct Prefs: Codable, Sendable, Equatable {
    public var alertsEnabled: Bool
    public var mode: AlertMode
    public var quietFrom: String?
    public var quietTo: String?
    public var generalIssuers: [String]
    public var generalWallets: [String]
    public init(alertsEnabled: Bool = true, mode: AlertMode = .PERSONALISED, quietFrom: String? = nil, quietTo: String? = nil, generalIssuers: [String] = [], generalWallets: [String] = []) {
        self.alertsEnabled = alertsEnabled; self.mode = mode; self.quietFrom = quietFrom; self.quietTo = quietTo; self.generalIssuers = generalIssuers; self.generalWallets = generalWallets
    }
}
public struct Bundle_: Codable, Sendable { public var cards: [MyCard], wallets: [MyWallet]; public var prefs: Prefs; public var favouriteIds: [String] }
public struct FavouriteItem: Codable, Sendable, Identifiable { public var id: String, titlePt: String, titleEn: String, businessName: String, status: String; public var validTo: String? }
public struct FavouritesPage: Codable, Sendable { public var items: [FavouriteItem]; public var nextCursor: String? }

// Geofence sync (IOS-8)
public struct SyncPremise: Codable, Sendable, Equatable, Identifiable { public var id: String, name: String, lat: Double, lng: Double, radiusM: Int, discountIds: [String] }
public struct SyncOffer: Codable, Sendable, Equatable, Identifiable {
    public var id: String, titlePt: String, titleEn: String, businessName: String
    public var publishedAt: String?
    public var validFrom: String?, validTo: String?
    public var days: [String]
    public var from: String?, to: String?
    public var rows: [EligibilityRow]
    public var window: DiscountWindow { DiscountWindow(status: "PUBLISHED", validFrom: validFrom, validTo: validTo, days: days, from: from, to: to) }
}
public struct SyncSettings: Codable, Sendable, Equatable {
    public var defaultRadiusM: Int, cooldownSeconds: Int, dailyCap: Int, nearbyRadiusM: Int, recentDays: Int, demoMode: Bool
    public static let `default` = SyncSettings(defaultRadiusM: 150, cooldownSeconds: 43_200, dailyCap: 5, nearbyRadiusM: 2000, recentDays: 30, demoMode: false)
}
public struct SyncPayload: Codable, Sendable { public var premises: [SyncPremise]; public var offers: [SyncOffer]; public var limit: Int; public var settings: SyncSettings }

// Alert events (BR-10)
public enum EventType: String, Codable, Sendable { case TRIGGERED, DELIVERED, OPENED, DISMISSED, DETAIL_VIEWED, SUPPRESSED }
public enum SuppressReason: String, Codable, Sendable { case ALERTS_DISABLED, NO_MATCH, NOT_ACTIVE, QUIET_HOURS, COOLDOWN, DAILY_CAP }
public struct AlertEvent: Codable, Sendable, Equatable {
    public var clientEventId: String
    public var type: EventType
    public var reason: SuppressReason?
    public var premiseId: String
    public var discountIds: [String]
    public var occurredAt: String
    public var distanceM: Int?
    public var lat: Double?, lng: Double?
    public var appVersion: String?, osVersion: String?
    public init(type: EventType, reason: SuppressReason? = nil, premiseId: String, discountIds: [String], occurredAt: Date, distanceM: Int? = nil, location: Coordinate? = nil, appVersion: String? = nil, osVersion: String? = nil, clientEventId: String = UUID().uuidString.lowercased()) {
        self.clientEventId = clientEventId; self.type = type; self.reason = reason; self.premiseId = premiseId; self.discountIds = discountIds
        self.occurredAt = isoParserPlain.string(from: occurredAt); self.distanceM = distanceM
        self.lat = location.map { coarse($0.lat) }; self.lng = location.map { coarse($0.lng) }; self.appVersion = appVersion; self.osVersion = osVersion
    }
}
