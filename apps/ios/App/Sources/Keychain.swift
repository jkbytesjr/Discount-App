import Foundation
import Security
import LocalAuthentication
import MozCore

/// Tokens live in the Keychain, never in UserDefaults or logs (IOS-2).
/// With Face ID enabled (IOS-1) the item is protected by `.biometryCurrentSet`: a cold start must pass a Face ID scan
/// before the refresh token can be read, and enrolling a new face invalidates it (the person signs in with the password).
/// Requests use an in-memory copy, so the system prompt appears once per cold start, not per request.
final class KeychainTokenStore: TokenStore, @unchecked Sendable {
    private let service = "mz.mozdiscounts.app", account = "tokens"
    private let lock = NSLock()
    private var memory: Tokens?
    var biometric: Bool { UserDefaults.standard.bool(forKey: "lockEnabled") }

    private func base() -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account] }

    func load() -> Tokens? {
        lock.lock(); defer { lock.unlock() }
        if let memory { return memory }
        if biometric { return nil }            // protected: call unlock(with:) after a Face ID scan
        return read(context: nil)
    }

    /// Reads the protected item with an already-authenticated context and caches it. False when invalidated (new face) or missing.
    func unlock(with context: LAContext) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard let t = read(context: context) else { return false }
        memory = t; return true
    }
    var hasStoredTokens: Bool {
        var q = base(); q[kSecReturnAttributes as String] = true; q[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        let s = SecItemCopyMatching(q as CFDictionary, nil)
        return s == errSecSuccess || s == errSecInteractionNotAllowed
    }

    private func read(context: LAContext?) -> Tokens? {
        var q = base(); q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        if let context { q[kSecUseAuthenticationContext as String] = context }
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return try? JSONDecoder().decode(Tokens.self, from: d)
    }

    func save(_ t: Tokens?) {
        lock.lock(); defer { lock.unlock() }
        SecItemDelete(base() as CFDictionary)
        memory = t
        guard let t, let d = try? JSONEncoder().encode(t) else { return }
        var add = base(); add[kSecValueData as String] = d
        if biometric, let ac = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .biometryCurrentSet, nil) { add[kSecAttrAccessControl as String] = ac }
        else { add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly }
        _ = SecItemAdd(add as CFDictionary, nil) // an unsigned simulator build has no keychain entitlement: the in-memory copy still works for that session
    }

    /// Re-saves the current tokens under the protection that matches the Face ID setting.
    func reprotect() { if let t = load() { save(t) } }
}
