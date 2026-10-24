import Foundation

/// Mozambican numbers are stored as +258 followed by 9 digits (the API rejects anything else).
public enum Phone {
    /// Accepts "84 123 4567", "841234567", "258841234567" and "+258 84 123 4567". Returns nil when it cannot be a valid number.
    public static func normalise(_ raw: String) -> String? {
        var s = raw.filter { $0.isNumber || $0 == "+" }
        if s.hasPrefix("00258") { s = "+" + s.dropFirst(2) }
        if s.hasPrefix("258") && !s.hasPrefix("+") { s = "+" + s }
        if !s.hasPrefix("+") { s = "+258" + s }
        let digits = s.dropFirst().filter(\.isNumber)
        guard s.hasPrefix("+258"), digits.count == 12, !s.dropFirst().contains("+") else { return nil }
        return "+" + digits
    }
}
