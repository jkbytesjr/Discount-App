import XCTest
@testable import MozCore

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) -> (Int, Data))?
    nonisolated(unsafe) static var seen: [URLRequest] = []
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.seen.append(request)
        let (status, data) = Self.handler?(request) ?? (500, Data())
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class InfraTests: XCTestCase {
    func tmp() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("q-\(UUID().uuidString).json") }
    func ev(_ n: Int = 0) -> AlertEvent { AlertEvent(type: .OPENED, premiseId: "pr-\(n)", discountIds: ["d-01"], occurredAt: Date(), location: Coordinate(lat: -25.94781, lng: 32.61333)) }

    func testCoarseLocationIsRoundedTo100m() { XCTAssertEqual(ev().lat, -25.948); XCTAssertEqual(ev().lng, 32.613) }

    func testQueuePersistsAndFlushesInBatchesStoppingOnFailure() async throws {
        let url = tmp()
        let q = EventQueue(fileURL: url)
        for i in 0..<120 { q.enqueue(ev(i)) }
        XCTAssertEqual(EventQueue(fileURL: url).count, 120) // survives a relaunch
        var batches: [Int] = []
        var fail = false
        let sent = await q.flush { b in if fail { throw APIError.network }; batches.append(b.count); if batches.count == 2 { fail = true } }
        XCTAssertEqual(batches, [50, 50]); XCTAssertEqual(sent, 100)
        XCTAssertEqual(q.count, 20) // the failed third batch stays queued
        fail = false
        let rest = await q.flush { b in batches.append(b.count) }
        XCTAssertEqual(rest, 20); XCTAssertEqual(q.count, 0)
        XCTAssertEqual(EventQueue(fileURL: url).count, 0)
    }
    func testQueueKeepsClientEventIdsStable() {
        let url = tmp(); let q = EventQueue(fileURL: url); let e = ev(); q.enqueue(e)
        XCTAssertEqual(EventQueue(fileURL: url).pending.first?.clientEventId, e.clientEventId)
    }
    func testRegionPlannerKeepsTheNearest20AndRotates() {
        let premises = (0..<30).map { SyncPremise(id: "p\($0)", name: "P\($0)", lat: -25.9 - Double($0) * 0.01, lng: 32.6, radiusM: 150, discountIds: []) }
        let plan = RegionPlanner.plan(premises: premises, around: Coordinate(lat: -25.9, lng: 32.6))
        XCTAssertEqual(plan.count, 20); XCTAssertEqual(plan.first?.id, "p0"); XCTAssertEqual(plan.last?.id, "p19")
        XCTAssertTrue(RegionPlanner.shouldRotate(from: nil, to: Coordinate(lat: 0, lng: 0)))
        XCTAssertFalse(RegionPlanner.shouldRotate(from: Coordinate(lat: -25.9, lng: 32.6), to: Coordinate(lat: -25.901, lng: 32.6)))
        XCTAssertTrue(RegionPlanner.shouldRotate(from: Coordinate(lat: -25.9, lng: 32.6), to: Coordinate(lat: -25.92, lng: 32.6)))
    }

    func apiClient(_ store: MemoryTokenStore) -> APIClient {
        let cfg = URLSessionConfiguration.ephemeral; cfg.protocolClasses = [StubProtocol.self]
        return APIClient(baseURL: URL(string: "https://example.test")!, tokens: store, session: URLSession(configuration: cfg))
    }
    func testLoginStoresTokensAndSendsBearer() async throws {
        StubProtocol.seen = []
        StubProtocol.handler = { r in
            if r.url!.path == "/api/v1/auth/login" { return (200, Data(#"{"user":{"id":"u1","email":"a@x.test","role":"USER","firstName":"Ana","lastName":"M","locale":"pt-MZ"},"accessToken":"AT1","refreshToken":"RT1","expiresIn":900}"#.utf8)) }
            return (200, Data(#"{"cards":[],"wallets":[],"prefs":{"alertsEnabled":true,"mode":"PERSONALISED","quietFrom":null,"quietTo":null,"generalIssuers":[],"generalWallets":[]},"favouriteIds":["d-01"]}"#.utf8))
        }
        let store = MemoryTokenStore(); let api = apiClient(store)
        let u = try await api.login(email: "a@x.test", password: "pw", device: .init(vendorId: "v1"))
        XCTAssertEqual(u.firstName, "Ana"); XCTAssertEqual(store.load(), Tokens(accessToken: "AT1", refreshToken: "RT1"))
        let b = try await api.bundle()
        XCTAssertEqual(b.favouriteIds, ["d-01"])
        XCTAssertEqual(StubProtocol.seen.last?.value(forHTTPHeaderField: "Authorization"), "Bearer AT1")
        let body = String(data: StubProtocol.seen.first!.httpBody ?? StubProtocol.seen.first!.httpBodyStream.map { s in s.open(); defer { s.close() }; var d = Data(); var buf = [UInt8](repeating: 0, count: 1024); while s.hasBytesAvailable { let n = s.read(&buf, maxLength: 1024); if n <= 0 { break }; d.append(buf, count: n) }; return d } ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains("\"client\":\"ios\"")); XCTAssertFalse(body.contains("lat"))
    }
    func testExpiredAccessTokenIsRefreshedOnceAndRetried() async throws {
        var calls = 0
        StubProtocol.handler = { r in
            switch r.url!.path {
            case "/api/v1/auth/refresh": return (200, Data(#"{"accessToken":"AT2","refreshToken":"RT2","expiresIn":900}"#.utf8))
            default:
                calls += 1
                return r.value(forHTTPHeaderField: "Authorization") == "Bearer AT2" ? (200, Data(#"{"items":[],"nextCursor":null}"#.utf8)) : (401, Data(#"{"code":"UNAUTHENTICATED"}"#.utf8))
            }
        }
        let store = MemoryTokenStore(Tokens(accessToken: "AT1", refreshToken: "RT1")); let api = apiClient(store)
        let favs = try await api.favourites()
        XCTAssertEqual(favs.count, 0); XCTAssertEqual(calls, 2); XCTAssertEqual(store.load()?.refreshToken, "RT2")
    }
    func testProblemJsonBecomesATypedError() async {
        StubProtocol.handler = { _ in (422, Data(#"{"code":"ALREADY_ADDED","title":"x"}"#.utf8)) }
        let api = apiClient(MemoryTokenStore(Tokens(accessToken: "a", refreshToken: "r")))
        do { try await api.addWallet("wl-mpesa"); XCTFail("should throw") } catch { XCTAssertEqual(error as? APIError, .problem(status: 422, code: "ALREADY_ADDED")) }
    }
    func testFailedRefreshClearsTokensAndSignalsExpiry() async {
        StubProtocol.handler = { r in r.url!.path.hasSuffix("/refresh") ? (401, Data(#"{"code":"TOKEN_REUSED"}"#.utf8)) : (401, Data(#"{"code":"UNAUTHENTICATED"}"#.utf8)) }
        let store = MemoryTokenStore(Tokens(accessToken: "a", refreshToken: "r")); let api = apiClient(store)
        do { _ = try await api.bundle(); XCTFail() } catch { XCTAssertEqual((error as? APIError)?.code, "UNAUTHENTICATED") }
        XCTAssertNil(store.load())
    }
}
