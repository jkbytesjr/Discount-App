import SwiftUI
import MozCore

struct ProfileView: View {
    @EnvironmentObject var app: AppModel
    @State private var showEdit = false
    @State private var showPassword = false
    @State private var exportURL: URL?
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
                        Text(String(u.firstName.prefix(1) + u.lastName.prefix(1))).font(.manrope(size: 18, weight: .bold)).foregroundStyle(.white).frame(width: 52, height: 52).background(Theme.accent, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        VStack(alignment: .leading) { Text("\(u.firstName) \(u.lastName)").font(.manrope(size: 18, weight: .semibold)).foregroundStyle(.white); Text(u.email).font(.manrope(size: 13)).foregroundStyle(Theme.secondary) }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(24)
                }
                row("person.crop.circle", app.t("profile.edit")) { showEdit = true }
                row("creditcard", app.t("profile.cards")) { showCards = true }
                row("bell.badge", app.t("profile.prefs")) { showPrefs = true }
                VStack(alignment: .leading, spacing: 10) {
                    Text(app.t("profile.language").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Picker("", selection: $app.lang) { Text("Português").tag(Lang.pt); Text("English").tag(Lang.en) }.pickerStyle(.segmented)
                }.padding(16).glass(22)
                VStack(alignment: .leading, spacing: 10) {
                    Text(app.t("profile.security").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Toggle(app.t("profile.faceId"), isOn: $app.lockEnabled).tint(Theme.violet).disabled(!Biometrics.available).foregroundStyle(.white)
                }.padding(16).glass(22)
                VStack(alignment: .leading, spacing: 6) {
                    Text(app.t("profile.privacy").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    Text(app.t("profile.privacyNote")).font(.manrope(size: 13)).foregroundStyle(Theme.secondary)
                    Text("\(app.t("profile.about")): Moz Discounts \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0") · \(app.t("demo.ribbon"))").font(.manrope(size: 12)).foregroundStyle(Theme.muted)
                }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glass(22)
                row("key", app.t("profile.changePassword")) { showPassword = true }
                row("square.and.arrow.down", app.t("profile.exportData")) { Task { await exportData() } }
                Button(app.t("auth.logout")) { Task { await app.logout() } }.buttonStyle(GlassButtonStyle())
                Button(app.t("profile.delete")) { showDelete = true }.font(.manrope(size: 14, weight: .semibold)).foregroundStyle(Theme.danger).padding(.top, 4)
            }.padding(.horizontal, 18).padding(.bottom, 110)
        }
        .sheet(isPresented: $showCards) { ZStack { Backdrop(); VStack { HStack { Spacer(); Button(app.t("common.done")) { showCards = false }.foregroundStyle(Theme.cyan) }.padding(); MyCardsView(embedded: false) } }.bannerOverlay().preferredColorScheme(.dark) }
        .sheet(isPresented: $showEdit) { EditProfileView().preferredColorScheme(.dark) }
        .sheet(isPresented: $showPassword) { ChangePasswordView().bannerOverlay().preferredColorScheme(.dark) }
        .sheet(item: Binding(get: { exportURL.map(URLBox.init) }, set: { exportURL = $0?.url })) { box in ShareSheet(url: box.url) }
        .sheet(isPresented: $showPrefs) { PrefsView().bannerOverlay().preferredColorScheme(.dark) }
        .alert(app.t("profile.delete"), isPresented: $showDelete) {
            SecureField(app.t("profile.deleteConfirm"), text: $deletePw)
            Button(app.t("profile.delete"), role: .destructive) { Task { do { try await app.deleteAccount(password: deletePw) } catch { app.flash(error) } } }
            Button(app.t("common.cancel"), role: .cancel) {}
        } message: { Text(app.t("profile.deleteBody")) }
    }
    private func exportData() async {
        do {
            let data = try await app.api.exportMyData()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("my-data.json")
            try data.write(to: url, options: .atomic); exportURL = url
        } catch { app.flash(error) }
    }
    private func row(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) { HStack { Image(systemName: icon).foregroundStyle(Theme.accent).frame(width: 28); Text(title).foregroundStyle(.white).font(.manrope(size: 16, weight: .semibold)); Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.muted) }.padding(16).glass(22) }.buttonStyle(.plain)
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
                Text(app.t("cards.never")).font(.manrope(size: 12)).foregroundStyle(Theme.muted)
                if app.cards.isEmpty { Text(app.t("cards.empty")).foregroundStyle(Theme.secondary) }
                VStack(spacing: -112) {
                    ForEach(app.cards) { c in
                        BankCardView(bank: c.issuerName, product: c.nickname ?? c.name, detail: "\(app.t("type.\(c.cardType)")) · \(c.segment)", segment: c.segment,
                                     onRemove: { Task { await app.removeCard(c.id) } }, removeLabel: "\(app.t("common.remove")): \(c.nickname ?? c.name)")
                    }
                }.padding(.bottom, app.cards.isEmpty ? 0 : 0)
                Button(app.t("cards.add")) { adding = true }.buttonStyle(AccentButtonStyle())
                Text(app.t("profile.cards").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted).padding(.top, 6)
                if app.wallets.isEmpty { Text(app.t("cards.noWallets")).foregroundStyle(Theme.secondary) }
                ForEach(app.wallets) { w in
                    BankCardView(bank: w.name, product: w.name, detail: "", compact: true, onRemove: { Task { await app.removeWallet(w.walletProviderId) } }, removeLabel: "\(app.t("common.remove")): \(w.name)")
                }
                if app.catalogue.wallets.isEmpty {
                    CatalogueRetry()
                } else {
                    let available = app.catalogue.wallets.filter { w in !app.wallets.contains { $0.walletProviderId == w.id } }
                    Text(available.isEmpty ? app.t("cards.allWalletsAdded") : app.t("cards.addWalletHint")).font(.manrope(size: 12)).foregroundStyle(Theme.muted)
                    ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach(available) { w in Chip(title: "+ " + w.name, selected: false) { Task { await app.addWallet(w.id) } } } } }
                }
            }.padding(.horizontal, 18).padding(.bottom, embedded ? 8 : 110)
        }
        .task { await app.ensureCatalogue() }
        .sheet(isPresented: $adding) { AddCardFlow().bannerOverlay().preferredColorScheme(.dark) }
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
                if banks.isEmpty { CatalogueRetry() }
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
                            Button { Task { if await app.addCard(p.id, nickname: nickname.isEmpty ? nil : nickname) { dismiss() } } } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    BankCardView(bank: i.shortName, product: p.name, detail: p.segment, segment: p.segment, compact: true)
                                    if held { Text("✓").foregroundStyle(Theme.success) } }
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
    private func step(_ s: String) -> some View { Text(s.uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted) }
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
                    Text(app.t("prefs.mode").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
                    ForEach(AlertMode.allCases, id: \.self) { m in Chip(title: app.t("prefs.mode.\(m.rawValue)"), selected: p.mode == m) { p.mode = m } }
                    if p.mode == .PERSONALISED_PLUS_GENERAL {
                        Text(app.t("prefs.extraBanks").uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
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

struct URLBox: Identifiable { var url: URL; var id: String { url.absoluteString } }
struct ShareSheet: UIViewControllerRepresentable {
    var url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

struct EditProfileView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) var dismiss
    @State var first = ""
    @State var last = ""
    @State var phone = ""
    @State var error = ""
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text(app.t("profile.edit")).font(.display(30)).foregroundStyle(.white); Spacer(); Button(app.t("common.cancel")) { dismiss() }.foregroundStyle(Theme.cyan) }
                VStack(spacing: 14) {
                    GlassField(title: app.t("auth.firstName"), text: $first, autocap: .words)
                    GlassField(title: app.t("auth.lastName"), text: $last, autocap: .words)
                    GlassField(title: app.t("profile.phone"), text: $phone, keyboard: .phonePad)
                    if !error.isEmpty { Text(error).font(.manrope(size: 13)).foregroundStyle(Theme.danger) }
                }.padding(18).glass(24)
                Button(app.t("common.save")) { Task { await save() } }.buttonStyle(AccentButtonStyle(enabled: !first.trimmingCharacters(in: .whitespaces).isEmpty && !last.trimmingCharacters(in: .whitespaces).isEmpty)).disabled(first.trimmingCharacters(in: .whitespaces).isEmpty || last.trimmingCharacters(in: .whitespaces).isEmpty)
            }.padding(20)
        } }
        .onAppear { first = app.user?.firstName ?? ""; last = app.user?.lastName ?? ""; phone = app.user?.phone ?? "" }
        .bannerOverlay()
    }
}

