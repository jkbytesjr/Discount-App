import Foundation
import SwiftUI
import UIKit
import CoreLocation
import UserNotifications
import MozCore
import os
import LocalAuthentication

private let logger = Logger(subsystem: "mz.mozdiscounts.app", category: "alerts")

@MainActor
final class AppModel: ObservableObject {
    /// Public HTTPS privacy policy (App Store requirement); also entered in App Store Connect.
    static let privacyPolicyURL = "https://discount-app-rho.vercel.app/privacy"
    enum Phase { case launching, onboarding, signedOut, signedIn }

    @Published var phase: Phase = .launching
    @Published var user: SessionUser?
    @Published var lang: Lang { didSet { UserDefaults.standard.set(lang.rawValue, forKey: "lang"); syncLocale() } }
    @Published var catalogueFailed = false
    @Published var catalogue = Catalogue()
    @Published var cards: [MyCard] = []
    @Published var wallets: [MyWallet] = []
    @Published var prefs = Prefs()
    @Published var favouriteIds: Set<String> = []
    @Published var banner: String?
    @Published var locked = false
    @Published var lockEnabled: Bool { didSet { UserDefaults.standard.set(lockEnabled, forKey: "lockEnabled"); tokens.reprotect() } }
    @Published var offerFaceID = false
    @Published var openOfferId: String?
    @Published var alertLog: [AlertLogEntry] = []
    @Published var needsCardOnboarding = false
    @Published var settings = SyncSettings.default

    let tokens = KeychainTokenStore()
    let api: APIClient
    let location = LocationService()
    let notifications = NotificationDelegate()
    let queue: EventQueue
    private let log: AlertLogStore
    private var alertState: AlertState
    private var sync: SyncPayload?
    private var lastPlanCenter: Coordinate?
    private let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    private var pushToken: String?
    private var inside: Set<String> = []          // premises whose circle we are currently in (foreground check)
    private var lastEntry: [String: Date] = [:]   // de-duplicates region events and foreground checks

    init() {
        let saved = UserDefaults.standard.string(forKey: "lang").flatMap(Lang.init(rawValue:))
        lang = saved ?? (Locale.preferredLanguages.first?.hasPrefix("en") == true ? .en : .pt)
        lockEnabled = UserDefaults.standard.bool(forKey: "lockEnabled")
        let override = ProcessInfo.processInfo.environment["MOZ_API_BASE_URL"] // launch-time override (simulator scripts, UI tests)
        let base = (override ?? Bundle.main.object(forInfoDictionaryKey: "MozAPIBaseURL") as? String).flatMap(URL.init(string:)) ?? URL(string: "http://localhost:3000")!
        api = APIClient(baseURL: base, tokens: tokens)
        queue = EventQueue(fileURL: docs.appendingPathComponent("event-queue.json"))
        log = AlertLogStore(url: docs.appendingPathComponent("alert-log.json"))
        alertState = (try? Data(contentsOf: docs.appendingPathComponent("alert-state.json"))).flatMap { try? JSONDecoder().decode(AlertState.self, from: $0) } ?? AlertState()
        alertLog = log.entries
        Task { await api.setOnSessionExpired { [weak self = self] in Task { @MainActor in self?.sessionExpired() } } }
        wire()
    }

    func t(_ key: String, _ vars: [String: String] = [:]) -> String { L10n.t(key, lang, vars) }
    var deviceInfo: APIClient.DeviceInfo {
        APIClient.DeviceInfo(vendorId: UIDevice.current.identifierForVendor?.uuidString ?? "unknown", model: UIDevice.current.model, osVersion: UIDevice.current.systemVersion, appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)
    }
    var holdings: Holdings {
        Holdings(cards: cards.map { HeldCard(productId: $0.cardProductId, issuerId: $0.issuerId, cardType: $0.cardType, networkId: $0.networkId) }, wallets: wallets.map(\.walletProviderId))
    }
    var userContext: UserContext {
        UserContext(holdings: holdings, mode: prefs.mode, generalIssuers: prefs.generalIssuers, generalWallets: prefs.generalWallets, favourites: favouriteIds, alertsEnabled: prefs.alertsEnabled, quietFrom: prefs.quietFrom, quietTo: prefs.quietTo, lang: lang)
    }

