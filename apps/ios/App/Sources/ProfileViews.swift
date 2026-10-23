import SwiftUI
import MozCore

struct ProfileView: View {
    @EnvironmentObject var app: AppModel
    @State private var showCards = false
    @State private var showPrefs = false
    @State private var showDelete = false
    @State private var deletePw = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(app.t("profile.title")).font(.display(36)).foregroundStyle(.white).padding(.top, 8)
                if let u = app.user {
                    HStack(spacing: 14) {
                        Text(String(u.firstName.prefix(1) + u.lastName.prefix(1))).font(.system(size: 18, weight: .bold)).foregroundStyle(.white).frame(width: 52, height: 52).background(Theme.accent, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        VStack(alignment: .leading) { Text("\(u.firstName) \(u.lastName)").font(.system(size: 18, weight: .semibold)).foregroundStyle(.white); Text(u.email).font(.system(size: 13)).foregroundStyle(Theme.secondary) }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(24)
                }
                row("creditcard", app.t("profile.cards")) { showCards = true }
                row("bell.badge", app.t("profile.prefs")) { showPrefs = true }
                VStack(alignment: .leading, spacing: 10) {
                    Text(app.t("profile.language").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Picker("", selection: $app.lang) { Text("Português").tag(Lang.pt); Text("English").tag(Lang.en) }.pickerStyle(.segmented)
                }.padding(16).glass(22)
                VStack(alignment: .leading, spacing: 10) {
                    Text(app.t("profile.security").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Toggle(app.t("profile.faceId"), isOn: $app.lockEnabled).tint(Theme.violet).disabled(!Biometrics.available).foregroundStyle(.white)
                }.padding(16).glass(22)
                VStack(alignment: .leading, spacing: 6) {
                    Text(app.t("profile.privacy").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Text(app.t("profile.privacyNote")).font(.system(size: 13)).foregroundStyle(Theme.secondary)
                    Text("\(app.t("profile.about")): Moz Discounts \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0") · \(app.t("demo.ribbon"))").font(.system(size: 12)).foregroundStyle(Theme.muted)
                }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(22)
                Button(app.t("auth.logout")) { Task { await app.logout() } }.buttonStyle(GlassButtonStyle())
                Button(app.t("profile.delete")) { showDelete = true }.font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.danger).padding(.top, 4)
            }.padding(.horizontal, 18).padding(.bottom, 110)
        }
        .sheet(isPresented: $showCards) { ZStack { Backdrop(); VStack { HStack { Spacer(); Button(app.t("common.done")) { showCards = false }.foregroundStyle(Theme.cyan) }.padding(); MyCardsView(embedded: false) } }.preferredColorScheme(.dark) }
        .sheet(isPresented: $showPrefs) { PrefsView().preferredColorScheme(.dark) }
        .alert(app.t("profile.delete"), isPresented: $showDelete) {
            SecureField(app.t("profile.deleteConfirm"), text: $deletePw)
            Button(app.t("profile.delete"), role: .destructive) { Task { do { try await app.deleteAccount(password: deletePw) } catch { app.flash(error) } } }
            Button(app.t("common.cancel"), role: .cancel) {}
        } message: { Text(app.t("profile.deleteBody")) }
    }
    private func row(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { HStack { Image(systemName: icon).foregroundStyle(Theme.accent).frame(width: 28); Text(title).foregroundStyle(.white).font(.system(size: 16, weight: .semibold)); Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.muted) }.padding(16).glass(22) }.buttonStyle(.plain)
    }
}

// MARK: My cards and wallets: bank, then type, then card grid (IOS-5)
struct MyCardsView: View {
    @EnvironmentObject var app: AppModel
    var embedded: Bool
    @State private var adding = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if !embedded { Text(app.t("cards.title")).font(.display(32)).foregroundStyle(.white) }
                Text(app.t("cards.never")).font(.system(size: 12)).foregroundStyle(Theme.muted)
                if app.cards.isEmpty { Text(app.t("cards.empty")).foregroundStyle(Theme.secondary) }
                ForEach(app.cards) { c in
                    HStack { VStack(alignment: .leading, spacing: 2) { Text(c.nickname ?? c.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white); Text("\(c.issuerName) · \(app.t("type.\(c.cardType)")) · \(c.segment)").font(.system(size: 12)).foregroundStyle(Theme.secondary) }
                        Spacer(); Button(app.t("common.remove")) { Task { await app.removeCard(c.id) } }.font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.danger) }
                    .padding(14).glass(20)
                }
                Button(app.t("cards.add")) { adding = true }.buttonStyle(AccentButtonStyle())
                Text(app.t("profile.cards").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted).padding(.top, 6)
                if app.wallets.isEmpty { Text(app.t("cards.noWallets")).foregroundStyle(Theme.secondary) }
                ForEach(app.wallets) { w in
                    HStack { Text(w.name).font(.system(size: 16, weight: .semibold)).foregroundStyle(.white); Spacer(); Button(app.t("common.remove")) { Task { await app.removeWallet(w.walletProviderId) } }.font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.danger) }.padding(14).glass(20)
                }
                Menu {
                    ForEach(app.catalogue.wallets.filter { w in !app.wallets.contains { $0.walletProviderId == w.id } }) { w in Button(w.name) { Task { await app.addWallet(w.id) } } }
                } label: { Text(app.t("cards.addWallet")).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 48).glass(14) }
            }.padding(.horizontal, 18).padding(.bottom, embedded ? 8 : 110)
        }
        .sheet(isPresented: $adding) { AddCardFlow().preferredColorScheme(.dark) }
    }
}

