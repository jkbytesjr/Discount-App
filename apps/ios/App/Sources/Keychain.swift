import Foundation
import Security
import MozCore

/// Refresh and access tokens live in the Keychain, never in UserDefaults or logs (IOS-2).
final class KeychainTokenStore: TokenStore, @unchecked Sendable {
    private let service = "mz.mozdiscounts.app", account = "tokens"
    func load() -> Tokens? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return try? JSONDecoder().decode(Tokens.self, from: d)
    }
    func save(_ t: Tokens?) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        guard let t, let d = try? JSONEncoder().encode(t) else { return }
        var add = base; add[kSecValueData as String] = d; add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
