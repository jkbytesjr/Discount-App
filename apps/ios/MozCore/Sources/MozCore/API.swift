import Foundation

public enum APIError: Error, Equatable, Sendable {
    case network
    case problem(status: Int, code: String)
    case decoding
    public var code: String { if case .problem(_, let c) = self { return c }; return self == .network ? "NETWORK" : "DECODING" }
}

public protocol TokenStore: AnyObject, Sendable {
    func load() -> Tokens?
    func save(_ t: Tokens?)
}
public final class MemoryTokenStore: TokenStore, @unchecked Sendable {
    private var t: Tokens?
    public init(_ t: Tokens? = nil) { self.t = t }
    public func load() -> Tokens? { t }
    public func save(_ t: Tokens?) { self.t = t }
}

/// REST client for /api/v1 using bearer tokens (IOS-2). A 401 triggers one refresh; reuse of a refresh token ends the session.
public actor APIClient {
    public let baseURL: URL
    private let session: URLSession
    private let tokens: TokenStore
    private var refreshing: Task<Bool, Never>?
    public var onSessionExpired: (@Sendable () -> Void)?
    public var testNow: String?   // X-Test-Now: honoured by the server in local/test only

    public init(baseURL: URL, tokens: TokenStore, session: URLSession = .shared) { self.baseURL = baseURL; self.tokens = tokens; self.session = session }
    public func setOnSessionExpired(_ f: @escaping @Sendable () -> Void) { onSessionExpired = f }
    public func setTestNow(_ s: String?) { testNow = s }
    public var isSignedIn: Bool { tokens.load() != nil }

    // MARK: Transport
    private func request(_ method: String, _ path: String, query: [String: String] = [:], body: (any Encodable)? = nil, auth: Bool) throws -> URLRequest {
        var comps = URLComponents(url: baseURL.appendingPathComponent("api/v1" + path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var r = URLRequest(url: comps.url!)
        r.httpMethod = method; r.timeoutInterval = 20
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body { r.httpBody = try JSONEncoder().encode(AnyEncodable(body)); r.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if auth, let t = tokens.load() { r.setValue("Bearer \(t.accessToken)", forHTTPHeaderField: "Authorization") }
        if let testNow { r.setValue(testNow, forHTTPHeaderField: "X-Test-Now") }
        return r
    }

    private func send(_ r: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (d, resp) = try await session.data(for: r)
            return (d, resp as! HTTPURLResponse)
        } catch { throw APIError.network }
    }

    private func perform(_ method: String, _ path: String, query: [String: String] = [:], body: (any Encodable)? = nil, auth: Bool = true) async throws -> (Data, HTTPURLResponse) {
        var (data, resp) = try await send(try request(method, path, query: query, body: body, auth: auth))
        if resp.statusCode == 401, auth, tokens.load() != nil {
            if await refresh() { (data, resp) = try await send(try request(method, path, query: query, body: body, auth: auth)) }
            else { onSessionExpired?() }
        }
        if resp.statusCode >= 400 {
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["code"] as? String ?? "INTERNAL"
            throw APIError.problem(status: resp.statusCode, code: code)
        }
        return (data, resp)
    }

    private func decode<T: Decodable>(_ t: T.Type, _ data: Data) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) } catch { throw APIError.decoding }
    }
    public func get<T: Decodable>(_ path: String, query: [String: String] = [:], auth: Bool = true) async throws -> T {
        try decode(T.self, try await perform("GET", path, query: query, auth: auth).0)
    }
    public func post<T: Decodable>(_ path: String, body: any Encodable = EmptyBody(), auth: Bool = true) async throws -> T {
        try decode(T.self, try await perform("POST", path, body: body, auth: auth).0)
    }
    public func put<T: Decodable>(_ path: String, body: any Encodable = EmptyBody()) async throws -> T {
        try decode(T.self, try await perform("PUT", path, body: body).0)
    }
    public func delete(_ path: String) async throws { _ = try await perform("DELETE", path) }

    private func refresh() async -> Bool {
        if let t = refreshing { return await t.value }
        let task = Task<Bool, Never> { [self] in
            guard let current = tokens.load() else { return false }
            do {
                struct Req: Encodable { var refreshToken: String }
                struct Res: Decodable { var accessToken: String, refreshToken: String }
                let (d, resp) = try await send(try request("POST", "/auth/refresh", body: Req(refreshToken: current.refreshToken), auth: false))
                guard resp.statusCode == 200, let r = try? JSONDecoder().decode(Res.self, from: d) else { tokens.save(nil); return false }
                tokens.save(Tokens(accessToken: r.accessToken, refreshToken: r.refreshToken))
                return true
            } catch { return false }
        }
        refreshing = task
        let ok = await task.value
        refreshing = nil
        return ok
    }

    // MARK: Auth (IOS-2, IOS-3)
    public struct DeviceInfo: Encodable, Sendable {
        public var vendorId: String, model: String?, osVersion: String?, appVersion: String?
        public init(vendorId: String, model: String? = nil, osVersion: String? = nil, appVersion: String? = nil) { self.vendorId = vendorId; self.model = model; self.osVersion = osVersion; self.appVersion = appVersion }
    }
    public func login(email: String, password: String, device: DeviceInfo, location: Coordinate? = nil) async throws -> SessionUser {
        struct Req: Encodable { var email: String, password: String, client = "ios", device: DeviceInfo, location: Coordinate? }
        let r: LoginResponse = try await post("/auth/login", body: Req(email: email, password: password, device: device, location: location.map { Coordinate(lat: coarse($0.lat), lng: coarse($0.lng)) }), auth: false)
        guard let a = r.accessToken, let rt = r.refreshToken else { throw APIError.problem(status: 401, code: "MFA_CODE_REQUIRED") }
        tokens.save(Tokens(accessToken: a, refreshToken: rt))
        return r.user
    }
    public func register(firstName: String, lastName: String, email: String, password: String, locale: String) async throws {
        struct Req: Encodable { var accountType = "user", firstName: String, lastName: String, email: String, password: String, confirmPassword: String, acceptTerms = true, locale: String }
        let _: Ack = try await post("/auth/register", body: Req(firstName: firstName, lastName: lastName, email: email, password: password, confirmPassword: password, locale: locale), auth: false)
    }
    public func resendVerification(email: String) async throws { struct Req: Encodable { var email: String }; let _: Ack = try await post("/auth/resend-verification", body: Req(email: email), auth: false) }
    public func forgotPassword(email: String) async throws { struct Req: Encodable { var email: String }; let _: Ack = try await post("/auth/forgot-password", body: Req(email: email), auth: false) }
    public func logout() async {
        struct Req: Encodable { var refreshToken: String? }
        let rt = tokens.load()?.refreshToken
        _ = try? await perform("POST", "/auth/logout", body: Req(refreshToken: rt))
        tokens.save(nil)
    }
    public func me() async throws -> SessionUser { struct R: Decodable { var id: String, email: String, role: String, firstName: String, lastName: String, locale: String }; let r: R = try await get("/me"); return SessionUser(id: r.id, email: r.email, role: r.role, firstName: r.firstName, lastName: r.lastName, locale: r.locale) }

    // MARK: Catalogue and discovery (public)
    public func catalogue() async throws -> Catalogue {
        async let i: [Issuer] = get("/issuers", auth: false), w: [WalletProvider] = get("/wallet-providers", auth: false), p: [CardProduct] = get("/card-products", auth: false)
        return try await Catalogue(issuers: i, wallets: w, products: p)
    }
    public func filters(lang: Lang) async throws -> FilterChips { try await get("/map/filters", query: ["lang": lang.rawValue], auth: false) }
    public func mapPremises(bbox: (minLng: Double, minLat: Double, maxLng: Double, maxLat: Double), filter: [String: String] = [:], lang: Lang) async throws -> MapPage {
        var q = filter; q["bbox"] = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].map { String(format: "%.5f", $0) }.joined(separator: ","); q["lang"] = lang.rawValue; q["limit"] = "500"
        return try await get("/map/premises", query: q, auth: false)
    }
    public func nearby(at c: Coordinate, radiusM: Int, filter: [String: String] = [:], lang: Lang) async throws -> NearbyResponse {
        var q = filter; q["lat"] = String(c.lat); q["lng"] = String(c.lng); q["radius"] = String(radiusM); q["lang"] = lang.rawValue; q["limit"] = "100"
        return try await get("/discounts/nearby", query: q, auth: false)
    }
    public func recent(kind: String = "recent", lang: Lang) async throws -> RecentResponse { try await get("/discounts/recent", query: ["kind": kind, "lang": lang.rawValue], auth: false) }
    public func premise(_ id: String, lang: Lang) async throws -> PremiseDetail { try await get("/map/premises/\(id)", query: ["lang": lang.rawValue], auth: false) }
    public func discount(_ id: String, lang: Lang) async throws -> Offer { try await get("/map/discounts/\(id)", query: ["lang": lang.rawValue], auth: false) }
    public func sync(at c: Coordinate) async throws -> SyncPayload { try await get("/sync/geofences", query: ["lat": String(c.lat), "lng": String(c.lng)], auth: false) }

    // MARK: Me
    public func bundle() async throws -> Bundle_ { try await get("/me/bundle") }
    public func addCard(_ productId: String, nickname: String? = nil) async throws { struct Req: Encodable { var cardProductId: String; var nickname: String? }; let _: MyCardAck = try await post("/me/cards", body: Req(cardProductId: productId, nickname: nickname)) }
    public func removeCard(_ id: String) async throws { try await delete("/me/cards/\(id)") }
    public func addWallet(_ id: String) async throws { struct Req: Encodable { var walletProviderId: String }; let _: WalletAck = try await post("/me/wallets", body: Req(walletProviderId: id)) }
    public func removeWallet(_ id: String) async throws { try await delete("/me/wallets/\(id)") }
    public func savePrefs(_ p: Prefs) async throws {
        struct Req: Encodable { var alertsEnabled: Bool, mode: AlertMode, quietFrom: String?, quietTo: String?, generalIssuers: [String], generalWallets: [String]
            func encode(to e: Encoder) throws { var c = e.container(keyedBy: K.self); try c.encode(alertsEnabled, forKey: .alertsEnabled); try c.encode(mode, forKey: .mode); try c.encode(quietFrom, forKey: .quietFrom); try c.encode(quietTo, forKey: .quietTo); try c.encode(generalIssuers, forKey: .generalIssuers); try c.encode(generalWallets, forKey: .generalWallets) }
            enum K: String, CodingKey { case alertsEnabled, mode, quietFrom, quietTo, generalIssuers, generalWallets } }
        let _: PrefsAck = try await put("/me/alert-preferences", body: Req(alertsEnabled: p.alertsEnabled, mode: p.mode, quietFrom: p.quietFrom, quietTo: p.quietTo, generalIssuers: p.generalIssuers, generalWallets: p.generalWallets))
    }
    public func favourites() async throws -> [FavouriteItem] { let p: FavouritesPage = try await get("/me/favourites", query: ["limit": "100"]); return p.items }
    public func favourite(_ id: String, on: Bool) async throws { if on { let _: Ack = try await put("/me/favourites/\(id)") } else { try await delete("/me/favourites/\(id)") } }
    public func registerPushToken(vendorId: String, token: String, device: DeviceInfo) async throws {
        struct Req: Encodable { var vendorId: String, pushToken: String, model: String?, osVersion: String?, appVersion: String? }
        let _: DeviceAck = try await put("/me/push-token", body: Req(vendorId: vendorId, pushToken: token, model: device.model, osVersion: device.osVersion, appVersion: device.appVersion))
    }
    public func postEvents(_ events: [AlertEvent]) async throws { struct Req: Encodable { var events: [AlertEvent] }; let _: IngestAck = try await post("/alerts/events", body: Req(events: events)) }
    public func updateProfile(firstName: String, lastName: String, phone: String?) async throws -> SessionUser {
        struct Req: Encodable { var firstName: String, lastName: String, phone: String?
            func encode(to e: Encoder) throws { var c = e.container(keyedBy: K.self); try c.encode(firstName, forKey: .firstName); try c.encode(lastName, forKey: .lastName); try c.encode(phone, forKey: .phone) }
            enum K: String, CodingKey { case firstName, lastName, phone } }
        struct R: Decodable { var id: String, email: String, role: String, firstName: String, lastName: String, locale: String }
        let r: R = try decode(R.self, try await perform("PATCH", "/me", body: Req(firstName: firstName, lastName: lastName, phone: phone)).0)
        return SessionUser(id: r.id, email: r.email, role: r.role, firstName: r.firstName, lastName: r.lastName, locale: r.locale)
    }
    public func changePassword(current: String, new: String) async throws { struct Req: Encodable { var currentPassword: String, newPassword: String }; let _: Ack = try await post("/me/change-password", body: Req(currentPassword: current, newPassword: new)) }
    public func exportMyData() async throws -> Data { try await perform("GET", "/me/export").0 }
    public func deleteAccount(password: String) async throws { struct Req: Encodable { var password: String }; let _: Ack = try await send(deleteReq: Req(password: password)) }
    private func send(deleteReq body: any Encodable) async throws -> Ack { try decode(Ack.self, try await perform("DELETE", "/me", body: body).0) }
}

public struct EmptyBody: Encodable, Sendable { public init() {} }
struct AnyEncodable: Encodable { let v: any Encodable; init(_ v: any Encodable) { self.v = v }; func encode(to e: Encoder) throws { try v.encode(to: e) } }
struct Ack: Decodable { var ok: Bool? }
struct MyCardAck: Decodable { var id: String? }
struct WalletAck: Decodable { var walletProviderId: String? }
struct PrefsAck: Decodable { var alertsEnabled: Bool? }
struct DeviceAck: Decodable { var ok: Bool? }
struct IngestAck: Decodable { var received: Int? }
