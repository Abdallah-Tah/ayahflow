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

/// Copies every bundled ≤30 s athan alert (public/sounds/athan-<id>-alert.caf) into Library/Sounds as
/// ayahflow-athan-<id>.caf, where iOS looks for notification sounds. An imported recording is written there by the app.
enum AthanSound {
    static func install() {
        guard let sounds = Bundle.main.url(forResource: "sounds", withExtension: nil, subdirectory: "public"),
              let library = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask).first,
              let files = try? FileManager.default.contentsOfDirectory(at: sounds, includingPropertiesForKeys: nil) else { return }
        let dir = library.appendingPathComponent("Sounds", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let size = { (url: URL) in (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? -1 }
        for source in files where source.lastPathComponent.hasPrefix("athan-") && source.lastPathComponent.hasSuffix("-alert.caf") {
            let id = source.lastPathComponent.dropFirst("athan-".count).dropLast("-alert.caf".count)
            let target = dir.appendingPathComponent("ayahflow-athan-\(id).caf")
            if size(source) == size(target) { continue }
            try? FileManager.default.removeItem(at: target)
            try? FileManager.default.copyItem(at: source, to: target)
        }
    }
}