    func message(for error: Error) -> String {
        guard let e = error as? APIError else { return "\(t("common.error")) (\(type(of: error)))" }
        let key = "err.\(e.code)"
        // Unknown codes are shown too, so a failure on a phone can be reported precisely.
        return L10n.table[key] != nil ? t(key) : "\(t("common.error")) (\(e.code))"
    }
    func notice(_ text: String) { banner = text; Task { try? await Task.sleep(nanoseconds: 2_500_000_000); if banner == text { banner = nil } } }
    func flash(_ error: Error) { banner = message(for: error); Task { try? await Task.sleep(nanoseconds: 4_000_000_000); banner = nil } }

    // MARK: Lifecycle
    private func wire() {
        notifications.register()
        notifications.onOpened = { [weak self] premise, ids in Task { @MainActor in self?.record(.OPENED, premise, ids); self?.openOfferId = ids.first } }
        notifications.onDismissed = { [weak self] premise, ids in Task { @MainActor in self?.record(.DISMISSED, premise, ids) } }
        location.onEnterRegion = { [weak self] id, loc in Task { @MainActor in await self?.handleEntry(premiseId: id, at: loc) } }
        location.onSignificantMove = { [weak self] loc in Task { @MainActor in await self?.refreshRegions(near: loc); await self?.checkInside(loc) } }
    }

    /// The catalogue is public data the card and wallet pickers need. The first request of a fresh install can fail
    /// (iOS asks for Local Network access when the API is a LAN address), so it is retried and can be reloaded by hand.
    @discardableResult
    func ensureCatalogue() async -> Bool {
        if !catalogue.products.isEmpty && !catalogue.wallets.isEmpty { return true }
        do { catalogue = try await api.catalogue(); catalogueFailed = false; return !catalogue.products.isEmpty }
        catch { catalogueFailed = true; logger.error("catalogue failed: \(String(describing: error), privacy: .public)"); return false }
    }
    private func retryCatalogue() { Task { for _ in 0..<6 where !(await ensureCatalogue()) { try? await Task.sleep(nanoseconds: 3_000_000_000) } } }
    private func syncLocale() { if phase == .signedIn { let l = lang; Task { try? await api.setLocale(l) } } }

