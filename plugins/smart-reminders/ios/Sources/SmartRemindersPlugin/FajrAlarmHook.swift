import Foundation

/// Fajr wake-up alarm. AlarmKit and its button intents live in the app target (ios/App/App/FajrAlarm.swift), because
/// the system runs those intents in the app; the app registers its scheduler here at launch (iOS 26 and later only).
public protocol FajrAlarmScheduling: AnyObject {
    /// "authorized", "denied" or "notDetermined".
    func authorization() -> String
    func requestAuthorization(_ done: @escaping (String) -> Void)
    /// Replaces the planned alarms with `plan` (JSON from src/app.ts); resolves how many were scheduled.
    func schedule(_ plan: Data, _ done: @escaping (Result<Int, Error>) -> Void)
    /// Alarms still to ring: [{ id, at (ms), kind: "fajr" | "snooze" | "check" }].
    func pending() -> [[String: Any]]
    /// The alarm was stopped and the wake check is waiting for the user.
    func checkWaiting() -> Bool
    /// The user confirmed in the app that they are awake: the follow-up ring is cancelled.
    func confirmAwake()
}

public enum FajrAlarmHook {
    public static var scheduler: FajrAlarmScheduling?
}
