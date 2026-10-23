import Foundation
import CoreLocation
import CoreMotion
import UIKit
import UserNotifications

/// Configuration computed by the web layer (src/smart.ts) and persisted here so reminders work while the app is closed.
/// Mirrors src/adhkar.ts `decide()`; the TypeScript version is the tested reference.
public struct SmartConfig: Codable {
    public struct Region: Codable { let id: String; let lat: Double; let lng: Double; let radius: Double }
    public struct Rule: Codable { let event: String; let moments: [String]; let cooldownMinutes: Double }
    public struct Window: Codable { let day: String; let morning: [Double]?; let evening: [Double]? }
    public struct Copy: Codable { let title: String; let body: String }
    var location: Bool
    var vehicle: Bool
    var regions: [Region]
    var rules: [Rule]
    var oncePerDay: [String]
    var windows: [Window]
    var copy: [String: Copy]
    var enabled: [String]
    var completedDay: [String: String]
    /// Pending timed notification ids by moment and day, cancelled when a grouped reminder already covered them.
    var timedIds: [String: [String: Int]]
}

private struct History: Codable {
    var last: [String: Double] = [:]
    var lastDay: [String: String] = [:]
}

public struct LoggedEvent: Codable { let event: String; let at: Double; let moments: [String] }

/// Owns CLLocationManager so region events are delivered even when iOS relaunches the app in the background
/// without a scene (no web view, no bridge). Started from AppDelegate.didFinishLaunching.
@objc public final class SmartReminders: NSObject, CLLocationManagerDelegate {
    @objc public static let shared = SmartReminders()
    private let manager = CLLocationManager()
    private let motion = CMMotionActivityManager()
    private let defaults = UserDefaults.standard
    private let configKey = "ayahflow.smart.config", historyKey = "ayahflow.smart.history", logKey = "ayahflow.smart.log"
    private var started = false
    private var positionWaiters: [(CLLocation?, String?) -> Void] = []
    private var authWaiters: [(CLAuthorizationStatus) -> Void] = []

    @objc public func start() {
        guard !started else { return }
        started = true
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        applyMonitoring()
        AthanSound.install()
    }

    // MARK: Configuration
    var config: SmartConfig? {
        guard let data = defaults.data(forKey: configKey) else { return nil }
        return try? JSONDecoder().decode(SmartConfig.self, from: data)
    }

    func configure(_ data: Data) throws {
        _ = try JSONDecoder().decode(SmartConfig.self, from: data)
        defaults.set(data, forKey: configKey)
        applyMonitoring()
    }