    func bootstrap() async {
        if !(await ensureCatalogue()) { retryCatalogue() }
        #if DEBUG
        // Simulator scripts: MOZ_AUTOLOGIN="email:password" signs in without typing; never compiled into Release builds.
        if tokens.load() == nil, let cred = ProcessInfo.processInfo.environment["MOZ_AUTOLOGIN"], let i = cred.firstIndex(of: ":") {
            UserDefaults.standard.set(true, forKey: "onboardingSeen"); UserDefaults.standard.set(true, forKey: "cardsOnboardingDone")
            try? await login(email: String(cred[..<i]), password: String(cred[cred.index(after: i)...]))
            if phase == .signedIn { return }
        }
        #endif
        if lockEnabled, tokens.load() == nil, tokens.hasStoredTokens {
            // IOS-1: Face ID unlocks the stored refresh token, then we are signed in with no password typed.
            let ctx = LAContext()
            if (try? await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: t("lock.reason"))) == true { _ = tokens.unlock(with: ctx) }
        }
        if tokens.load() != nil, let u = try? await api.me(), u.role == "USER" {
            user = u; phase = .signedIn
            await loadBundle(); await afterSignIn()
        } else if UserDefaults.standard.bool(forKey: "onboardingSeen") { phase = .signedOut } else { phase = .onboarding }
    }
    func finishOnboarding() { UserDefaults.standard.set(true, forKey: "onboardingSeen"); phase = .signedOut }

    func loadBundle() async {
        do { let b = try await api.bundle(); cards = b.cards; wallets = b.wallets; prefs = b.prefs; favouriteIds = Set(b.favouriteIds); logger.info("bundle: \(b.cards.count, privacy: .public) cards, \(b.wallets.count, privacy: .public) wallets") } catch { logger.error("bundle failed: \(String(describing: error), privacy: .public)"); flash(error) }
    }
    func afterSignIn() async {
        needsCardOnboarding = cards.isEmpty && wallets.isEmpty && !UserDefaults.standard.bool(forKey: "cardsOnboardingDone")
        location.start()
        if let token = pushToken { try? await api.registerPushToken(vendorId: deviceInfo.vendorId, token: token, device: deviceInfo) }
        UIApplication.shared.registerForRemoteNotifications()
        if let l = location.location { await refreshRegions(near: l) }
        await flushQueue()
    }
    func setPushToken(_ t: String) { pushToken = t; if user != nil { Task { try? await api.registerPushToken(vendorId: deviceInfo.vendorId, token: t, device: deviceInfo) } } }

    func login(email: String, password: String) async throws {
        let u = try await api.login(email: email, password: password, device: deviceInfo, location: location.location.map { Coordinate(lat: $0.coordinate.latitude, lng: $0.coordinate.longitude) })
        // The app is for customers: cards, wallets and favourites are refused for business and admin accounts (they use the web portal).
        guard u.role == "USER" else { await api.logout(); throw APIError.problem(status: 403, code: "WRONG_ROLE") }
        user = u
        phase = .signedIn; await loadBundle(); await afterSignIn()
        if Biometrics.available, !lockEnabled, !UserDefaults.standard.bool(forKey: "faceIdAsked") { offerFaceID = true }
    }
    func logout() async {
        await api.logout()
        user = nil; cards = []; wallets = []; favouriteIds = []; prefs = Prefs(); phase = .signedOut
        for r in CLLocationManager().monitoredRegions { CLLocationManager().stopMonitoring(for: r) }
    }
    private func sessionExpired() { if phase == .signedIn { user = nil; phase = .signedOut } }
    func updateProfile(firstName: String, lastName: String, phone: String?) async throws {
        _ = try await api.updateProfile(firstName: firstName, lastName: lastName, phone: phone)
        user = try await api.me() // re-read: what the screen shows is what the server stored
        notice(t("profile.saved"))
    }
    func deleteAccount(password: String) async throws { try await api.deleteAccount(password: password); await logout() }

    // MARK: Cards, wallets, preferences, favourites
    @discardableResult
    func addCard(_ productId: String, nickname: String?) async -> Bool { do { try await api.addCard(productId, nickname: nickname); await loadBundle(); await resync(); notice(t("common.added")); return true } catch { flash(error); return false } }
    func removeCard(_ id: String) async { do { try await api.removeCard(id); await loadBundle(); await resync() } catch { flash(error) } }
    @discardableResult
    func addWallet(_ id: String) async -> Bool { do { try await api.addWallet(id); await loadBundle(); await resync(); notice(t("common.added")); return true } catch { flash(error); return false } }
    func removeWallet(_ id: String) async { do { try await api.removeWallet(id); await loadBundle(); await resync() } catch { flash(error) } }
    func save(prefs p: Prefs) async { do { try await api.savePrefs(p); prefs = p } catch { flash(error) } }
    func toggleFavourite(_ id: String) async {
        let on = !favouriteIds.contains(id)
        if on { favouriteIds.insert(id) } else { favouriteIds.remove(id) } // optimistic
        do { try await api.favourite(id, on: on) } catch { if on { favouriteIds.remove(id) } else { favouriteIds.insert(id) }; flash(error) }
    }
    private func resync() async { if let l = location.location { await refreshRegions(near: l) } }

    // MARK: Alert engine glue (IOS-8, BR-10)
    func refreshRegions(near l: CLLocation) async {
        let c = Coordinate(lat: l.coordinate.latitude, lng: l.coordinate.longitude)
        guard phase == .signedIn, RegionPlanner.shouldRotate(from: lastPlanCenter, to: c) || sync == nil else { return }
        do {
            let s = try await api.sync(at: c)
            sync = s; settings = s.settings; lastPlanCenter = c
            let plan = RegionPlanner.plan(premises: s.premises, around: c)
            location.monitor(plan)
            logger.info("monitoring \(plan.count, privacy: .public) regions, \(s.offers.count, privacy: .public) offers")
        } catch { /* keep the previous regions: offline is fine */ }
    }

    /// Foreground fallback: CoreLocation region events can be late or missing (and never fire in the simulator for a jump), so each position update also checks the monitored circles.
    func checkInside(_ l: CLLocation) async {
        guard let s = sync else { return }
        let here = Coordinate(lat: l.coordinate.latitude, lng: l.coordinate.longitude)
        var now: Set<String> = []
        for p in RegionPlanner.plan(premises: s.premises, around: here) where distanceM(here, Coordinate(lat: p.lat, lng: p.lng)) <= Double(p.radiusM) { now.insert(p.id) }
        let entered = now.subtracting(inside); inside = now
        for id in entered { await handleEntry(premiseId: id, at: l) }
    }

    func handleEntry(premiseId: String, at loc: CLLocation?) async {
        if let last = lastEntry[premiseId], Date().timeIntervalSince(last) < 60 { return }
        lastEntry[premiseId] = Date()
        logger.info("entered region \(premiseId, privacy: .public)")
        guard let s = sync, let premise = s.premises.first(where: { $0.id == premiseId }) else { return }
        let now = Date()
        let here = loc.map { Coordinate(lat: $0.coordinate.latitude, lng: $0.coordinate.longitude) }
        let dist = here.map { Int(distanceM($0, Coordinate(lat: premise.lat, lng: premise.lng))) }
        record(.TRIGGERED, premiseId, premise.discountIds, distance: dist, at: here)
        switch AlertEngine.decide(premise: premise, offers: s.offers, user: userContext, state: alertState, settings: s.settings, catalogue: catalogue, now: now) {
        case .suppressed(let reason, let ids):
            logger.info("suppressed \(reason.rawValue, privacy: .public)")
            record(.SUPPRESSED, premiseId, ids, reason: reason, distance: dist, at: here)
            log.add(AlertLogEntry(date: now, title: premise.name, body: reason.rawValue, premiseId: premiseId, discountIds: ids, suppressedReason: reason.rawValue)); alertLog = log.entries
        case .alert(let content):
            logger.info("alert \(content.title, privacy: .public)")
            alertState.recordAlert(premiseId: premiseId, at: now); persistState()
            await notifications.show(content)
            record(.DELIVERED, premiseId, content.discountIds, distance: dist, at: here)
            log.add(AlertLogEntry(date: now, title: content.title, body: content.body, premiseId: premiseId, discountIds: content.discountIds)); alertLog = log.entries
        }
    }
    private func persistState() { if let d = try? JSONEncoder().encode(alertState) { try? d.write(to: docs.appendingPathComponent("alert-state.json"), options: .atomic) } }

    func record(_ type: EventType, _ premiseId: String, _ ids: [String], reason: SuppressReason? = nil, distance: Int? = nil, at c: Coordinate? = nil) {
        guard user != nil else { return }
        queue.enqueue(AlertEvent(type: type, reason: reason, premiseId: premiseId, discountIds: ids, occurredAt: Date(), distanceM: distance, location: c, appVersion: deviceInfo.appVersion, osVersion: deviceInfo.osVersion))
        Task { await flushQueue() }
    }
    func flushQueue() async {
        let n = await queue.flush { [api] batch in try await api.postEvents(batch) }
        if n > 0 { logger.info("sent \(n, privacy: .public) events") } else if queue.count > 0 { logger.error("\(self.queue.count, privacy: .public) events still queued") }
    }
    func viewed(premiseId: String, discountIds: [String]) { record(.DETAIL_VIEWED, premiseId, discountIds) }
}
