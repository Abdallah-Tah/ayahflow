import Foundation
import Capacitor
import CoreLocation
import CoreMotion
import CryptoKit

/// Web-layer API for SmartReminders. Location is requested only from these calls, i.e. after the user turns on a
/// feature that needs it. Coordinates are kept on the device; nothing here uses the network.
@objc(SmartRemindersPlugin)
public class SmartRemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SmartRemindersPlugin"
    public let jsName = "AyahFlowSmart"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentPosition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlways", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "simulate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadAthan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "steps", returnType: CAPPluginReturnPromise)
    ]
    private var engine: SmartReminders { SmartReminders.shared }
    private let pedometer = CMPedometer()

    override public func load() { DispatchQueue.main.async { self.engine.start() } }

    @objc func status(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(self.engine.status()) } }

    @objc func currentPosition(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.engine.currentPosition { location, error in
                guard let location else { call.reject(error ?? "unavailable"); return }
                call.resolve(["lat": location.coordinate.latitude, "lng": location.coordinate.longitude, "accuracy": location.horizontalAccuracy])
            }
        }
    }

    @objc func requestAlways(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.requestAlways { _ in call.resolve(self.engine.status()) } }
    }

    @objc func requestMotion(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.engine.requestMotion { motion in var s = self.engine.status(); s["motion"] = motion; call.resolve(s) } }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let json = call.getString("config"), let data = json.data(using: .utf8) else { call.reject("config required"); return }
        DispatchQueue.main.async {
            do { try self.engine.configure(data); call.resolve(self.engine.status()) } catch { call.reject("invalid config: \(error.localizedDescription)") }
        }
    }

    @objc func takeEvents(_ call: CAPPluginCall) { DispatchQueue.main.async { call.resolve(["events": self.engine.takeLog()]) } }

    /// Runs the real decision and notification path for an event, so the user can check their setup.
    @objc func simulate(_ call: CAPPluginCall) {
        guard let event = call.getString("event") else { call.reject("event required"); return }
        DispatchQueue.main.async { call.resolve(["moments": self.engine.handle([event])]) }
    }

    @objc func reset(_ call: CAPPluginCall) { DispatchQueue.main.async { self.engine.reset(); call.resolve() } }

    /// Widget timeline JSON from src/smart.ts (prayer times and labels). Pass null to clear it.
    @objc func setWidgetData(_ call: CAPPluginCall) {
        let json = call.getString("data")
        let data = (json == nil || json == "null") ? nil : json!.data(using: .utf8)
        let status = SharedWidgetStore.save(data)
        status == errSecSuccess ? call.resolve() : call.reject("widget store failed: OSStatus \(status) \(SharedWidgetStore.message(status))", String(status))
    }

    /// Downloads an athan recording the user asked for. Only HTTPS from cdn.aladhan.com, at most 12 MB, verified against the
    /// pinned SHA-256, and written only under Documents/ayahflow/athan/online/ (Capacitor's Directory.Data on iOS).
    @objc func downloadAthan(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString), url.scheme == "https", url.host == "cdn.aladhan.com",
              let sha = call.getString("sha256")?.lowercased(), sha.count == 64,
              let path = call.getString("path"), path.range(of: "^ayahflow/athan/online/[a-z0-9-]+\\.mp3$", options: .regularExpression) != nil,
              let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { call.reject("not allowed"); return }
        URLSession.shared.downloadTask(with: url) { tmp, response, error in
            guard let tmp, error == nil, (response as? HTTPURLResponse)?.statusCode == 200, let data = try? Data(contentsOf: tmp), data.count <= 12_000_000 else { call.reject("download failed"); return }
            let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            guard hash == sha else { call.reject("checksum mismatch"); return }
            let target = documents.appendingPathComponent(path)
            do {
                try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: target, options: .atomic)
                call.resolve(["path": path, "bytes": data.count])
            } catch { call.reject("could not save") }
        }.resume()
    }

    /// Steps for each of the last `days` local days (at most 7, the history iOS keeps). Read from the system pedometer
    /// under the Motion & Fitness permission; nothing is stored or sent anywhere.
    @objc func steps(_ call: CAPPluginCall) {
        guard CMPedometer.isStepCountingAvailable() else { call.resolve(["available": false, "permission": "unavailable", "approximate": false, "days": []]); return }
        let count = max(1, min(call.getInt("days") ?? 7, 7))
        let cal = Calendar.current, now = Date(), today = cal.startOfDay(for: now)
        let format = DateFormatter()
        format.calendar = Calendar(identifier: .gregorian); format.locale = Locale(identifier: "en_US_POSIX"); format.dateFormat = "yyyy-MM-dd"
        let group = DispatchGroup(), lock = NSLock()
        var days: [(Date, Int)] = [], denied = false
        for i in 0..<count {
            guard let start = cal.date(byAdding: .day, value: -i, to: today), let next = cal.date(byAdding: .day, value: 1, to: start) else { continue }
            group.enter()
            pedometer.queryPedometerData(from: start, to: min(next, now)) { data, error in
                lock.lock()
                if let error = error as NSError?, error.domain == CMErrorDomain, error.code == Int(CMErrorMotionActivityNotAuthorized.rawValue) { denied = true }
                if let data { days.append((start, data.numberOfSteps.intValue)) }
                lock.unlock(); group.leave()
            }
        }
        group.notify(queue: .main) {
            let status = CMPedometer.authorizationStatus()
            let permission = denied || status == .denied || status == .restricted ? "denied" : status == .authorized ? "granted" : "prompt"
            call.resolve(["available": true, "permission": permission, "approximate": false, "days": days.sorted { $0.0 < $1.0 }.map { ["day": format.string(from: $0.0), "steps": $0.1] }])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }
}
