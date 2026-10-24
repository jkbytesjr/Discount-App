import SwiftUI

// docs/DESIGN-GLASSMORPHISM.md for SwiftUI: dark base, vivid credit-card backdrop, frosted glass panels, gradient accent, liquid selection pill.
extension Color {
    init(hex: UInt32, opacity: Double = 1) { self.init(.sRGB, red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: opacity) }
}

enum Theme {
    static let base = Color(hex: 0x07060F)
    static let magenta = Color(hex: 0xFF2D9B), violet = Color(hex: 0x7B3CFF), cyan = Color(hex: 0x19D3FF), orange = Color(hex: 0xFF8A3D)
    static let success = Color(hex: 0x3DFFB0), warning = Color(hex: 0xFFC83D), danger = Color(hex: 0xFF4D6D)
    static let accent = LinearGradient(colors: [magenta, violet, cyan], startPoint: .topLeading, endPoint: .bottomTrailing)
    static let glassTint = Color(hex: 0x0A0818, opacity: 0.28)
    static let glassDark = Color(hex: 0x0A0818, opacity: 0.5)
    static let secondary = Color.white.opacity(0.76), muted = Color.white.opacity(0.55)
    static let border = LinearGradient(colors: [Color.white.opacity(0.35), Color.white.opacity(0.12)], startPoint: .top, endPoint: .bottom)
}

private struct VividCard: View {
    var colors: [Color]; var width: CGFloat; var rotation: Double; var blur: CGFloat
    var body: some View {
        RoundedRectangle(cornerRadius: 30, style: .continuous)
            .fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(alignment: .topLeading) { Circle().fill(Color.white.opacity(0.45)).frame(width: width * 0.5).blur(radius: 30).offset(x: -width * 0.1, y: -width * 0.1) }
            .overlay(alignment: .leading) { RoundedRectangle(cornerRadius: 8).fill(LinearGradient(colors: [Color(hex: 0xFFE9A0), Color(hex: 0xFF9D4D)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: width * 0.15, height: width * 0.115).padding(.leading, width * 0.07).offset(y: -width * 0.04) }
            .overlay(alignment: .bottomTrailing) { ZStack { Circle().fill(Color.white.opacity(0.26)).offset(x: -width * 0.06); Circle().fill(Color.white.opacity(0.4)) }.frame(width: width * 0.17, height: width * 0.17).padding(width * 0.07) }
            .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).stroke(Color.white.opacity(0.4), lineWidth: 1))
            .frame(width: width, height: width / 1.586)
            .blur(radius: blur).rotationEffect(.degrees(rotation)).opacity(0.95)
    }
}

/// Signature backdrop: soft colour blobs and three vivid cards, sharp enough to read as cards through the glass.
struct Backdrop: View {
    var body: some View {
        GeometryReader { g in
            ZStack {
                Theme.base
                Circle().fill(Theme.magenta).frame(width: 340).blur(radius: 70).opacity(0.65).offset(x: -g.size.width * 0.4, y: -g.size.height * 0.4)
                Circle().fill(Theme.violet).frame(width: 340).blur(radius: 70).opacity(0.65).offset(x: g.size.width * 0.45, y: g.size.height * 0.05)
                Circle().fill(Theme.cyan).frame(width: 320).blur(radius: 70).opacity(0.5).offset(x: -g.size.width * 0.1, y: g.size.height * 0.45)
                VividCard(colors: [Theme.magenta, Color(hex: 0xFF6A5C), Theme.orange], width: 420, rotation: -14, blur: 5).offset(x: -g.size.width * 0.25, y: -g.size.height * 0.28)
                VividCard(colors: [Theme.cyan, Color(hex: 0x2F6BFF), Theme.violet], width: 400, rotation: 12, blur: 3).offset(x: g.size.width * 0.3, y: g.size.height * 0.1)
                VividCard(colors: [Theme.violet, Color(hex: 0xA23BD8), Theme.magenta], width: 380, rotation: -7, blur: 7).offset(x: -g.size.width * 0.1, y: g.size.height * 0.42)
                RadialGradient(colors: [.clear, Color.black.opacity(0.35)], center: .center, startRadius: g.size.width * 0.4, endRadius: g.size.height * 0.75)
            }
            .frame(width: g.size.width, height: g.size.height).clipped()
        }
        .ignoresSafeArea()
    }
}

