import Foundation

/// Offline queue for alert events (BR-10 AC: an OPENED event made offline is queued and sent later).
/// Each event keeps its clientEventId, so a retry after a timeout is stored once on the server.
public final class EventQueue: @unchecked Sendable {
    private let url: URL
    private let lock = NSLock()
    private var events: [AlertEvent]
    public static let maxQueued = 500

    public init(fileURL: URL) {
        url = fileURL
        events = (try? Data(contentsOf: fileURL)).flatMap { try? JSONDecoder().decode([AlertEvent].self, from: $0) } ?? []
    }
    public var count: Int { lock.withLock { events.count } }
    public var pending: [AlertEvent] { lock.withLock { events } }

    public func enqueue(_ e: AlertEvent) {
        lock.withLock {
            events.append(e)
            if events.count > Self.maxQueued { events.removeFirst(events.count - Self.maxQueued) } // keep the newest
            persist()
        }
    }

    /// Sends in batches of 50 (the server limit). Stops at the first failure and keeps what was not accepted.
    @discardableResult
    public func flush(_ send: ([AlertEvent]) async throws -> Void) async -> Int {
        var sent = 0
        while true {
            let batch = lock.withLock { Array(events.prefix(50)) }
            if batch.isEmpty { return sent }
            do { try await send(batch) } catch { return sent }
            lock.withLock { events.removeFirst(min(batch.count, events.count)); persist() }
            sent += batch.count
        }
    }
    private func persist() { if let d = try? JSONEncoder().encode(events) { try? d.write(to: url, options: .atomic) } }
}
