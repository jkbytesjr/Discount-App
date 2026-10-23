import Foundation

public struct Coordinate: Codable, Sendable, Equatable {
    public var lat: Double, lng: Double
    public init(lat: Double, lng: Double) { self.lat = lat; self.lng = lng }
}

/// Great-circle distance in metres (Haversine).
public func distanceM(_ a: Coordinate, _ b: Coordinate) -> Double {
    let R = 6_371_000.0, rad = { (d: Double) in d * .pi / 180 }
    let dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
    let h = pow(sin(dLat / 2), 2) + cos(rad(a.lat)) * cos(rad(b.lat)) * pow(sin(dLng / 2), 2)
    return 2 * R * asin(min(1, sqrt(h)))
}

/// ~100 m precision (3 decimals) for the coarse location sent to the server.
public func coarse(_ n: Double) -> Double { (n * 1000).rounded() / 1000 }

public let mozambiqueBBox = (minLat: -27.0, maxLat: -9.9, minLng: 29.9, maxLng: 41.1)
public func insideMozambique(_ c: Coordinate) -> Bool { c.lat >= mozambiqueBBox.minLat && c.lat <= mozambiqueBBox.maxLat && c.lng >= mozambiqueBBox.minLng && c.lng <= mozambiqueBBox.maxLng }

/// iOS monitors at most 20 regions per app (IOS-8): keep the nearest ones and rotate as the person moves.
public enum RegionPlanner {
    public static let maxRegions = 20
    public static func plan(premises: [SyncPremise], around c: Coordinate, limit: Int = maxRegions) -> [SyncPremise] {
        premises.sorted { distanceM(c, Coordinate(lat: $0.lat, lng: $0.lng)) < distanceM(c, Coordinate(lat: $1.lat, lng: $1.lng)) }.prefix(limit).map { $0 }
    }
    /// True when the person moved far enough that the monitored set should be recomputed.
    public static func shouldRotate(from last: Coordinate?, to now: Coordinate, thresholdM: Double = 1000) -> Bool {
        guard let last else { return true }
        return distanceM(last, now) >= thresholdM
    }
}
