import SwiftUI
import MapKit
import CoreLocation
import MozCore

enum MainTab: Hashable { case home, favourites, alerts, profile }

struct MainTabs: View {
    @EnvironmentObject var app: AppModel
    @State private var tab: MainTab = {
        #if DEBUG
        switch ProcessInfo.processInfo.environment["MOZ_TAB"] { case "favourites": return .favourites; case "alerts": return .alerts; case "profile": return .profile; default: return .home }
        #else
        return .home
        #endif
    }()
    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case .home: HomeView()
                case .favourites: FavouritesView()
                case .alerts: AlertsView()
                case .profile: ProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            LiquidTabBar(tabs: [(.home, app.t("tab.home"), "map"), (.favourites, app.t("tab.favourites"), "heart"), (.alerts, app.t("tab.alerts"), "bell"), (.profile, app.t("tab.profile"), "person")], selection: $tab)
                .padding(.horizontal, 16).padding(.bottom, 6)
        }
        .alert(app.t("lock.offerTitle"), isPresented: $app.offerFaceID) {
            Button(app.t("lock.enable")) { UserDefaults.standard.set(true, forKey: "faceIdAsked"); app.lockEnabled = true }
            Button(app.t("lock.notNow"), role: .cancel) { UserDefaults.standard.set(true, forKey: "faceIdAsked") }
        } message: { Text(app.t("lock.offerBody")) }
        .sheet(item: Binding(get: { app.openOfferId.map(IDBox.init) }, set: { app.openOfferId = $0?.id })) { box in OfferDetailView(discountId: box.id) }
    }
}
struct IDBox: Identifiable { var id: String }

