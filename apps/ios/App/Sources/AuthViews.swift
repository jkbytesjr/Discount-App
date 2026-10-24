import SwiftUI
import CoreLocation
import MozCore

// MARK: Onboarding: three value screens, then permission priming (IOS-5, IOS-8)
struct OnboardingView: View {
    @EnvironmentObject var app: AppModel
    @State private var page = 0
    var body: some View {
        VStack {
            TabView(selection: $page) {
                ForEach(1...3, id: \.self) { i in
                    VStack(spacing: 18) {
                        Spacer()
                        Image(systemName: ["", "tag.fill", "location.fill", "creditcard.fill"][i]).font(.manrope(size: 64)).foregroundStyle(Theme.accent)
                        Text(app.t("onb.\(i).title")).font(.display(36)).multilineTextAlignment(.center).foregroundStyle(.white)
                        Text(app.t("onb.\(i).body")).font(.manrope(size: 16)).multilineTextAlignment(.center).foregroundStyle(Theme.secondary).padding(.horizontal, 28)
                        Spacer()
                    }.tag(i - 1).padding(24).glass(32, dark: true).padding(.horizontal, 20)
                }
                PermissionPriming().tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            HStack {
                if page < 3 { Button(app.t("common.skip")) { page = 3 }.buttonStyle(GlassButtonStyle()) }
                Spacer()
                if page < 3 { Button(app.t("common.next")) { withAnimation { page += 1 } }.buttonStyle(AccentButtonStyle()).frame(width: 160) }
            }.padding(.horizontal, 24).padding(.bottom, 24)
        }
    }
}

struct PermissionPriming: View {
    @EnvironmentObject var app: AppModel
    @State private var notifAsked = false
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 12) {
                    Image(systemName: "location.circle.fill").font(.manrope(size: 52)).foregroundStyle(Theme.accent)
                    Text(app.t("perm.location.title")).font(.display(28)).foregroundStyle(.white)
                    Text(app.t("perm.location.body")).font(.manrope(size: 15)).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
                    Button(app.t("perm.location.allow")) { app.location.requestPermission() }.buttonStyle(AccentButtonStyle())
                }.padding(22).glass(28, dark: true)
                VStack(spacing: 12) {
                    Image(systemName: "bell.badge.fill").font(.manrope(size: 44)).foregroundStyle(Theme.accent)
                    Text(app.t("perm.notif.title")).font(.display(24)).foregroundStyle(.white)
                    Text(app.t("perm.notif.body")).font(.manrope(size: 15)).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
                    Button(app.t("perm.notif.allow")) { Task { _ = await app.notifications.requestPermission(); notifAsked = true } }.buttonStyle(GlassButtonStyle())
                }.padding(22).glass(28, dark: true)
                Button(app.t("common.done")) { app.finishOnboarding() }.buttonStyle(AccentButtonStyle())
            }.padding(20)
        }
    }
}

// MARK: Sign in, register, check email, forgot password (IOS-2, IOS-3)
struct AuthFlow: View {
    enum Screen { case login, register, checkEmail(String), forgot }
    @State private var screen: Screen = .login
    var body: some View {
        switch screen {
        case .login: LoginView(go: { screen = $0 })
        case .register: RegisterView(go: { screen = $0 })
        case .checkEmail(let e): CheckEmailView(email: e, go: { screen = $0 })
        case .forgot: ForgotView(go: { screen = $0 })
        }
    }
}

struct AuthCard<Content: View>: View {
    @EnvironmentObject var app: AppModel
    var title: String; @ViewBuilder var content: Content
    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                HStack { Spacer(); Picker("", selection: $app.lang) { Text("PT").tag(Lang.pt); Text("EN").tag(Lang.en) }.pickerStyle(.segmented).frame(width: 110) }
                Image("Logo").resizable().scaledToFit().frame(width: 84, height: 84).clipShape(RoundedRectangle(cornerRadius: 20)).accessibilityHidden(true).padding(.top, 20)
                Text(title).font(.display(34)).foregroundStyle(.white).multilineTextAlignment(.center)
                VStack(spacing: 14) { content }.padding(22).glass(28)
                Text(app.t("demo.ribbon")).font(.manrope(size: 12, weight: .semibold)).foregroundStyle(Theme.warning)
            }.padding(20)
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var app: AppModel
    var go: (AuthFlow.Screen) -> Void
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error = ""
    var body: some View {
        AuthCard(title: app.t("auth.login")) {
            GlassField(title: app.t("auth.email"), text: $email, keyboard: .emailAddress)
            GlassField(title: app.t("auth.password"), text: $password, secure: true)
            if !error.isEmpty { Text(error).font(.manrope(size: 13)).foregroundStyle(Theme.danger).frame(maxWidth: .infinity, alignment: .leading).accessibilityAddTraits(.isStaticText) }
            Button(busy ? app.t("common.loading") : app.t("auth.login")) { Task { await submit() } }.buttonStyle(AccentButtonStyle(enabled: !email.isEmpty && !password.isEmpty)).disabled(busy || email.isEmpty || password.isEmpty)
            Button(app.t("auth.forgot")) { go(.forgot) }.font(.manrope(size: 14)).foregroundStyle(Theme.cyan)
            HStack(spacing: 6) { Text(app.t("auth.noAccount")).foregroundStyle(Theme.secondary); Button(app.t("auth.register")) { go(.register) }.foregroundStyle(Theme.cyan) }.font(.manrope(size: 14))
        }
    }
    private func submit() async {
        busy = true; error = ""
        do { try await app.login(email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password) } catch let e { error = app.message(for: e) }
        busy = false
    }
}

