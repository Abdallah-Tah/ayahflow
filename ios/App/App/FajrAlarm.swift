import Foundation
import AlarmKit
import AppIntents
import ActivityKit
import SwiftUI
import SmartRemindersPlugin

/// Fajr wake-up alarm with AlarmKit (iOS 26+): rings through Silent and Focus, full screen on the Lock Screen.
/// The web layer plans the days and times (src/alarm.ts) and sends them here; everything stays on the device.
/// Snooze is limited: each snooze is a new one-off alarm, offered only while snoozes remain for that morning.
/// Wake check: after Stop, one more alarm rings a few minutes later unless the user opens AyahFlow and confirms.
struct FajrAlarmData: AlarmMetadata {
    var kind: String = "fajr"
}

/// Sent by src/app.ts (syncFajrAlarm). Times are milliseconds since 1970.
struct FajrAlarmPlan: Codable {
    struct Item: Codable { let uuid: String; let at: Double }
    let alarms: [Item]
    let snoozes: Int
    let snoozeMinutes: Int
    let check: Bool
    let checkMinutes: Int
    let title: String
    let checkTitle: String
    let stop: String
    let snooze: String
}

@available(iOS 26.0, *)
final class FajrAlarms: FajrAlarmScheduling {
    static let shared = FajrAlarms()
    private let defaults = UserDefaults.standard
    private let planKey = "ayahflow.alarm.plan"
    /// Snooze and check alarms this app added: id → { kind, origin (the morning's alarm), at }.
    private let extraKey = "ayahflow.alarm.extra"
    /// Snoozes used per morning's alarm id.
    private let snoozedKey = "ayahflow.alarm.snoozed"
    private let checkKey = "ayahflow.alarm.check"
    private var manager: AlarmManager { .shared }

    private var plan: FajrAlarmPlan? { defaults.data(forKey: planKey).flatMap { try? JSONDecoder().decode(FajrAlarmPlan.self, from: $0) } }
    private var extras: [String: [String: String]] {
        get { defaults.dictionary(forKey: extraKey) as? [String: [String: String]] ?? [:] }
        set { defaults.set(newValue, forKey: extraKey) }
    }
    private var snoozed: [String: Int] {
        get { defaults.dictionary(forKey: snoozedKey) as? [String: Int] ?? [:] }
        set { defaults.set(newValue, forKey: snoozedKey) }
    }

    func authorization() -> String {
        switch manager.authorizationState {
        case .authorized: return "authorized"
        case .denied: return "denied"
        default: return "notDetermined"
        }
    }

    func requestAuthorization(_ done: @escaping (String) -> Void) {
        Task { _ = try? await manager.requestAuthorization(); await MainActor.run { done(self.authorization()) } }
    }

    func schedule(_ data: Data, _ done: @escaping (Result<Int, Error>) -> Void) {
        Task {
            do {
                let plan = try JSONDecoder().decode(FajrAlarmPlan.self, from: data)
                defaults.set(data, forKey: planKey)
                let keepExtras = plan.alarms.isEmpty ? Set<String>() : Set(extras.keys)
                // Replace every planned morning (times move with Fajr). A ringing alarm, or a snooze or wake check
                // already under way, is left alone, unless the alarm was turned off.
                for alarm in try manager.alarms where alarm.state != .alerting && !keepExtras.contains(alarm.id.uuidString) {
                    try? manager.cancel(id: alarm.id)
                }
                if plan.alarms.isEmpty { extras = [:]; defaults.removeObject(forKey: checkKey) }
                var n = 0
                for item in plan.alarms {
                    guard let id = UUID(uuidString: item.uuid) else { continue }
                    let date = Date(timeIntervalSince1970: item.at / 1000)
                    let existing = try manager.alarms
                    if date <= Date() || existing.contains(where: { $0.id == id }) { continue }
                    try await ring(id: id, at: date, title: plan.title, plan: plan, snoozeLeft: plan.snoozes)
                    n += 1
                }
                prune()
                let scheduled = n
                await MainActor.run { done(.success(scheduled)) }
            } catch {
                await MainActor.run { done(.failure(error)) }
            }
        }
    }

    func pending() -> [[String: Any]] {
        let list = (try? manager.alarms) ?? []
        return list.compactMap { a -> [String: Any]? in
            guard case .fixed(let date) = a.schedule else { return nil }
            return ["id": a.id.uuidString, "at": date.timeIntervalSince1970 * 1000, "kind": extras[a.id.uuidString]?["kind"] ?? "fajr", "state": "\(a.state)"]
        }
    }