// MARK: Home: map, filter strip, new-offers carousel, nearby list (IOS-6, IOS-7)
struct HomeView: View {
    enum Filter: Hashable { case all, mine, general, issuer(String), wallet(String) }
    @EnvironmentObject var app: AppModel
    @State private var camera: MapCameraPosition = .region(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: -25.9692, longitude: 32.5732), span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)))
    @State private var places: [PremiseSummary] = []
    @State private var nearby: [NearbyItem] = []
    @State private var recent: [Offer] = []
    @State private var chips: FilterChips?
    @State private var filter: Filter = .all
    @State private var selected: String?
    @State private var panelOpen = true
    @State private var lastBBox: (Double, Double, Double, Double)?
    @State private var error = false
    @State private var placesSeq = 0   // a late response for an old filter must not overwrite a newer one
    @State private var nearbySeq = 0

    private func query() -> [String: String] {
        switch filter {
        case .all: return [:]
        case .general: return ["general": "1"]
        case .issuer(let id): return ["issuer": id]
        case .wallet(let id): return ["wallet": id]
        case .mine:
            var q: [String: String] = [:]
            let issuers = Set(app.cards.map(\.issuerId)), wallets = app.wallets.map(\.walletProviderId)
            if !issuers.isEmpty { q["issuer"] = issuers.sorted().joined(separator: ",") }
            if !wallets.isEmpty { q["wallet"] = wallets.joined(separator: ",") }
            if app.cards.isEmpty && app.wallets.isEmpty { return [:] }
            return q
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Map(position: $camera) {
                UserAnnotation()
                ForEach(places) { p in
                    if let c = p.coordinate {
                        Annotation(p.name, coordinate: CLLocationCoordinate2D(latitude: c.lat, longitude: c.lng)) {
                            Button { selected = p.id } label: {
                                ZStack { Circle().fill(Theme.accent).frame(width: 34, height: 34).overlay(Circle().stroke(.white, lineWidth: 2)); Image(systemName: icon(p.categoryId)).font(.manrope(size: 14, weight: .bold)).foregroundStyle(.white) }
                            }.accessibilityLabel(p.name)
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
            .onMapCameraChange(frequency: .onEnd) { ctx in Task { await load(region: ctx.region) } }
            .ignoresSafeArea()

            VStack(spacing: 10) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Chip(title: app.t("home.all"), selected: filter == .all) { filter = .all }
                        if !(app.cards.isEmpty && app.wallets.isEmpty) { Chip(title: app.t("home.mine"), selected: filter == .mine) { filter = .mine } }
                        if chips?.general == true { Chip(title: app.t("home.general"), selected: filter == .general) { filter = .general } }
                        ForEach(chips?.issuers ?? []) { i in Chip(title: i.name, selected: filter == .issuer(i.id)) { filter = .issuer(i.id) } }
                        ForEach(chips?.wallets ?? []) { w in Chip(title: w.name, selected: filter == .wallet(w.id)) { filter = .wallet(w.id) } }
                    }.padding(.horizontal, 16)
                }
                if !app.location.hasAlways && app.location.authorization != .notDetermined {
                    HStack(spacing: 10) {
                        Image(systemName: "bell.slash").foregroundStyle(Theme.warning)
                        Text(app.t("home.backgroundOff")).font(.manrope(size: 12)).foregroundStyle(.white)
                        Button(app.t("home.openSettings")) { if let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) } }.font(.manrope(size: 12, weight: .bold)).foregroundStyle(Theme.cyan)
                    }.padding(12).glass(16, dark: true).padding(.horizontal, 16)
                }
                Spacer()
            }.padding(.top, 6)

            VStack { Spacer(); bottomPanel.padding(.horizontal, 12).padding(.bottom, 84) }
        }
        .task { chips = try? await app.api.filters(lang: app.lang); await loadRecent(); await loadNearby() }
        .onChange(of: filter) { _, _ in Task { if let b = lastBBox { await fetch(b) }; await loadNearby() } }
        .onChange(of: app.lang) { _, _ in Task { await loadRecent(); await loadNearby() } }
        .onChange(of: app.location.location) { old, new in if old == nil, let l = new { camera = .region(MKCoordinateRegion(center: l.coordinate, span: MKCoordinateSpan(latitudeDelta: 0.03, longitudeDelta: 0.03))); Task { await loadNearby() } } }
        .sheet(item: Binding(get: { selected.map(IDBox.init) }, set: { selected = $0?.id })) { box in PremiseDetailView(premiseId: box.id) }
    }

    private var bottomPanel: some View {
        VStack(spacing: 8) {
            Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { panelOpen.toggle() } } label: {
                HStack { Text(app.t("home.places", ["n": String(places.count)])).font(.manrope(size: 13, weight: .bold)).foregroundStyle(.white); Spacer(); Image(systemName: panelOpen ? "chevron.down" : "chevron.up").foregroundStyle(Theme.secondary) }
            }.buttonStyle(.plain)
            if panelOpen {
                if !recent.isEmpty {
                    Text(app.t("home.recent").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted).frame(maxWidth: .infinity, alignment: .leading)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) { ForEach(recent) { o in Button { app.openOfferId = o.id } label: { OfferMiniCard(offer: o) }.buttonStyle(.plain) } }
                    }
                }
                Text(app.t("home.nearby").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted).frame(maxWidth: .infinity, alignment: .leading)
                if nearby.isEmpty { Text(error ? app.t("common.offline") : app.t("home.noPlaces")).font(.manrope(size: 13)).foregroundStyle(Theme.secondary).frame(maxWidth: .infinity, alignment: .leading) }
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(nearby) { item in
                            Button { selected = item.premise.id } label: {
                                HStack { VStack(alignment: .leading, spacing: 2) { Text(item.premise.name).font(.manrope(size: 14, weight: .semibold)).foregroundStyle(.white); Text(item.discount.rows.first(where: \.matched)?.label ?? item.discount.title).font(.manrope(size: 13)).foregroundStyle(Theme.secondary) }
                                    Spacer(); Text("\(item.distanceM) m").font(.manrope(size: 12, weight: .semibold)).foregroundStyle(Theme.cyan) }
                                .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }.buttonStyle(.plain)
                        }
                    }
                }.frame(maxHeight: 150)
            }
        }
        .padding(14).glass(26, dark: true)
    }

    private func icon(_ cat: String) -> String {
        switch cat { case "restaurant", "cafe-bakery": return "fork.knife"; case "supermarket": return "cart"; case "fuel": return "fuelpump"; case "pharmacy", "health-clinic": return "cross.case"; case "hotel-resort", "spa-wellness": return "bed.double"; case "electronics": return "laptopcomputer"; case "car-rental": return "car"; case "entertainment": return "film"; case "gym-fitness": return "dumbbell"; case "hair-beauty": return "scissors"; default: return "tag" }
    }
    private func load(region r: MKCoordinateRegion) async {
        let b = (r.center.longitude - r.span.longitudeDelta / 2, r.center.latitude - r.span.latitudeDelta / 2, r.center.longitude + r.span.longitudeDelta / 2, r.center.latitude + r.span.latitudeDelta / 2)
        lastBBox = b; await fetch(b)
    }
    private func fetch(_ b: (Double, Double, Double, Double)) async {
        placesSeq += 1; let mine = placesSeq
        do { let r = try await app.api.mapPremises(bbox: (b.0, b.1, b.2, b.3), filter: query(), lang: app.lang).items; if mine == placesSeq { places = r; error = false } } catch { if mine == placesSeq { self.error = true } }
    }
    private func loadNearby() async {
        let c = app.location.location.map { Coordinate(lat: $0.coordinate.latitude, lng: $0.coordinate.longitude) } ?? Coordinate(lat: -25.9692, lng: 32.5732)
        nearbySeq += 1; let mine = nearbySeq
        do { let r = try await app.api.nearby(at: c, radiusM: app.settings.nearbyRadiusM, filter: query(), lang: app.lang).items; if mine == nearbySeq { nearby = r; error = false } } catch { if mine == nearbySeq { self.error = true } }
    }
    private func loadRecent() async { recent = (try? await app.api.recent(lang: app.lang).items) ?? [] }
}

