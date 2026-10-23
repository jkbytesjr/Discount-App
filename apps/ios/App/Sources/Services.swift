import Foundation
import CoreLocation
import UserNotifications
import LocalAuthentication
import UIKit
import MozCore

// MARK: Alert history kept on the device (the "Alerts inbox", IOS-7)
struct AlertLogEntry: Codable, Identifiable, Equatable {
    var id = UUID().uuidString
    var date: Date
    var title: String
    var body: String
    var premiseId: String
    var discountIds: [String]
    var suppressedReason: String?
}

final class AlertLogStore {
    private let url: URL
    private(set) var entries: [AlertLogEntry]
    init(url: URL) { self.url = url; entries = (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode([AlertLogEntry].self, from: $0) } ?? [] }
    func add(_ e: AlertLogEntry) { entries.insert(e, at: 0); if entries.count > 200 { entries.removeLast(entries.count - 200) }; if let d = try? JSONEncoder().encode(entries) { try? d.write(to: url, options: .atomic) } }
}

// MARK: Location and region monitoring (IOS-8)
@MainActor
final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var authorization: CLAuthorizationStatus = .notDetermined
    @Published var location: CLLocation?
    var onEnterRegion: ((String, CLLocation?) -> Void)?
    var onSignificantMove: ((CLLocation) -> Void)?
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        authorization = manager.authorizationStatus
    }
    var hasAlways: Bool { authorization == .authorizedAlways }
    var hasAny: Bool { authorization == .authorizedAlways || authorization == .authorizedWhenInUse }

    func requestPermission() { authorization == .authorizedWhenInUse ? manager.requestAlwaysAuthorization() : manager.requestWhenInUseAuthorization() }
    func start() {
        guard hasAny else { return }
        manager.startUpdatingLocation()
        if hasAlways { manager.allowsBackgroundLocationUpdates = false; manager.startMonitoringSignificantLocationChanges() } // wakes the app to rotate regions
    }
    func requestOnce() { manager.requestLocation() }

    /// Replaces the monitored set; iOS allows at most 20 regions.
    func monitor(_ premises: [SyncPremise]) {
        for r in manager.monitoredRegions { manager.stopMonitoring(for: r) }
        guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else { return }
        for p in premises.prefix(RegionPlanner.maxRegions) {
            let r = CLCircularRegion(center: CLLocationCoordinate2D(latitude: p.lat, longitude: p.lng), radius: min(max(Double(p.radiusM), 50), manager.maximumRegionMonitoringDistance), identifier: p.id)
            r.notifyOnEntry = true; r.notifyOnExit = false
            manager.startMonitoring(for: r)
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        let status = m.authorizationStatus
        Task { @MainActor in self.authorization = status; self.start() }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        guard let l = locs.last else { return }
        Task { @MainActor in self.location = l; self.onSignificantMove?(l) }
    }
    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {}
    nonisolated func locationManager(_ m: CLLocationManager, didEnterRegion region: CLRegion) {
        let id = region.identifier
        Task { @MainActor in self.onEnterRegion?(id, self.location ?? m.location) }
    }
}

// MARK: Face ID (IOS-1)
enum Biometrics {
    static var available: Bool { var e: NSError?; return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &e) }
    static func authenticate(reason: String) async -> Bool {
        let c = LAContext(); c.localizedCancelTitle = nil
        return (try? await c.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) ?? false
    }
}

// MARK: Notifications
extension Notification.Name { static let mozOpenOffer = Notification.Name("moz.openOffer") }

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    var onOpened: ((_ premiseId: String, _ discountIds: [String]) -> Void)?
    var onDismissed: ((_ premiseId: String, _ discountIds: [String]) -> Void)?
    static let category = "PROXIMITY"
    func register() {
        let cat = UNNotificationCategory(identifier: Self.category, actions: [], intentIdentifiers: [], options: [.customDismissAction])
        UNUserNotificationCenter.current().setNotificationCategories([cat])
        UNUserNotificationCenter.current().delegate = self
    }
    func requestPermission() async -> Bool { (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false }

    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound, .list] }
    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse) async {
        let info = r.notification.request.content.userInfo
        let premise = info["premiseId"] as? String ?? ""
        let ids = (info["discountIds"] as? [String]) ?? []
        if r.actionIdentifier == UNNotificationDismissActionIdentifier { onDismissed?(premise, ids) }
        else { onOpened?(premise, ids); NotificationCenter.default.post(name: .mozOpenOffer, object: nil, userInfo: info) }
    }
    func show(_ content: AlertContent) async {
        let m = UNMutableNotificationContent()
        m.title = content.title; m.body = content.body; m.sound = .default; m.categoryIdentifier = Self.category
        m.userInfo = ["premiseId": content.premiseId, "discountIds": content.discountIds, "bestDiscountId": content.bestDiscountId]
        try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: m, trigger: nil))
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    var onPushToken: ((String) -> Void)?
    func application(_ a: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) { onPushToken?(token.map { String(format: "%02x", $0) }.joined()) }
    func application(_ a: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {} // free provisioning cannot use push: local alerts still work
}
