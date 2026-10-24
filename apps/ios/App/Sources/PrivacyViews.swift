import SwiftUI

/// In-app copy of the App Store privacy label (same rows as the web /privacy#labels page and docs/app-store-submission.md).
struct PrivacyLabelView: View {
    @EnvironmentObject var app: AppModel
    @Environment(\.dismiss) private var dismiss
    private let rows: [(String, String, String, String, String)] = [
        ("Nome", "Name", "Nome e apelido da conta", "Account first and last name", "person"),
        ("Email", "Email address", "Sessão, confirmação e avisos de segurança", "Sign-in, confirmation and security notices", "envelope"),
        ("Telefone (opcional)", "Phone number (optional)", "Campo do perfil", "Profile field", "phone"),
        ("Localização aproximada", "Coarse location", "~100 m nos alertas; a localização exata fica no telemóvel", "~100 m in alerts; precise location stays on the phone", "location"),
        ("Identificador de utilizador", "User ID", "ID interno da conta", "Internal account id", "number"),
        ("Identificador do dispositivo", "Device ID", "Token de notificações push", "Push-notification token", "iphone"),
        ("Conteúdo do utilizador", "User content", "Favoritos e produtos de cartão/carteira (nunca números)", "Favourites and card/wallet products (never numbers)", "heart"),
        ("Interação com o produto", "Product interaction", "Histórico de alertas", "Alert history", "bell"),
        ("Outros dados", "Other data", "Preferências de alertas", "Alert preferences", "slider.horizontal.3"),
    ]
    var body: some View {
        ZStack { Backdrop(); ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text(app.t("privacy.labelTitle")).font(.display(30)).foregroundStyle(.white); Spacer(); Button(app.t("common.done")) { dismiss() }.foregroundStyle(Theme.cyan) }
                Text(app.t("privacy.labelIntro")).font(.manrope(size: 14)).foregroundStyle(Theme.secondary)
                ForEach(rows, id: \.0) { r in
                    HStack(spacing: 12) {
                        Image(systemName: r.4).font(.system(size: 18, weight: .semibold)).foregroundStyle(.white).frame(width: 40, height: 40).background(Theme.accent, in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.lang == .pt ? r.0 : r.1).font(.manrope(size: 15, weight: .semibold)).foregroundStyle(.white)
                            Text(app.lang == .pt ? r.2 : r.3).font(.manrope(size: 12)).foregroundStyle(Theme.secondary)
                        }
                        Spacer()
                    }.padding(14).glass(18).accessibilityElement(children: .combine)
                }
                Text(app.t("privacy.notCollected")).font(.manrope(size: 13)).foregroundStyle(Theme.secondary)
                Text(app.t("privacy.noTracking")).font(.manrope(size: 14, weight: .bold)).foregroundStyle(Theme.success)
                Link(app.t("profile.privacyPolicy"), destination: URL(string: AppModel.privacyPolicyURL)!).font(.manrope(size: 14, weight: .semibold)).foregroundStyle(Theme.cyan)
            }.padding(20)
        } }
    }
}