struct OfferMiniCard: View {
    var offer: Offer
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(offer.businessName).font(.manrope(size: 11)).foregroundStyle(Theme.muted).lineLimit(1)
            Text(offer.rows.first?.label ?? "").font(.display(20, weight: .regular)).foregroundStyle(Theme.accent)
            Text(offer.title).font(.manrope(size: 13, weight: .semibold)).foregroundStyle(.white).lineLimit(2)
        }.frame(width: 160, alignment: .leading).padding(12).glass(18)
    }
}

// MARK: Premise and offer detail (IOS-6, IOS-7)
struct OffersList: View {
    @EnvironmentObject var app: AppModel
    var offers: [Offer]; var premiseId: String?
    var body: some View {
        ForEach(offers) { o in
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) { Text(o.businessName).font(.manrope(size: 12)).foregroundStyle(Theme.muted); Text(o.title).font(.manrope(size: 17, weight: .semibold)).foregroundStyle(.white) }
                    Spacer()
                    Button { Task { await app.toggleFavourite(o.id) } } label: { Image(systemName: app.favouriteIds.contains(o.id) ? "heart.fill" : "heart").font(.manrope(size: 22)).foregroundStyle(app.favouriteIds.contains(o.id) ? Theme.magenta : .white).frame(width: 44, height: 44) }
                        .accessibilityLabel(app.t("detail.fav")).accessibilityAddTraits(app.favouriteIds.contains(o.id) ? .isSelected : [])
                }
                ForEach(o.rows) { r in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(r.label).font(.display(20, weight: .regular)).foregroundStyle(Theme.accent)
                        Text(who(r)).font(.manrope(size: 13)).foregroundStyle(Theme.secondary)
                    }
                    if let m = r.minSpendMzn { Text(app.t("detail.minSpend", ["n": String(m)])).font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
                    if let m = r.maxDiscountMzn { Text(app.t("detail.maxCap", ["n": String(m)])).font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
                    if let c = r.comment { Text(c).font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
                }
                if !o.days.isEmpty { Text(o.days.joined(separator: ", ") + ((o.from != nil && o.to != nil) ? " · \(o.from!)–\(o.to!)" : "")).font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
                if let v = o.validTo { Text(app.t("detail.validUntil", ["date": v])).font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
                if !o.activeNow { Text(app.t("detail.notActive")).font(.manrope(size: 12, weight: .bold)).foregroundStyle(Theme.warning) }
                if let r = o.redemption { Text("\(app.t("detail.redeem")): \(r)").font(.manrope(size: 13)).foregroundStyle(.white) }
                if let t = o.terms { Text("\(app.t("detail.terms")): \(t)").font(.manrope(size: 12)).foregroundStyle(Theme.muted) }
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(22)
        }
    }
    private func who(_ r: Row) -> String {
        switch r.scope {
        case .CARD_PRODUCT: return r.cardProductName ?? ""
        case .ISSUER_ANY: return app.t("elig.allCards", ["name": r.issuerName ?? ""])
        case .WALLET: return r.walletName ?? ""
        case .ANY_BANK_CARD: return app.t("elig.anyCard")
        case .ANY_WALLET: return app.t("elig.anyWallet")
        case .GENERAL: return app.t("elig.everyone")
        }
    }
}

struct PremiseDetailView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    var premiseId: String
    @State private var detail: PremiseDetail?; @State private var failed = false
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Spacer(); Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").font(.manrope(size: 26)).foregroundStyle(Theme.secondary) }.accessibilityLabel(app.t("common.close")) }
                if let d = detail {
                    Text(d.name).font(.display(32)).foregroundStyle(.white)
                    Text([d.address, d.city].compactMap { $0 }.joined(separator: ", ")).font(.manrope(size: 14)).foregroundStyle(Theme.secondary)
                    if let h = d.openingHours { Text("\(app.t("detail.hours")): \(h)").font(.manrope(size: 13)).foregroundStyle(Theme.muted) }
                    HStack {
                        if let lat = d.lat, let lng = d.lng { Button(app.t("detail.directions")) { if let u = URL(string: "http://maps.apple.com/?daddr=\(lat),\(lng)&q=\(d.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") { UIApplication.shared.open(u) } }.buttonStyle(GlassButtonStyle()) }
                        if let p = d.phone, let u = URL(string: "tel:\(p)") { Button(app.t("detail.call")) { UIApplication.shared.open(u) }.buttonStyle(GlassButtonStyle()) }
                    }
                    Text(app.t("detail.offers").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    if d.offers.isEmpty { Text(app.t("detail.noOffers")).foregroundStyle(Theme.secondary) }
                    OffersList(offers: d.offers, premiseId: d.id)
                } else if failed { Text(app.t("common.error")).foregroundStyle(Theme.secondary); Button(app.t("common.retry")) { Task { await load() } }.buttonStyle(GlassButtonStyle()) } else { ProgressView().tint(.white) }
            }.padding(20)
        } }
        .preferredColorScheme(.dark).task { await load() }
    }
    private func load() async {
        do { let d = try await app.api.premise(premiseId, lang: app.lang); detail = d; failed = false; app.viewed(premiseId: premiseId, discountIds: d.offers.map(\.id)) } catch { failed = true }
    }
}

