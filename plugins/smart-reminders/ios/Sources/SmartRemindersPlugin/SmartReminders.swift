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
    /// Home-only athan: Home is watched (even with place reminders off) so pending athan alerts can be re-sounded.
    /// Optional so configurations saved by earlier builds still decode.
    var athanHome: Bool?
}

private struct History: Codable {
    var last: [String: Double] = [:]
    var lastDay: [String: String] = [:]
}

public struct LoggedEvent: Codable { let event: String; let at: Double; let moments: [String]; var detail: String? = nil }

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
    /// Trip watch: short background location run after leaving a saved place, to notice vehicle travel.
    private var tripUntil: Date?
    private var fastFixes = 0
    private var tripTask: UIBackgroundTaskIdentifier = .invalid
    private var significantOn = false
    private let lastWakeKey = "ayahflow.smart.lastwake", homeKey = "ayahflow.smart.home", watchKey = "ayahflow.smart.watch"
    private static let tripSeconds: TimeInterval = 240, vehicleSpeed: CLLocationSpeed = 6 // m/s ≈ 22 km/h
    private var canRunInBackground: Bool { (Bundle.main.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String])?.contains("location") ?? false }

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
        noteWatching()
    }

    /// Starts or stops region and significant-change monitoring to match the saved configuration.
    func applyMonitoring() {
        let cfg = config
        let canMonitor = CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) && manager.authorizationStatus == .authorizedAlways
        let athanHome = canMonitor && cfg?.athanHome == true
        let wanted = !canMonitor ? [] : (cfg?.location ?? false) ? (cfg?.regions ?? []) : athanHome ? (cfg?.regions ?? []).filter { $0.id == "home" } : []
        for region in manager.monitoredRegions where !wanted.contains(where: { $0.id == region.identifier }) {
            manager.stopMonitoring(for: region)
        }
        for r in wanted {
            let radius = min(max(r.radius, 100), manager.maximumRegionMonitoringDistance)
            let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: r.lat, longitude: r.lng), radius: radius, identifier: r.id)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            manager.startMonitoring(for: region) // Replaces any region with the same identifier.
            if r.id == "home" && athanHome { manager.requestState(for: region) }
        }
        // A remembered Home state is only trusted while Home is watched; otherwise alerts fall back to the chime.
        if !wanted.contains(where: { $0.id == "home" }) { setHome(nil) }
        // Significant-change wakes drive vehicle checks; speed is estimated from successive wakes, so motion data is optional.
        if (cfg?.vehicle ?? false) && manager.authorizationStatus == .authorizedAlways && CLLocationManager.significantLocationChangeMonitoringAvailable() {
            manager.startMonitoringSignificantLocationChanges()
            significantOn = true
        } else {
            manager.stopMonitoringSignificantLocationChanges()
            significantOn = false
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
        let refresh: String
        switch UIApplication.shared.backgroundRefreshStatus {
        case .available: refresh = "on"
        case .denied: refresh = "off"
        default: refresh = "restricted"
        }
        return ["location": loc, "motion": mot, "monitoring": manager.monitoredRegions.map { $0.identifier }, "precise": manager.accuracyAuthorization == .fullAccuracy,
                "home": defaults.string(forKey: homeKey) ?? "unknown", "backgroundRefresh": refresh, "lowPower": ProcessInfo.processInfo.isLowPowerModeEnabled, "vehicleWatch": significantOn,
                "configSaved": config != nil, "tripWatch": tripUntil != nil, "backgroundLocation": canRunInBackground]
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
        noteWatching()
    }

    /// Logs when background watching stops or comes back (e.g. iOS's "Change to Only While Using"), so the gap shows in
    /// Recently detected instead of reminders silently stopping. Only while place or vehicle reminders are on.
    private func noteWatching() {
        guard let cfg = config, cfg.location || cfg.vehicle, manager.authorizationStatus != .notDetermined else { return }
        let on = manager.authorizationStatus == .authorizedAlways, was = defaults.object(forKey: watchKey) as? Bool
        guard was != on else { return }
        defaults.set(on, forKey: watchKey)
        if was == nil && on { return }
        log(on ? "WATCH_ON" : "WATCH_OFF", detail: "location: \(status()["location"] as? String ?? "unknown")")
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if !positionWaiters.isEmpty, let last = locations.last {
            let waiters = positionWaiters
            positionWaiters.removeAll()
            waiters.forEach { $0(last, nil) }
            return
        }
        if let until = tripUntil { trip(locations, until: until); return }
        // Significant-change wake (the app may have been relaunched in the background just for this).
        guard config?.vehicle == true, let location = locations.last else { return }
        let speed = estimatedSpeed(to: location)
        vehicleCheck(reason: "WAKE", speed: speed, lookback: 6 * 60)
    }

    /// Average speed since the previous wake (m/s), or nil. Significant-change fixes rarely carry their own speed.
    private func estimatedSpeed(to location: CLLocation) -> Double? {
        defer { defaults.set([location.coordinate.latitude, location.coordinate.longitude, location.timestamp.timeIntervalSince1970], forKey: lastWakeKey) }
        if location.speed >= 0, location.speedAccuracy >= 0, location.speedAccuracy < 5 { return location.speed }
        guard let last = defaults.array(forKey: lastWakeKey) as? [Double], last.count == 3 else { return nil }
        let seconds = location.timestamp.timeIntervalSince1970 - last[2]
        guard seconds > 20, seconds < 20 * 60 else { return nil }
        return location.distance(from: CLLocation(latitude: last[0], longitude: last[1])) / seconds
    }

    /// Vehicle if recent motion says automotive (when allowed) or the speed is clearly above walking or cycling pace.
    private func vehicleCheck(reason: String, speed: Double?, lookback: TimeInterval, alsoEvents: [String] = []) {
        let task = UIApplication.shared.beginBackgroundTask(withName: "ayahflow.vehicle")
        let finish: (Bool, String) -> Void = { [weak self] inVehicle, why in
            guard let self else { return }
            self.log(reason, detail: why)
            self.handle(alsoEvents + (inVehicle ? ["ENTER_VEHICLE"] : []))
            UIApplication.shared.endBackgroundTask(task)
        }
        let fast = (speed ?? 0) >= SmartReminders.vehicleSpeed
        let speedText = speed.map { String(format: "%.0f km/h", $0 * 3.6) } ?? "speed unknown"
        guard CMMotionActivityManager.isActivityAvailable(), CMMotionActivityManager.authorizationStatus() == .authorized else {
            finish(fast, "\(speedText) · motion not allowed"); return
        }
        let now = Date()
        motion.queryActivityStarting(from: now.addingTimeInterval(-lookback), to: now, to: .main) { activities, _ in
            let automotive = (activities ?? []).contains { $0.automotive && $0.confidence != .low }
            finish(automotive || fast, "\(speedText) · \(automotive ? "automotive motion" : "no vehicle motion")")
        }
    }

    // MARK: Trip watch
    /// After leaving a saved place, watch location for a few minutes: sustained speed or automotive motion means a vehicle.
    private func startTrip() {
        guard config?.vehicle == true, manager.authorizationStatus == .authorizedAlways, canRunInBackground, tripUntil == nil else { return }
        tripUntil = Date().addingTimeInterval(SmartReminders.tripSeconds)
        fastFixes = 0
        tripTask = UIApplication.shared.beginBackgroundTask(withName: "ayahflow.trip") { [weak self] in self?.stopTrip("expired") }
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = false
        manager.pausesLocationUpdatesAutomatically = false
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 25
        manager.startUpdatingLocation()
        log("TRIP_START", detail: "watching \(Int(SmartReminders.tripSeconds / 60)) min")
        DispatchQueue.main.asyncAfter(deadline: .now() + SmartReminders.tripSeconds + 1) { [weak self] in self?.stopTrip("no vehicle detected") }
    }

    private func trip(_ locations: [CLLocation], until: Date) {
        for l in locations where l.horizontalAccuracy >= 0 && l.horizontalAccuracy < 80 && l.speed >= SmartReminders.vehicleSpeed { fastFixes += 1 }
        if fastFixes >= 2 {
            let speed = locations.last.map { String(format: "%.0f km/h", max(0, $0.speed) * 3.6) } ?? ""
            stopTrip("vehicle · \(speed)")
            handle(["ENTER_VEHICLE"])
        } else if Date() > until {
            stopTrip("no vehicle detected")
        }
    }

    private func stopTrip(_ why: String) {
        guard tripUntil != nil else { return }
        tripUntil = nil
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = kCLDistanceFilterNone
        log("TRIP_END", detail: why)
        if tripTask != .invalid { UIApplication.shared.endBackgroundTask(tripTask); tripTask = .invalid }
    }

    private func log(_ event: String, detail: String) {
        var entries = (defaults.data(forKey: logKey)).flatMap { try? JSONDecoder().decode([LoggedEvent].self, from: $0) } ?? []
        entries.append(LoggedEvent(event: event, at: Date().timeIntervalSince1970 * 1000, moments: [], detail: detail))
        defaults.set(try? JSONEncoder().encode(Array(entries.suffix(50))), forKey: logKey)
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let waiters = positionWaiters
        positionWaiters.removeAll()
        waiters.forEach { $0(nil, error.localizedDescription) }
    }

    public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) { regionEvent("ENTER", region.identifier) }
    public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) { regionEvent("EXIT", region.identifier) }

    public func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        guard region.identifier == "home" else { return }
        setHome(state == .inside ? "in" : state == .outside ? "out" : nil)
    }

    private func regionEvent(_ kind: String, _ id: String) {
        guard ["home", "work", "mosque"].contains(id) else { return }
        if id == "home" { setHome(kind == "ENTER" ? "in" : "out") }
        // Home may be watched only for the athan sound; place reminders then stay quiet.
        guard config?.location == true else { return }
        let event = "\(kind)_\(id.uppercased())"
        guard kind == "EXIT", config?.vehicle == true else { handle([event]); return }
        // Leaving a saved place: include a vehicle already under way, then keep watching the next few minutes.
        vehicleCheck(reason: "LEFT_CHECK", speed: nil, lookback: 5 * 60, alsoEvents: [event])
        startTrip()
    }

    // MARK: Home-only athan
    private func setHome(_ state: String?) {
        if defaults.string(forKey: homeKey) != state { if let state { defaults.set(state, forKey: homeKey) } else { defaults.removeObject(forKey: homeKey) } }
        placeAthan()
    }

    /// Re-adds pending athan alerts marked homeOnly (by native/bridge.mjs) with the athan sound inside Home and the chime
    /// anywhere else, including when the place is unknown. Same identifier and trigger, so iOS replaces each one in place.
    func placeAthan(_ done: ((Int) -> Void)? = nil) {
        let atHome = defaults.string(forKey: homeKey) == "in", center = UNUserNotificationCenter.current()
        var task = UIBackgroundTaskIdentifier.invalid
        task = UIApplication.shared.beginBackgroundTask(withName: "ayahflow.athan.place") { UIApplication.shared.endBackgroundTask(task); task = .invalid }
        center.getPendingNotificationRequests { requests in
            var changed = 0
            for r in requests {
                guard var extra = r.content.userInfo["cap_extra"] as? [String: Any], extra["homeOnly"] as? Bool == true,
                      let athan = extra["athanSound"] as? String, let away = extra["awaySound"] as? String,
                      let content = r.content.mutableCopy() as? UNMutableNotificationContent else { continue }
                let want = atHome ? athan : away
                if extra["playing"] as? String == want { continue }
                extra["playing"] = want
                content.sound = UNNotificationSound(named: UNNotificationSoundName(want))
                var info = content.userInfo
                info["cap_extra"] = extra
                content.userInfo = info
                center.add(UNNotificationRequest(identifier: r.identifier, content: content, trigger: r.trigger))
                changed += 1
            }
            DispatchQueue.main.async {
                done?(changed)
                if task != .invalid { UIApplication.shared.endBackgroundTask(task); task = .invalid }
            }
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
        guard let cfg = config, !events.isEmpty else { return [] }
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
        // The bundled adhkar chime (scripts/make-chime.mjs); iOS falls back to the default sound if it is missing.
        content.sound = UNNotificationSound(named: UNNotificationSoundName("public/sounds/adhkar-chime.caf"))
        content.threadIdentifier = "ayahflow.adhkar"
        // Read by @capacitor/local-notifications' tap handler and forwarded to the web layer.
        content.userInfo = ["cap_extra": ["url": "ayahflow://moment/" + moments.joined(separator: "+")]]
        let request = UNNotificationRequest(identifier: "ayahflow.smart.\(Int(Date().timeIntervalSince1970))", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    func takeLog() -> [[String: Any]] {
        let log = (defaults.data(forKey: logKey)).flatMap { try? JSONDecoder().decode([LoggedEvent].self, from: $0) } ?? []
        defaults.removeObject(forKey: logKey)
        return log.map { ["event": $0.event, "at": $0.at, "moments": $0.moments, "detail": $0.detail ?? ""] }
    }

    func reset() {
        for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }
        manager.stopMonitoringSignificantLocationChanges()
        [configKey, historyKey, logKey, homeKey, watchKey].forEach { defaults.removeObject(forKey: $0) }
    }
}