struct Glass: ViewModifier {
    var radius: CGFloat = 24; var dark = false
    func body(content: Content) -> some View {
        content.background {
            RoundedRectangle(cornerRadius: radius, style: .continuous).fill(dark ? Theme.glassDark : Theme.glassTint)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(LinearGradient(colors: [.white.opacity(0.14), .white.opacity(0.02)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
        }
    }
}
extension View { func glass(_ radius: CGFloat = 24, dark: Bool = false) -> some View { modifier(Glass(radius: radius, dark: dark)) } }

struct AccentButtonStyle: ButtonStyle {
    var enabled = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.manrope(size: 16, weight: .semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 48).background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: Theme.violet.opacity(0.45), radius: 12, y: 6).opacity(enabled ? 1 : 0.5)
            .scaleEffect(configuration.isPressed ? 0.96 : 1).animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
struct GlassButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.manrope(size: 15, weight: .semibold)).foregroundStyle(.white).frame(minHeight: 44).padding(.horizontal, 16)
            .glass(14).scaleEffect(configuration.isPressed ? 0.95 : 1).animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

extension Font {
    /// Light, wide Montserrat for titles; Manrope for everything functional (bundled variable fonts, OFL).
    static func display(_ size: CGFloat, weight: Font.Weight = .light) -> Font { .custom("Montserrat", size: size).weight(weight) }
    static func manrope(size: CGFloat, weight: Font.Weight = .regular) -> Font { .custom("Manrope", size: size).weight(weight) }
}

struct GlassField: View {
    var title: String; @Binding var text: String; var secure = false; var keyboard: UIKeyboardType = .default; var autocap: TextInputAutocapitalization = .never
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased()).font(.manrope(size: 11, weight: .bold)).tracking(1.6).foregroundStyle(Theme.muted)
            Group { if secure { SecureField("", text: $text).textContentType(.password) } else { TextField("", text: $text).keyboardType(keyboard).textInputAutocapitalization(autocap).autocorrectionDisabled() } }
                .padding(.horizontal, 14).frame(minHeight: 48).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.18)))
                .foregroundStyle(.white)
        }
    }
}

struct Chip: View {
    var title: String; var selected: Bool; var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.manrope(size: 14, weight: .semibold)).foregroundStyle(.white).padding(.horizontal, 14).frame(minHeight: 40)
                .background(Capsule().fill(selected ? AnyShapeStyle(LinearGradient(colors: [Theme.magenta.opacity(0.5), Theme.violet.opacity(0.55)], startPoint: .leading, endPoint: .trailing)) : AnyShapeStyle(Color.white.opacity(0.08))))
                .overlay(Capsule().stroke(Color.white.opacity(selected ? 0.5 : 0.18)))
        }
        .buttonStyle(.plain).accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Bottom tab bar with the liquid glass pill: one capsule travels between items with a stretch-and-settle spring.
struct LiquidTabBar<Tab: Hashable>: View {
    var tabs: [(Tab, String, String)]; @Binding var selection: Tab
    @Namespace private var ns
    var body: some View {
        HStack(spacing: 4) {
            ForEach(tabs, id: \.0) { tab in
                Button { withAnimation(.spring(response: 0.55, dampingFraction: 0.68)) { selection = tab.0 } } label: {
                    VStack(spacing: 2) { Image(systemName: tab.2).font(.manrope(size: 18, weight: .medium)); Text(tab.1).font(.manrope(size: 11, weight: .semibold)) }
                        .foregroundStyle(selection == tab.0 ? .white : Theme.secondary).frame(maxWidth: .infinity, minHeight: 54)
                        .background { if selection == tab.0 { Capsule().fill(LinearGradient(colors: [.white.opacity(0.3), .white.opacity(0.09), Theme.magenta.opacity(0.12)], startPoint: .top, endPoint: .bottom))
                            .overlay(Capsule().stroke(Color.white.opacity(0.42))).shadow(color: Theme.violet.opacity(0.4), radius: 10, y: 4).matchedGeometryEffect(id: "pill", in: ns) } }
                }
                .buttonStyle(.plain).accessibilityLabel(tab.1).accessibilityAddTraits(selection == tab.0 ? .isSelected : [])
            }
        }
        .padding(6).glass(34)
    }
}