struct OfferDetailView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    var discountId: String
    @State private var offer: Offer?; @State private var failed = false
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Spacer(); Button { dismiss() } label: { Image(systemName: "xmark.circle.fill").font(.manrope(size: 26)).foregroundStyle(Theme.secondary) }.accessibilityLabel(app.t("common.close")) }
                if let o = offer {
                    OffersList(offers: [o], premiseId: o.premises?.first?.id)
                    if let ps = o.premises, !ps.isEmpty {
                        Text(app.t("detail.premises").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                        ForEach(ps) { p in Text(p.name).font(.manrope(size: 15, weight: .semibold)).foregroundStyle(.white).padding(12).frame(maxWidth: .infinity, alignment: .leading).glass(16) }
                    }
                } else if failed { Text(app.t("common.error")).foregroundStyle(Theme.secondary) } else { ProgressView().tint(.white) }
            }.padding(20)
        } }
        .preferredColorScheme(.dark)
        .task {
            do { let o = try await app.api.discount(discountId, lang: app.lang); offer = o; if let p = o.premises?.first { app.viewed(premiseId: p.id, discountIds: [o.id]) } } catch { failed = true }
        }
    }
}

// MARK: Favourites and alerts inbox (IOS-7)
struct FavouritesView: View {
    @EnvironmentObject var app: AppModel
    @State private var items: [FavouriteItem] = []; @State private var loaded = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(app.t("fav.title")).font(.display(36)).foregroundStyle(.white).padding(.top, 8)
                if loaded && items.isEmpty { VStack(spacing: 8) { Image(systemName: "heart").font(.manrope(size: 40)).foregroundStyle(Theme.accent); Text(app.t("fav.empty")).font(.manrope(size: 17, weight: .semibold)).foregroundStyle(.white); Text(app.t("fav.hint")).foregroundStyle(Theme.secondary).multilineTextAlignment(.center) }.frame(maxWidth: .infinity).padding(28).glass(24, dark: true) }
                ForEach(items) { f in
                    Button { app.openOfferId = f.id } label: {
                        HStack { VStack(alignment: .leading, spacing: 3) { Text(app.lang == .pt ? f.titlePt : f.titleEn).font(.manrope(size: 16, weight: .semibold)).foregroundStyle(.white); Text(f.businessName).font(.manrope(size: 13)).foregroundStyle(Theme.secondary)
                                if let v = f.validTo { Text(app.t("detail.validUntil", ["date": String(v.prefix(10))])).font(.manrope(size: 12)).foregroundStyle(Theme.muted) } }
                            Spacer(); Text(f.status).font(.manrope(size: 11, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(f.status == "PUBLISHED" ? Theme.success.opacity(0.2) : Theme.warning.opacity(0.2))).foregroundStyle(f.status == "PUBLISHED" ? Theme.success : Theme.warning) }
                        .padding(14).glass(20)
                    }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 18).padding(.bottom, 110)
        }
        .task(id: app.favouriteIds) { items = (try? await app.api.favourites()) ?? []; loaded = true }
    }
}

