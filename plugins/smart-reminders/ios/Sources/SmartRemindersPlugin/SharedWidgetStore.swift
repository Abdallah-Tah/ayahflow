import Foundation
import Security
import os
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Shares the widget timeline with the AyahFlow widget extension through a keychain access group
/// (App Groups are not available to personal development teams). Holds prayer times and labels only, never coordinates.
enum SharedWidgetStore {
    static let service = "app.ayahflow.widget", account = "timeline"

    /// "<TeamID>.com.buildwithabdallah.ayahflow.shared", from Info.plist key AyahFlowSharedKeychain ($(AppIdentifierPrefix)…).
    static var group: String? { Bundle.main.object(forInfoDictionaryKey: "AyahFlowSharedKeychain") as? String }

    /// Writes (or with nil, removes) the shared timeline. An existing item is updated in place, so the widget's last good
    /// copy stays until its replacement is committed; it is never deleted first. Failures are logged with their OSStatus
    /// (Console: subsystem com.buildwithabdallah.ayahflow, category widget) and returned for the caller to report.
    static func save(_ data: Data?) -> OSStatus {
        guard let group else { log.error("Widget store: no AyahFlowSharedKeychain in Info.plist"); return errSecMissingEntitlement }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecAttrAccessGroup as String: group]
        var status: OSStatus
        if let data {
            let values: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]
            status = SecItemUpdate(query as CFDictionary, values as CFDictionary)
            if status == errSecItemNotFound { status = SecItemAdd(query.merging(values) { $1 } as CFDictionary, nil) }
        } else {
            status = SecItemDelete(query as CFDictionary)
            if status == errSecItemNotFound { status = errSecSuccess }
        }
        if status == errSecSuccess {
            #if canImport(WidgetKit)
            if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
            #endif
        } else {
            log.error("Widget store \(data == nil ? "delete" : "write", privacy: .public) failed: OSStatus \(status, privacy: .public) \(message(status), privacy: .public) (\(data?.count ?? 0, privacy: .public) bytes)")
        }
        return status
    }

    static func message(_ status: OSStatus) -> String { (SecCopyErrorMessageString(status, nil) as String?) ?? "" }
    private static let log = Logger(subsystem: "com.buildwithabdallah.ayahflow", category: "widget")
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