extension EditProfileView {
    func save() async {
        error = ""
        var normalised: String? = nil
        if !phone.trimmingCharacters(in: .whitespaces).isEmpty {
            guard let n = Phone.normalise(phone) else { error = app.t("profile.phoneInvalid"); return }
            normalised = n
        }
        do { try await app.updateProfile(firstName: first.trimmingCharacters(in: .whitespaces), lastName: last.trimmingCharacters(in: .whitespaces), phone: normalised); dismiss() }
        catch let e { error = app.message(for: e) }
    }
}

struct ChangePasswordView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var new = ""
    @State private var error = ""
    @State private var done = false
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text(app.t("profile.changePassword")).font(.display(28)).foregroundStyle(.white); Spacer(); Button(app.t("common.cancel")) { dismiss() }.foregroundStyle(Theme.cyan) }
                VStack(spacing: 14) {
                    GlassField(title: app.t("profile.currentPassword"), text: $current, secure: true)
                    GlassField(title: app.t("profile.newPassword"), text: $new, secure: true)
                    Text(app.t("auth.pwRules")).font(.manrope(size: 12)).foregroundStyle(Theme.muted)
                    if !error.isEmpty { Text(error).font(.manrope(size: 13)).foregroundStyle(Theme.danger) }
                    if done { Text(app.t("profile.saved")).font(.manrope(size: 13)).foregroundStyle(Theme.success) }
                }.padding(18).glass(24)
                Button(app.t("common.save")) { Task { do { try await app.api.changePassword(current: current, new: new); done = true; error = ""; current = ""; new = "" } catch let e { error = app.message(for: e) } } }.buttonStyle(AccentButtonStyle(enabled: !current.isEmpty && !new.isEmpty)).disabled(current.isEmpty || new.isEmpty)
            }.padding(20)
        } }
    }
}

struct CatalogueRetry: View {
    @EnvironmentObject var app: AppModel
    @State private var busy = false
    var body: some View {
        VStack(spacing: 10) {
            Text(app.t("cards.catalogueFailed")).font(.manrope(size: 13)).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
            Button(busy ? app.t("common.loading") : app.t("common.retry")) { Task { busy = true; await app.ensureCatalogue(); busy = false } }.buttonStyle(GlassButtonStyle())
        }.frame(maxWidth: .infinity).padding(14).glass(18, dark: true).task { await app.ensureCatalogue() }
    }
}
