import XCTest
@testable import MozCore

// TD-6: the same vectors the TypeScript implementation passes (packages/shared/test-vectors/matching.json).
final class MatchingVectorTests: XCTestCase {
    struct Vector: Decodable {
        var id: String, name: String, now: String, mode: AlertMode
        var holdings: Holdings, favourites: [String], generalIssuers: [String], generalWallets: [String]
        var offers: [VOffer], expected: [String]
    }
    struct VOffer: Decodable {
        var discountId: String, status: String
        var validFrom: String?, validTo: String?
        var scheduleDays: [String], scheduleFrom: String?, scheduleTo: String?
        var businessApproved: Bool
        var publishedAt: String?
        var rows: [EligibilityRow]
    }

    func testAllVectors() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let url = root.appendingPathComponent("packages/shared/test-vectors/matching.json")
        let vectors = try JSONDecoder().decode([Vector].self, from: Data(contentsOf: url))
        XCTAssertGreaterThanOrEqual(vectors.count, 20)
        for v in vectors {
            let now = parseISO(v.now)!
            var cands: [OfferCandidate] = []
            for o in v.offers {
                let w = DiscountWindow(status: o.status, validFrom: o.validFrom, validTo: o.validTo, days: o.scheduleDays, from: o.scheduleFrom, to: o.scheduleTo)
                guard isActiveAt(w, businessApproved: o.businessApproved, now) else { continue }
                for (i, r) in o.rows.enumerated() { cands.append(OfferCandidate(discountId: o.discountId, rowIndex: i, row: r, publishedAt: parseISO(o.publishedAt), isFavourite: v.favourites.contains(o.discountId))) }
            }
            let ranked = rankOffers(cands, RankInput(holdings: v.holdings, mode: v.mode, generalIssuers: v.generalIssuers, generalWallets: v.generalWallets))
            XCTAssertEqual(ranked.map { "\($0.discountId)#\($0.rowIndex)" }, v.expected, "\(v.id): \(v.name)")
        }
    }

    func testMaputoTime() {
        let t = parseISO("2026-11-04T11:00:00Z")!
        XCTAssertEqual(maputoParts(t), MaputoParts(day: "WED", minutes: 13 * 60, date: "2026-11-04"))
        XCTAssertEqual(maputoParts(parseISO("2026-11-04T22:30:00Z")!).day, "THU") // 00:30 next day in Maputo
        XCTAssertFalse(isPastValidity("2026-09-30", parseISO("2026-09-30T21:59:59Z")!))
        XCTAssertTrue(isPastValidity("2026-09-30", parseISO("2026-09-30T22:00:00Z")!))
    }
}