struct RegisterView: View {
    @EnvironmentObject var app: AppModel
    var go: (AuthFlow.Screen) -> Void
    @State private var first = ""
    @State private var last = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error = ""
    private var pwOK: Bool { password.count >= 8 && password.contains(where: \.isUppercase) && password.contains(where: \.isLowercase) && password.contains(where: \.isNumber) && password.contains(where: { !$0.isLetter && !$0.isNumber }) }
    var body: some View {
        AuthCard(title: app.t("auth.register")) {
            GlassField(title: app.t("auth.firstName"), text: $first, autocap: .words)
            GlassField(title: app.t("auth.lastName"), text: $last, autocap: .words)
            GlassField(title: app.t("auth.email"), text: $email, keyboard: .emailAddress)
            GlassField(title: app.t("auth.password"), text: $password, secure: true)
            Text(app.t("auth.pwRules")).font(.manrope(size: 12)).foregroundStyle(pwOK ? Theme.success : Theme.muted).frame(maxWidth: .infinity, alignment: .leading)
            if !error.isEmpty { Text(error).font(.manrope(size: 13)).foregroundStyle(Theme.danger).frame(maxWidth: .infinity, alignment: .leading) }
            Button(app.t("auth.register")) { Task { await submit() } }.buttonStyle(AccentButtonStyle(enabled: pwOK && !first.isEmpty && !last.isEmpty && !email.isEmpty)).disabled(busy || !pwOK || first.isEmpty || last.isEmpty || email.isEmpty)
            Text(app.t("auth.terms")).font(.manrope(size: 11)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
            HStack(spacing: 6) { Text(app.t("auth.haveAccount")).foregroundStyle(Theme.secondary); Button(app.t("auth.login")) { go(.login) }.foregroundStyle(Theme.cyan) }.font(.manrope(size: 14))
        }
    }
    private func submit() async {
        busy = true; error = ""
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        do { try await app.api.register(firstName: first, lastName: last, email: e, password: password, locale: app.lang == .pt ? "pt-MZ" : "en"); go(.checkEmail(e)) } catch let err { error = app.message(for: err) }
        busy = false
    }
}

struct CheckEmailView: View {
    @EnvironmentObject var app: AppModel
    var email: String; var go: (AuthFlow.Screen) -> Void
    @State private var note = ""
    var body: some View {
        AuthCard(title: app.t("auth.checkEmail")) {
            Image(systemName: "envelope.badge").font(.manrope(size: 40)).foregroundStyle(Theme.accent)
            Text(app.t("auth.checkEmailBody", ["email": email])).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
            if !note.isEmpty { Text(note).font(.manrope(size: 13)).foregroundStyle(Theme.success) }
            Button(app.t("auth.resend")) { Task { try? await app.api.resendVerification(email: email); note = app.t("auth.resent") } }.buttonStyle(GlassButtonStyle())
            Button(app.t("auth.login")) { go(.login) }.buttonStyle(AccentButtonStyle())
        }
    }
}

struct ForgotView: View {
    @EnvironmentObject var app: AppModel
    var go: (AuthFlow.Screen) -> Void
    @State private var email = ""
    @State private var note = ""
    var body: some View {
        AuthCard(title: app.t("auth.forgotTitle")) {
            GlassField(title: app.t("auth.email"), text: $email, keyboard: .emailAddress)
            if !note.isEmpty { Text(note).font(.manrope(size: 13)).foregroundStyle(Theme.success) }
            Button(app.t("auth.send")) { Task { try? await app.api.forgotPassword(email: email.lowercased()); note = app.t("auth.forgotSent") } }.buttonStyle(AccentButtonStyle(enabled: !email.isEmpty)).disabled(email.isEmpty)
            Button(app.t("auth.login")) { go(.login) }.foregroundStyle(Theme.cyan)
        }
    }
}

// MARK: Card and wallet onboarding: skippable (IOS-5)
struct CardOnboardingView: View {
    @EnvironmentObject var app: AppModel
    var body: some View {
        VStack(spacing: 14) {
            VStack(spacing: 8) {
                Text(app.t("onb.cards.title")).font(.display(32)).foregroundStyle(.white)
                Text(app.t("onb.cards.body")).font(.manrope(size: 15)).foregroundStyle(Theme.secondary).multilineTextAlignment(.center)
            }.padding(.top, 30).padding(.horizontal, 24)
            MyCardsView(embedded: true)
            HStack {
                Button(app.t("common.skip")) { finish() }.buttonStyle(GlassButtonStyle())
                Button(app.t("common.done")) { finish() }.buttonStyle(AccentButtonStyle())
            }.padding(.horizontal, 24).padding(.bottom, 20)
        }
    }
    private func finish() { UserDefaults.standard.set(true, forKey: "cardsOnboardingDone"); app.needsCardOnboarding = false }
}