struct AddCardFlow: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var issuer: Issuer?; @State private var type: String?; @State private var nickname = ""
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text(app.t("cards.add")).font(.display(30)).foregroundStyle(.white); Spacer(); Button(app.t("common.cancel")) { dismiss() }.foregroundStyle(Theme.cyan) }
                step(app.t("cards.bank"))
                ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(banks) { b in Chip(title: b.shortName, selected: issuer == b) { issuer = b; type = nil } } } }
                if let i = issuer {
                    step(app.t("cards.type"))
                    HStack { ForEach(types(i), id: \.self) { t in Chip(title: app.t("type.\(t)"), selected: type == t) { type = t } } }
                }
                if let i = issuer, let t = type {
                    step(app.t("cards.product"))
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                        ForEach(app.catalogue.products.filter { $0.issuerId == i.id && $0.cardType == t }) { p in
                            let held = app.cards.contains { $0.cardProductId == p.id }
                            Button { Task { await app.addCard(p.id, nickname: nickname.isEmpty ? nil : nickname); dismiss() } } label: {
                                VStack(alignment: .leading, spacing: 8) { RoundedRectangle(cornerRadius: 10).fill(Theme.accent).frame(height: 70).overlay(alignment: .bottomTrailing) { Image(systemName: "creditcard").foregroundStyle(.white.opacity(0.8)).padding(8) }
                                    Text(p.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white).lineLimit(2).multilineTextAlignment(.leading); if held { Text("✓").foregroundStyle(Theme.success) } }
                                .padding(10).glass(16)
                            }.buttonStyle(.plain).disabled(held)
                        }
                    }
                    GlassField(title: app.t("cards.nickname"), text: $nickname, autocap: .sentences)
                }
            }.padding(20)
        } }
    }
    private var banks: [Issuer] { let ids = Set(app.catalogue.products.map(\.issuerId)); return app.catalogue.issuers.filter { ids.contains($0.id) } }
    private func types(_ i: Issuer) -> [String] { Array(Set(app.catalogue.products.filter { $0.issuerId == i.id }.map(\.cardType))).sorted() }
    private func step(_ s: String) -> some View { Text(s.uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted) }
}

struct PrefsView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var p = Prefs(); @State private var quiet = false
    @State private var from = Calendar.current.date(from: DateComponents(hour: 22))!
    @State private var to = Calendar.current.date(from: DateComponents(hour: 7))!
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text(app.t("profile.prefs")).font(.display(30)).foregroundStyle(.white); Spacer(); Button(app.t("common.cancel")) { dismiss() }.foregroundStyle(Theme.cyan) }
                VStack(alignment: .leading, spacing: 12) {
                    Toggle(app.t("prefs.alertsOn"), isOn: $p.alertsEnabled).tint(Theme.violet).foregroundStyle(.white)
                    Text(app.t("prefs.mode").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    ForEach(AlertMode.allCases, id: \.self) { m in Chip(title: app.t("prefs.mode.\(m.rawValue)"), selected: p.mode == m) { p.mode = m } }
                    if p.mode == .PERSONALISED_PLUS_GENERAL {
                        Text(app.t("prefs.extraBanks").uppercased()).font(.system(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                        ScrollView(.horizontal, showsIndicators: false) { HStack { ForEach(app.catalogue.issuers) { i in Chip(title: i.shortName, selected: p.generalIssuers.contains(i.id)) { if let n = p.generalIssuers.firstIndex(of: i.id) { p.generalIssuers.remove(at: n) } else { p.generalIssuers.append(i.id) } } } } }
                    }
                }.padding(16).glass(22)
                VStack(alignment: .leading, spacing: 10) {
                    Toggle("\(app.t("prefs.quiet")): \(app.t("prefs.quietOn"))", isOn: $quiet).tint(Theme.violet).foregroundStyle(.white)
                    if quiet {
                        DatePicker(app.t("prefs.from"), selection: $from, displayedComponents: .hourAndMinute).foregroundStyle(.white)
                        DatePicker(app.t("prefs.to"), selection: $to, displayedComponents: .hourAndMinute).foregroundStyle(.white)
                    }
                }.padding(16).glass(22)
                Button(app.t("common.save")) { Task { var q = p; q.quietFrom = quiet ? hhmm(from) : nil; q.quietTo = quiet ? hhmm(to) : nil; await app.save(prefs: q); dismiss() } }.buttonStyle(AccentButtonStyle())
            }.padding(20)
        } }
        .onAppear { p = app.prefs; quiet = p.quietFrom != nil && p.quietTo != nil; if let f = p.quietFrom, let d = date(f) { from = d }; if let t = p.quietTo, let d = date(t) { to = d } }
    }
    private func hhmm(_ d: Date) -> String { let c = Calendar.current.dateComponents([.hour, .minute], from: d); return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0) }
    private func date(_ s: String) -> Date? { let m = toMinutes(s); return Calendar.current.date(from: DateComponents(hour: m / 60, minute: m % 60)) }
}
