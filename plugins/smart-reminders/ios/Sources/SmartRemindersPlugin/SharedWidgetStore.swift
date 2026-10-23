import Foundation
import Security
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Shares the widget timeline with the AyahFlow widget extension through a keychain access group
/// (App Groups are not available to personal development teams). Holds prayer times and labels only, never coordinates.
enum SharedWidgetStore {
    static let service = "app.ayahflow.widget", account = "timeline"

    /// "<TeamID>.com.buildwithabdallah.ayahflow.shared", from Info.plist key AyahFlowSharedKeychain ($(AppIdentifierPrefix)…).
    static var group: String? { Bundle.main.object(forInfoDictionaryKey: "AyahFlowSharedKeychain") as? String }

    static func save(_ data: Data?) -> OSStatus {
        guard let group else { return errSecMissingEntitlement }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecAttrAccessGroup as String: group]
        SecItemDelete(query as CFDictionary)
        var status = errSecSuccess
        if let data {
            var add = query
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            status = SecItemAdd(add as CFDictionary, nil)
        }
        #if canImport(WidgetKit)
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        #endif
        return status
    }
}

/// Copies the ≤30 s athan alert from the web assets into Library/Sounds, where iOS looks for notification sounds.
enum AthanSound {
    static let fileName = "ayahflow-athan.caf"
    static func install() {
        guard let source = Bundle.main.url(forResource: "athan-alert", withExtension: "caf", subdirectory: "public/sounds"),
              let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        let dir = library.appendingPathComponent("Sounds", isDirectory: true), target = dir.appendingPathComponent(fileName)
        let size = { (url: URL) in (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? -1 }
        if size(source) == size(target) { return }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: target)
        try? FileManager.default.copyItem(at: source, to: target)
    }
}
