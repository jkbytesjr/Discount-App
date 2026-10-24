import SwiftUI

/// Bank brand colours for card art. Matched on the issuer or wallet name, so new catalogue entries still get a sensible colour.
enum BrandStyle {
    struct Look { var colors: [Color]; var isBlack = false }

    private static let premiumSegments = ["wealth", "prestige", "premium", "platinum", "infinite", "private", "black"]
    private static let brands: [(keys: [String], hex: [UInt32])] = [
        // Colours follow the bank reference sheet (docs/design/mz-banks-colours.jpg).
        (["absa"], [0xC4224F, 0x7A1236]),                      // Absa crimson
        (["standard bank", "standard"], [0x1D4FB8, 0x0A2A78]), // Standard Bank blue
        (["nedbank"], [0x1F8F4E, 0x0B4D2A]),                   // Nedbank green
        (["fnb", "first national"], [0x00A3A1, 0x2F9F9B, 0xF47B20]), // FNB teal to orange
        (["moza"], [0xF2C200, 0xD31F26, 0x0B0B0B]),            // Moza yellow, red, black
        (["ecobank"], [0x0A8CAB, 0x03556B]),                   // Ecobank teal-blue
        (["uba", "united bank"], [0xE3262B, 0xF2701F]),        // UBA red to orange
        (["first capital"], [0x7DC242, 0x3F8F2A]),             // First Capital green
        (["banco mais", "mais"], [0x1C6FD6, 0x2FA55B]),        // Banco Mais blue to green
        (["letshego", "letsiego"], [0x7A3FB5, 0x3D1E78]),      // Letshego purple
        (["vista"], [0xE5173F, 0xB30F2E]),                     // Vista Bank red
        (["m-pesa", "mpesa", "vodacom"], [0xE60000, 0xA00000]), // M-Pesa / Vodacom red
        (["emola", "movitel"], [0xFF8C1A, 0xD1590A]),          // Emola orange
        (["bci"], [0xF7692C, 0xD94A12]),                       // BCI orange
        (["millennium", "bim"], [0xDB1F7F, 0x9C1160]),         // Millennium bim magenta
        (["mkesh", "tmcel"], [0xFFD21F, 0xC79A00]),
    ]

    static func look(for name: String, segment: String? = nil) -> Look {
        if let s = segment?.lowercased(), premiumSegments.contains(where: { s.contains($0) }) {
            return Look(colors: [Color(hex: 0x2B2B33), Color(hex: 0x050507)], isBlack: true)
        }
        let n = name.lowercased()
        if let b = brands.first(where: { $0.keys.contains { n.contains($0) } }) { return Look(colors: b.hex.map { Color(hex: $0) }) }
        return Look(colors: [Color(hex: 0x6B4CFF), Color(hex: 0x2A1A8F)])
    }
}

/// A payment-card look-alike. Never shows a card number: the app does not store one (see CLAUDE.md).
struct BankCardView: View {
    var bank: String; var product: String; var detail: String; var segment: String? = nil
    var compact = false; var onRemove: (() -> Void)? = nil; var removeLabel = ""
    var body: some View {
        let look = BrandStyle.look(for: bank, segment: segment)
        let h: CGFloat = compact ? 92 : 190
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: compact ? 14 : 24, style: .continuous)
                .fill(LinearGradient(colors: look.colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(alignment: .topTrailing) { Circle().fill(.white.opacity(look.isBlack ? 0.08 : 0.22)).frame(width: h * 1.3).blur(radius: 26).offset(x: h * 0.3, y: -h * 0.5) }
                .overlay(RoundedRectangle(cornerRadius: compact ? 14 : 24, style: .continuous).stroke(look.isBlack ? Color(hex: 0xD4AF37, opacity: 0.55) : .white.opacity(0.35), lineWidth: 1))
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    Text(bank.uppercased()).font(.manrope(size: compact ? 12 : 17, weight: .bold)).tracking(1.2).foregroundStyle(.white).lineLimit(1)
                    Spacer()
                    if let onRemove { Button(action: onRemove) { Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(.white.opacity(0.85)) }.accessibilityLabel(removeLabel) }
                }
                Spacer(minLength: 0)
                if !compact { RoundedRectangle(cornerRadius: 6).fill(LinearGradient(colors: [Color(hex: 0xFFE9A0), Color(hex: 0xE0A040)], startPoint: .topLeading, endPoint: .bottomTrailing)).frame(width: 40, height: 30).padding(.bottom, 10) }
                Text(product).font(.manrope(size: compact ? 12 : 18, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                Text(detail).font(.manrope(size: compact ? 10 : 12, weight: .medium)).foregroundStyle(.white.opacity(0.78)).lineLimit(1)
            }.padding(compact ? 10 : 18)
        }
        .frame(height: h).shadow(color: .black.opacity(0.5), radius: 14, y: 8)
        .accessibilityElement(children: onRemove == nil ? .combine : .contain)
    }
}