    /// Starts or stops region and significant-change monitoring to match the saved configuration.
    func applyMonitoring() {
        let cfg = config
        let canMonitor = CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) && manager.authorizationStatus == .authorizedAlways
        let wanted = (cfg?.location ?? false) && canMonitor ? (cfg?.regions ?? []) : []
        for region in manager.monitoredRegions where !wanted.contains(where: { $0.id == region.identifier }) {
            manager.stopMonitoring(for: region)
        }
        for r in wanted {
            let radius = min(max(r.radius, 100), manager.maximumRegionMonitoringDistance)
            let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: r.lat, longitude: r.lng), radius: radius, identifier: r.id)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            manager.startMonitoring(for: region) // Replaces any region with the same identifier.
        }
        if (cfg?.vehicle ?? false) && manager.authorizationStatus == .authorizedAlways && CMMotionActivityManager.isActivityAvailable() {
            manager.startMonitoringSignificantLocationChanges()
        } else {
            manager.stopMonitoringSignificantLocationChanges()
        }
    }

    // MARK: Status and permissions
    func status() -> [String: Any] {
        let loc: String
        switch manager.authorizationStatus {
        case .authorizedAlways: loc = "always"
        case .authorizedWhenInUse: loc = "whenInUse"
        case .denied: loc = "denied"
        case .restricted: loc = "restricted"
        default: loc = "prompt"
        }
        let mot: String
        if !CMMotionActivityManager.isActivityAvailable() { mot = "unavailable" } else {
            switch CMMotionActivityManager.authorizationStatus() {
            case .authorized: mot = "granted"
            case .denied: mot = "denied"
            case .restricted: mot = "restricted"
            default: mot = "prompt"
            }
        }
        return ["location": loc, "motion": mot, "monitoring": manager.monitoredRegions.map { $0.identifier }, "precise": manager.accuracyAuthorization == .fullAccuracy]
    }

    func requestWhenInUse(_ done: @escaping (CLAuthorizationStatus) -> Void) {
        if manager.authorizationStatus != .notDetermined { done(manager.authorizationStatus); return }
        authWaiters.append(done)
        manager.requestWhenInUseAuthorization()
    }

    func requestAlways(_ done: @escaping (CLAuthorizationStatus) -> Void) {
        requestWhenInUse { [weak self] status in
            guard let self else { return }
            guard status == .authorizedWhenInUse else { done(status); return }
            self.authWaiters.append(done)
            self.manager.requestAlwaysAuthorization()
            // iOS may defer or skip the upgrade prompt; answer with the current status rather than hanging.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.flushAuth() }
        }
    }

    func requestMotion(_ done: @escaping (String) -> Void) {
        guard CMMotionActivityManager.isActivityAvailable() else { done("unavailable"); return }
        let now = Date()
        motion.queryActivityStarting(from: now.addingTimeInterval(-60), to: now, to: .main) { _, _ in
            done(self.status()["motion"] as? String ?? "prompt")
        }
    }

    func currentPosition(_ done: @escaping (CLLocation?, String?) -> Void) {
        requestWhenInUse { [weak self] status in
            guard let self else { return }
            guard status == .authorizedWhenInUse || status == .authorizedAlways else { done(nil, "denied"); return }
            self.positionWaiters.append(done)
            self.manager.requestLocation()
        }
    }

    private func flushAuth() {
        let waiters = authWaiters
        authWaiters.removeAll()
        waiters.forEach { $0(manager.authorizationStatus) }
    }

    // MARK: CLLocationManagerDelegate
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus != .notDetermined { flushAuth() }
        applyMonitoring()
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if !positionWaiters.isEmpty, let last = locations.last {
            let waiters = positionWaiters
            positionWaiters.removeAll()
            waiters.forEach { $0(last, nil) }
            return
        }
        // Significant-change wake: check recent motion for vehicle travel. Motion updates do not run while suspended,
        // so this is a best-effort look back, not continuous detection.
        guard config?.vehicle == true, CMMotionActivityManager.authorizationStatus() == .authorized else { return }
        let task = UIApplication.shared.beginBackgroundTask(withName: "ayahflow.vehicle")
        let now = Date()
        motion.queryActivityStarting(from: now.addingTimeInterval(-6 * 60), to: now, to: .main) { [weak self] activities, _ in
            let inVehicle = (activities ?? []).contains { $0.automotive && $0.confidence != .low }
            if inVehicle { self?.handle(["ENTER_VEHICLE"]) }
            UIApplication.shared.endBackgroundTask(task)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let waiters = positionWaiters
        positionWaiters.removeAll()
        waiters.forEach { $0(nil, error.localizedDescription) }
    }

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) { regionEvent("ENTER", region.identifier) }
    public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) { regionEvent("EXIT", region.identifier) }

    private func regionEvent(_ kind: String, _ id: String) {
        guard ["home", "work", "mosque"].contains(id) else { return }
        let event = "\(kind)_\(id.uppercased())"
        // Leaving home by car: fold a recent vehicle detection into the same reminder.
        guard event == "EXIT_HOME", config?.vehicle == true, CMMotionActivityManager.authorizationStatus() == .authorized else { handle([event]); return }
        let task = UIApplication.shared.beginBackgroundTask(withName: "ayahflow.region")
        let now = Date()
        motion.queryActivityStarting(from: now.addingTimeInterval(-5 * 60), to: now, to: .main) { [weak self] activities, _ in
            let inVehicle = (activities ?? []).contains { $0.automotive && $0.confidence != .low }
            self?.handle(inVehicle ? [event, "ENTER_VEHICLE"] : [event])
            UIApplication.shared.endBackgroundTask(task)
        }
    }

    // MARK: Rules (same steps as src/adhkar.ts decide)
    private static func dayKey(_ ms: Double) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    /// Decides and posts at most one notification for events detected together. Public for the "test reminder" button.
    @discardableResult
    func handle(_ events: [String], at now: Double = Date().timeIntervalSince1970 * 1000) -> [String] {
        guard let cfg = config else { return [] }
        var history = (defaults.data(forKey: historyKey)).flatMap { try? JSONDecoder().decode(History.self, from: $0) } ?? History()
        let day = SmartReminders.dayKey(now)
        let windows = cfg.windows.first { $0.day == day }
        let enabled = Set(cfg.enabled)
        func blocked(_ m: String, _ cooldown: Double) -> Bool {
            if !enabled.contains(m) { return true }
            if cfg.oncePerDay.contains(m) { return history.lastDay[m] == day || cfg.completedDay[m] == day }
            if let last = history.last[m], now >= last, now - last < cooldown * 60000 { return true }
            return false
        }
        func inWindow(_ w: [Double]?) -> Bool { guard let w, w.count == 2 else { return false }; return now >= w[0] && now < w[1] }
        var moments: [String] = []
        for event in events {
            guard let rule = cfg.rules.first(where: { $0.event == event }) else { continue }
            for m in rule.moments where !blocked(m, rule.cooldownMinutes) && !moments.contains(m) { moments.append(m) }
        }
        let timeEvent = events.allSatisfy { ["MORNING", "EVENING", "SLEEP"].contains($0) }
        if !timeEvent && !moments.isEmpty {
            if inWindow(windows?.morning), !blocked("morning", 0), !moments.contains("morning") { moments.append("morning") }
            if inWindow(windows?.evening), !blocked("evening", 0), !moments.contains("evening") { moments.append("evening") }
        }
        var log = (defaults.data(forKey: logKey)).flatMap { try? JSONDecoder().decode([LoggedEvent].self, from: $0) } ?? []
        log.append(contentsOf: events.map { LoggedEvent(event: $0, at: now, moments: moments) })
        defaults.set(try? JSONEncoder().encode(Array(log.suffix(50))), forKey: logKey)
        guard !moments.isEmpty else { return [] }
        for m in moments { history.last[m] = now; history.lastDay[m] = day }
        defaults.set(try? JSONEncoder().encode(history), forKey: historyKey)
        // A grouped morning/evening replaces today's timed reminder for it.
        let cancel = moments.compactMap { cfg.timedIds[$0]?[day] }.map(String.init)
        if !cancel.isEmpty { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: cancel) }
        post(moments, cfg)
        return moments
    }

    private func post(_ moments: [String], _ cfg: SmartConfig) {
        let content = UNMutableNotificationContent()
        content.title = moments.compactMap { cfg.copy[$0]?.title }.joined(separator: " · ")
        content.body = cfg.copy[moments[0]]?.body ?? ""
        content.sound = .default
        content.threadIdentifier = "ayahflow.adhkar"
        // Read by @capacitor/local-notifications' tap handler and forwarded to the web layer.
        content.userInfo = ["cap_extra": ["url": "ayahflow://moment/" + moments.joined(separator: "+")]]
        let request = UNNotificationRequest(identifier: "ayahflow.smart.\(Int(Date().timeIntervalSince1970))", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    func takeLog() -> [[String: Any]] {
        let log = (defaults.data(forKey: logKey)).flatMap { try? JSONDecoder().decode([LoggedEvent].self, from: $0) } ?? []
        defaults.removeObject(forKey: logKey)
        return log.map { ["event": $0.event, "at": $0.at, "moments": $0.moments] }
    }

    func reset() {
        for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }
        manager.stopMonitoringSignificantLocationChanges()
        [configKey, historyKey, logKey].forEach { defaults.removeObject(forKey: $0) }
    }
}