    func checkWaiting() -> Bool { defaults.string(forKey: checkKey) != nil }

    func confirmAwake() {
        if let id = defaults.string(forKey: checkKey).flatMap(UUID.init(uuidString:)) { try? manager.cancel(id: id) }
        defaults.removeObject(forKey: checkKey)
        prune()
    }

    /// Stop: if the wake check is on and this was not already the check, ring once more in a few minutes.
    func stopped(_ id: UUID) {
        try? manager.stop(id: id)
        guard let plan, plan.check, extras[id.uuidString]?["kind"] != "check" else { return }
        let check = UUID()
        record(check, kind: "check", origin: origin(of: id))
        defaults.set(check.uuidString, forKey: checkKey)
        Task { try? await ring(id: check, at: Date().addingTimeInterval(Double(plan.checkMinutes) * 60), title: plan.checkTitle, plan: plan, snoozeLeft: 0) }
    }

    /// Snooze: a new one-off alarm, while this morning still has snoozes left.
    func snoozed(_ id: UUID) {
        try? manager.stop(id: id)
        guard let plan else { return }
        let first = origin(of: id), used = (snoozed[first] ?? 0) + 1
        guard used <= plan.snoozes else { return }
        snoozed[first] = used
        let next = UUID()
        record(next, kind: "snooze", origin: first)
        Task { try? await ring(id: next, at: Date().addingTimeInterval(Double(plan.snoozeMinutes) * 60), title: plan.title, plan: plan, snoozeLeft: plan.snoozes - used) }
    }

    private func origin(of id: UUID) -> String { extras[id.uuidString]?["origin"] ?? id.uuidString }
    private func record(_ id: UUID, kind: String, origin: String) {
        var e = extras
        e[id.uuidString] = ["kind": kind, "origin": origin, "at": String(Date().timeIntervalSince1970)]
        extras = e
    }
    /// Forgets snooze and check records older than a day.
    private func prune() {
        let cutoff = Date().timeIntervalSince1970 - 86400
        let old = extras.filter { Double($0.value["at"] ?? "") ?? 0 < cutoff }
        guard !old.isEmpty else { return }
        var e = extras, s = snoozed
        for (id, v) in old { e[id] = nil; if let o = v["origin"] { s[o] = nil } }
        extras = e; snoozed = s
    }

    private func ring(id: UUID, at date: Date, title: String, plan: FajrAlarmPlan, snoozeLeft: Int) async throws {
        let stop = AlarmButton(text: LocalizedStringResource(stringLiteral: plan.stop), textColor: .white, systemImageName: "sun.horizon")
        let snooze = AlarmButton(text: LocalizedStringResource(stringLiteral: plan.snooze), textColor: .black, systemImageName: "zzz")
        let alert = snoozeLeft > 0
            ? AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop, secondaryButton: snooze, secondaryButtonBehavior: .custom)
            : AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
        let attributes = AlarmAttributes<FajrAlarmData>(presentation: AlarmPresentation(alert: alert), metadata: FajrAlarmData(), tintColor: Color(red: 0.83, green: 0.66, blue: 0.33))
        let configuration = AlarmManager.AlarmConfiguration<FajrAlarmData>.alarm(
            schedule: .fixed(date), attributes: attributes,
            stopIntent: StopFajrAlarm(alarmID: id.uuidString),
            secondaryIntent: snoozeLeft > 0 ? SnoozeFajrAlarm(alarmID: id.uuidString) : nil,
            sound: .default)
        _ = try await manager.schedule(id: id, configuration: configuration)
    }
}

@available(iOS 26.0, *)
struct StopFajrAlarm: LiveActivityIntent {
    static var title: LocalizedStringResource = "Stop Fajr alarm"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Alarm") var alarmID: String
    init() {}
    init(alarmID: String) { self.alarmID = alarmID }
    func perform() async throws -> some IntentResult {
        if let id = UUID(uuidString: alarmID) { FajrAlarms.shared.stopped(id) }
        return .result()
    }
}

@available(iOS 26.0, *)
struct SnoozeFajrAlarm: LiveActivityIntent {
    static var title: LocalizedStringResource = "Snooze Fajr alarm"
    static var isDiscoverable: Bool = false
    @Parameter(title: "Alarm") var alarmID: String
    init() {}
    init(alarmID: String) { self.alarmID = alarmID }
    func perform() async throws -> some IntentResult {
        if let id = UUID(uuidString: alarmID) { FajrAlarms.shared.snoozed(id) }
        return .result()
    }
}