struct AlertsView: View {
    @EnvironmentObject var app: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(app.t("alerts.title")).font(.display(36)).foregroundStyle(.white).padding(.top, 8)
                if app.alertLog.isEmpty { VStack(spacing: 8) { Image(systemName: "bell").font(.manrope(size: 40)).foregroundStyle(Theme.accent); Text(app.t("alerts.empty")).font(.manrope(size: 17, weight: .semibold)).foregroundStyle(.white); Text(app.t("alerts.hint")).foregroundStyle(Theme.secondary).multilineTextAlignment(.center) }.frame(maxWidth: .infinity).padding(28).glass(24, dark: true) }
                ForEach(app.alertLog) { e in
                    Button { if let id = e.discountIds.first { app.openOfferId = id } } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(e.title).font(.manrope(size: 15, weight: .semibold)).foregroundStyle(.white)
                            Text(e.suppressedReason.map { "\(app.t("alerts.suppressed")): \($0)" } ?? e.body).font(.manrope(size: 13)).foregroundStyle(e.suppressedReason == nil ? Theme.secondary : Theme.warning)
                            Text(e.date.formatted(date: .abbreviated, time: .shortened)).font(.manrope(size: 11)).foregroundStyle(Theme.muted)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(14).glass(20)
                    }.buttonStyle(.plain)
                }
            }.padding(.horizontal, 18).padding(.bottom, 110)
        }
    }
}
