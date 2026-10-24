import SwiftUI
import MozCore

@main
struct MozDiscountsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var app = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .preferredColorScheme(.dark)
                .task {
                    delegate.onPushToken = { app.setPushToken($0) }
                    await app.bootstrap()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .background, app.lockEnabled, app.phase == .signedIn { app.locked = true }
                    if phase == .active { Task { await app.flushQueue() } }
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var app: AppModel
    var body: some View {
        ZStack {
            Backdrop()
            switch app.phase {
            case .launching: SplashView()
            case .onboarding: OnboardingView()
            case .signedOut: AuthFlow()
            case .signedIn:
                if app.needsCardOnboarding { CardOnboardingView() } else { MainTabs() }
            }
            if app.locked && app.phase == .signedIn { LockView() }
            if let b = app.banner {
                VStack { Spacer(); Text(b).font(.manrope(size: 14, weight: .semibold)).foregroundStyle(.white).padding(14).glass(16, dark: true).padding(.bottom, 90).padding(.horizontal, 16) }
                    .transition(.move(edge: .bottom).combined(with: .opacity)).accessibilityAddTraits(.updatesFrequently)
            }
        }
        .animation(.easeOut(duration: 0.25), value: app.banner)
        .onReceive(NotificationCenter.default.publisher(for: .mozOpenOffer)) { _ in }
    }
}

struct SplashView: View {
    @EnvironmentObject var app: AppModel
    var body: some View {
        VStack(spacing: 14) {
            Image("Logo").resizable().scaledToFit().frame(width: 112, height: 112).clipShape(RoundedRectangle(cornerRadius: 26)).accessibilityHidden(true)
            Text(app.t("app.name")).font(.display(34)).foregroundStyle(.white)
            ProgressView().tint(.white)
        }
    }
}

struct LockView: View {
    @EnvironmentObject var app: AppModel
    var body: some View {
        ZStack {
            Color.black.opacity(0.85).ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "faceid").font(.manrope(size: 56)).foregroundStyle(Theme.accent)
                Text(app.t("lock.title")).font(.display(30)).foregroundStyle(.white)
                Button(app.t("lock.button")) { Task { await unlock() } }.buttonStyle(AccentButtonStyle()).frame(maxWidth: 260)
            }
        }
        .task { await unlock() }
    }
    private func unlock() async { if await Biometrics.authenticate(reason: app.t("lock.reason")) { app.locked = false } }
}
