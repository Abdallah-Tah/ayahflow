import WidgetKit
import SwiftUI
import UIKit
import Security
import os
#if canImport(AppIntents)
import AppIntents
#endif

private let log = Logger(subsystem: "com.buildwithabdallah.ayahflow.widget", category: "timeline")

/// Timeline precomputed by the app (src/smart.ts widgetData) and shared through the keychain. No coordinates.
struct SharedTimeline: Decodable {
    /// `day` is the local day the prayer belongs to (an Isha after midnight belongs to the day before); older data has none.
    struct Prayer: Decodable { let key: String; let label: String; let at: Double; var day: String? = nil }
    struct Window: Decodable { let morning: [Double]?; let evening: [Double]? }
    let v: Int
    let updatedAt: Double
    let rtl: Bool
    let locale: String?
    private(set) var prayers: [Prayer]
    let windows: [Window]
    let labels: [String: String]
    /// Today's dhikr counts and adhkar progress (src/smart.ts WidgetDaily). Builds before v29 also sent a step reading,
    /// which is ignored.
    let daily: Daily?
    /** The next days' Quranic du'as (src/smart.ts dailyAyahs): the Arabic is the corpus text as it is. */
    let ayahs: [Ayah]?
    /// Prayers the user confirmed and the Ayah of the Moment for the next half hours (src/smart.ts WidgetWorship).
    let worship: Worship?
    /// Fridays, voluntary-fast days and the start of Ramadan in the next two weeks (src/calendar.ts upcomingDays).
    let upcoming: [Upcoming]?
    /// `lunar`: an Umm al-Qura date local sighting may move by a day (absent from data shared by older builds).
    struct Upcoming: Decodable { let at: Double; let day: String; let kind: String; let title: String; let sub: String; let short: String?; var lunar: Bool? = nil }
    /// The current or next Ramadan (src/calendar.ts ramadanSpan): local midnights of 1 Ramadan and of Eid al-Fitr.
    let ramadan: RamadanSpan?
    struct RamadanSpan: Decodable { let start: Double; let eid: Double }

    struct Worship: Decodable {
        struct Day: Decodable { let day: String; let kept: [String] }
        struct Moment: Decodable { let at: Double; let surah: Int; let ayah: Int; let ref: String; let text: String; let name: String; let nameAr: String }
        let salah: [Day]
        let moments: [Moment]
    }

    struct Ayah: Decodable { let day: String; let surah: Int; let ayah: Int; let to: Int; let ref: String; let text: String; let name: String; let nameAr: String }

    struct Daily: Decodable {
        struct Counter: Decodable { let id: String; let label: String; let n: Int; let total: Int; let atLeast: Bool; let perPrayer: Bool }
        /// `done` counts only adhkar the user confirmed today; `labelAr` is the collection's Arabic name.
        struct Adhkar: Decodable { let key: String; let label: String; var labelAr: String? = nil; let done: Int; let total: Int }
        let day: String
        let counters: [Counter]
        let adhkar: [Adhkar]
    }

    static func load() -> SharedTimeline? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "AyahFlowSharedKeychain") as? String else { return nil }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "app.ayahflow.widget", kSecAttrAccount as String: "timeline", kSecAttrAccessGroup as String: group, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            // Not found just means the app has not shared anything yet; anything else is worth seeing in Console.
            if status != errSecItemNotFound { log.error("Widget timeline read failed: OSStatus \(status, privacy: .public)") }
            return nil
        }
        do {
            var timeline = try JSONDecoder().decode(SharedTimeline.self, from: data)
            // In time order, whatever the app version that wrote it (an Isha after midnight can come after the next Fajr).
            timeline.prayers.sort { $0.at < $1.at }
            return timeline
        } catch {
            log.error("Widget timeline could not be decoded (\(data.count, privacy: .public) bytes): \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}

private extension SharedTimeline.Prayer { var date: Date { Date(timeIntervalSince1970: at / 1000) } }

struct PrayerEntry: TimelineEntry {
    enum State { case ready, noData, stale }
    let date: Date
    let state: State
    let next: SharedTimeline.Prayer?
    /// Start of the interval that ends at `next` (previous prayer, or start of day).
    let since: Date
    /// All five of today's prayers (for the medium and large sizes).
    let today: [SharedTimeline.Prayer]
    let moment: (key: String, label: String)?
    let labels: [String: String]
    let rtl: Bool
    let locale: Locale
    /// Today's dhikr and adhkar, or nil when the app has not shared any for today (counts start again at midnight).
    var daily: SharedTimeline.Daily? = nil
    var page: WidgetPage = .prayer
    /// Today's du'a from the Quran, if the app has shared it.
    var ayah: SharedTimeline.Ayah? = nil
    /// The shown day's prayers the user confirmed in the app (their own note; nothing is inferred).
    var kept: Set<String> = []
    /// The Ayah of the Moment for this entry's half hour.
    var momentAyah: SharedTimeline.Worship.Moment? = nil
    /// The current or next Ramadan and the coming Fridays, fasts and occasions (src/calendar.ts), for the header chip,
    /// the date row and the Coming up page.
    var ramadan: SharedTimeline.RamadanSpan? = nil
    var upcoming: [SharedTimeline.Upcoming] = []
}


private func dayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

struct Provider: TimelineProvider {
    private static func sample() -> PrayerEntry {
        let now = Date(), at = { (h: Double) in now.addingTimeInterval(h * 3600).timeIntervalSince1970 * 1000 }
        let today: [SharedTimeline.Prayer] = [.init(key: "fajr", label: "Fajr", at: at(-8)), .init(key: "dhuhr", label: "Dhuhr", at: at(-2)), .init(key: "asr", label: "Asr", at: at(1.4)), .init(key: "maghrib", label: "Maghrib", at: at(4)), .init(key: "isha", label: "Isha", at: at(5.3))]
        let daily = SharedTimeline.Daily(day: dayKey(now), counters: [.init(id: "istighfar", label: "Istighfar", n: 64, total: 100, atLeast: false, perPrayer: false), .init(id: "istighfar-tawbah", label: "Istighfar and tawbah", n: 20, total: 70, atLeast: true, perPrayer: false), .init(id: "tasbih-prayer", label: "Tasbih after prayer", n: 200, total: 100, atLeast: false, perPrayer: true)], adhkar: [.init(key: "morning", label: "Morning adhkar", labelAr: "أذكار الصباح", done: 4, total: 5), .init(key: "evening", label: "Evening adhkar", labelAr: "أذكار المساء", done: 0, total: 5)])
        return PrayerEntry(date: now, state: .ready, next: today[2], since: today[1].date, today: today, moment: nil, labels: ["next": "Next prayer", "athan": "Athan", "athanOn": "1"], rtl: false, locale: .current, daily: daily, page: .current, ayah: .init(day: dayKey(now), surah: 37, ayah: 100, to: 100, ref: "37:100", text: "رَبِّ هَبْ لِى مِنَ ٱلصَّـٰلِحِينَ", name: "As-Saaffaat", nameAr: "الصافات"), ramadan: SharedTimeline.load()?.ramadan, upcoming: SharedTimeline.load()?.upcoming ?? [])
    }

    func placeholder(in context: Context) -> PrayerEntry { Provider.sample() }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(context.isPreview ? Provider.sample() : entry(at: Date(), SharedTimeline.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let data = SharedTimeline.load(), now = Date()
        // New entries at each prayer, adhkar-window boundary and midnight over the next day, so the widget stays right
        // without the app. Countdowns and progress bars tick by themselves in between.
        var dates = [now]
        if let data {
            let nowMs = now.timeIntervalSince1970 * 1000, horizon = nowMs + 26 * 3600 * 1000
            let midnight = nextDay(Calendar.current.startOfDay(for: now)).timeIntervalSince1970 * 1000
            let bounds = data.prayers.map { $0.at } + data.windows.flatMap { ($0.morning ?? []) + ($0.evening ?? []) } + [midnight]
            dates += Set(bounds.filter { $0 > nowMs && $0 < horizon }).sorted().map { Date(timeIntervalSince1970: $0 / 1000 + 1) }
        }
        completion(Timeline(entries: dates.map { entry(at: $0, data) }, policy: .after(dates.last!.addingTimeInterval(3600))))
    }

    private func entry(at date: Date, _ data: SharedTimeline?) -> PrayerEntry {
        let locale = data?.locale.map { Locale(identifier: $0) } ?? .current
        let daily = data?.daily.flatMap { $0.day == dayKey(date) ? $0 : nil }
        let ayah = data?.ayahs?.first { $0.day == dayKey(date) }
        let kept = Set(data?.worship?.salah.first { $0.day == dayKey(date) }?.kept ?? [])
        func empty(_ s: PrayerEntry.State) -> PrayerEntry { PrayerEntry(date: date, state: s, next: nil, since: date, today: [], moment: nil, labels: data?.labels ?? [:], rtl: data?.rtl ?? false, locale: locale, daily: daily, page: .current, ayah: ayah, kept: kept, ramadan: data?.ramadan, upcoming: data?.upcoming ?? []) }
        guard let data, !data.prayers.isEmpty else { return empty(.noData) }
        let ms = date.timeIntervalSince1970 * 1000
        guard let index = data.prayers.firstIndex(where: { $0.at > ms }) else { return empty(.stale) }
        let next = data.prayers[index]
        let dayStart = Calendar.current.startOfDay(for: date)
        let since = index > 0 ? data.prayers[index - 1].date : dayStart
        let dayEnd = nextDay(dayStart)
        // The day shown is the next prayer's: yesterday while its Isha is still to come after midnight (high latitudes in
        // summer), tomorrow once today's Isha has passed (the app's Home card does the same, src/smart.ts prayerDayView).
        let shownDay = next.day ?? dayKey(date)
        let today = data.prayers.contains { $0.day != nil } ? data.prayers.filter { $0.day == shownDay } : data.prayers.filter { $0.date >= dayStart && $0.date < dayEnd }
        let keptShown = Set(data.worship?.salah.first { $0.day == shownDay }?.kept ?? [])
        let inside = { (w: [Double]?) in w.map { $0.count == 2 && ms >= $0[0] && ms < $0[1] } ?? false }
        let moment: (key: String, label: String)? = data.windows.contains { inside($0.morning) } ? (key: "morning", label: data.labels["morning"] ?? "Morning adhkar")
            : data.windows.contains { inside($0.evening) } ? (key: "evening", label: data.labels["evening"] ?? "Evening adhkar") : nil
        return PrayerEntry(date: date, state: .ready, next: next, since: max(since, next.date.addingTimeInterval(-12 * 3600)), today: today.isEmpty ? Array(data.prayers[index...].prefix(5)) : today, moment: moment, labels: data.labels, rtl: data.rtl, locale: locale, daily: daily, page: .current, ayah: ayah, kept: keptShown, ramadan: data.ramadan, upcoming: data.upcoming ?? [])
    }
}

/// The start of the next calendar day: 23 or 25 hours later when the clocks change, never a fixed 86,400 seconds.
private func nextDay(_ dayStart: Date) -> Date {
    Calendar.current.date(byAdding: .day, value: 1, to: dayStart) ?? Calendar.current.startOfDay(for: dayStart.addingTimeInterval(36 * 3600))
}

/// The Ayah of the Moment, worked out inside the extension from the bundled pool (AyahMoments.json: the app's corpus text
/// and order, generated by scripts/build.mjs), so the widget keeps changing every half hour for as long as it runs, without
/// the app. The same arithmetic as src/worship.ts slotOf: 30-minute slots counted in elapsed time from 2000-01-01 00:00
/// standard local time, so a daylight saving change neither skips nor repeats a slot, and slots still start at :00 and :30.
enum MomentClock {
    struct Entry: Decodable {
        let surah: Int, ayah: Int, text: String, name: String, nameAr: String
        init(from decoder: Decoder) throws {
            var c = try decoder.unkeyedContainer()
            surah = try c.decode(Int.self); ayah = try c.decode(Int.self); text = try c.decode(String.self); name = try c.decode(String.self); nameAr = try c.decode(String.self)
        }
    }
    private struct Pool: Decodable { let v: Int; let slotMinutes: Int; let ayahs: [Entry] }
    static let length: TimeInterval = 1800, epoch: TimeInterval = 946_684_800 // 2000-01-01T00:00Z
    /// Empty if the file is missing or in an unknown format; the widget then falls back to the slots the app shared.
    static let pool: [Entry] = {
        guard let url = Bundle.main.url(forResource: "AyahMoments", withExtension: "json"), let data = try? Data(contentsOf: url),
              let p = try? JSONDecoder().decode(Pool.self, from: data), p.v == 1, p.slotMinutes == 30 else { return [] }
        return p.ayahs
    }()
    /// The time zone's standard-time offset in the year of `date`: the smaller of its January and July offsets.
    static func standardOffset(_ date: Date, _ zone: TimeZone = .current) -> TimeInterval {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
        let year = calendar.component(.year, from: date)
        let offsets = [1, 7].compactMap { calendar.date(from: DateComponents(year: year, month: $0, day: 1)) }.map { zone.secondsFromGMT(for: $0) }
        return TimeInterval(offsets.min() ?? zone.secondsFromGMT(for: date))
    }
    static func slot(_ date: Date, _ zone: TimeZone = .current) -> Int { Int(((date.timeIntervalSince1970 + standardOffset(date, zone) - epoch) / length).rounded(.down)) }
    static func start(_ slot: Int, _ zone: TimeZone = .current) -> Date {
        let local = epoch + Double(slot) * length
        let first = local - standardOffset(Date(timeIntervalSince1970: local), zone)
        return Date(timeIntervalSince1970: local - standardOffset(Date(timeIntervalSince1970: first), zone))
    }
    static func moment(_ slot: Int, _ zone: TimeZone = .current) -> SharedTimeline.Worship.Moment? {
        guard !pool.isEmpty else { return nil }
        let e = pool[((slot % pool.count) + pool.count) % pool.count]
        return .init(at: start(slot, zone).timeIntervalSince1970 * 1000, surah: e.surah, ayah: e.ayah, ref: "\(e.surah):\(e.ayah)", text: e.text, name: e.name, nameAr: e.nameAr)
    }
}

/// The Ayah of the Moment: one entry per half hour for the next day, worked out here (MomentClock), then a fresh timeline
/// once that runs out: about one reload a day, well within WidgetKit's budget. WidgetKit decides exactly when a widget
/// redraws, so a change can show a little after the half hour. Falls back to the slots the app shared if the pool is missing.
struct MomentProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry { sample() }
    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) { completion(context.isPreview ? sample() : entries(SharedTimeline.load(), Date()).first!) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let list = entries(SharedTimeline.load(), Date())
        completion(Timeline(entries: list, policy: .atEnd))
    }
    private func sample() -> PrayerEntry {
        PrayerEntry(date: Date(), state: .ready, next: nil, since: Date(), today: [], moment: nil, labels: ["momentTab": "Ayah of the moment"], rtl: false, locale: .current, momentAyah: .init(at: Date().timeIntervalSince1970 * 1000, surah: 94, ayah: 6, ref: "94:6", text: "إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا", name: "Ash-Sharh", nameAr: "الشرح"))
    }
    private func entries(_ data: SharedTimeline?, _ now: Date) -> [PrayerEntry] {
        let locale = data?.locale.map { Locale(identifier: $0) } ?? .current, nowMs = now.timeIntervalSince1970 * 1000
        func make(_ date: Date, _ m: SharedTimeline.Worship.Moment?) -> PrayerEntry { PrayerEntry(date: date, state: m == nil ? .noData : .ready, next: nil, since: date, today: [], moment: nil, labels: data?.labels ?? [:], rtl: data?.rtl ?? false, locale: locale, momentAyah: m) }
        if !MomentClock.pool.isEmpty {
            let first = MomentClock.slot(now)
            return [make(now, MomentClock.moment(first))] + (1..<48).compactMap { i in MomentClock.moment(first + i).map { make(Date(timeIntervalSince1970: $0.at / 1000), $0) } }
        }
        let moments = data?.worship?.moments ?? []
        let current = moments.last { $0.at <= nowMs }
        let upcoming = moments.filter { $0.at > nowMs }
        return [make(now, current)] + upcoming.map { make(Date(timeIntervalSince1970: $0.at / 1000), $0) }
    }
}

// MARK: - Design system (approved 2026-11-08: deep emerald, warm cream, soft gold)

private extension UIColor {
    convenience init(rgb: UInt32) { self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255, green: CGFloat((rgb >> 8) & 0xFF) / 255, blue: CGFloat(rgb & 0xFF) / 255, alpha: 1) }
}
/// A colour for each appearance: warm cream in light mode, a deep green-black in dark mode, so the widget sits well on
/// either Home Screen. Resolved by WidgetKit with the widget's own colour scheme.
private func tone(_ light: UInt32, _ dark: UInt32) -> Color { Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light) }) }

private enum Palette {
    /// The page: cream / green-black.
    static let bg = tone(0xF6EEDC, 0x0F1712)
    /// Raised cream (the Today's adhkar strip) / raised dark.
    static let panel = tone(0xFBF6EA, 0x18221B)
    static let line = tone(0xDCCFB2, 0x2B3A2F)
    /// Gold for text and marks, darker on cream so it keeps its contrast.
    static let gold = tone(0x93692A, 0xD9BB79)
    static let goldBright = tone(0x7A5518, 0xEFDCAD)
    static let text = tone(0x1C2A21, 0xF3F0E7)
    static let muted = tone(0x5F6A5B, 0xA7AD9F)
    static let green = tone(0x2F6B45, 0xA6C5A5)
    /// The next prayer's row.
    static let highlight = tone(0xDCE4C8, 0x23402F)
    // The emerald header and arch panels look the same in both appearances.
    static let emerald = Color(UIColor(rgb: 0x0F3D2E))
    static let emeraldDeep = Color(UIColor(rgb: 0x082519))
    static let onEmerald = Color(UIColor(rgb: 0xF4ECD8))
    static let onEmeraldMuted = Color(UIColor(rgb: 0xB7C2AF))
    static let leaf = Color(UIColor(rgb: 0xD8B56C))
    static let leafLight = Color(UIColor(rgb: 0xEFD293))
    static let ink = Color(UIColor(rgb: 0x1B271E))
    /// The cream of the Du'a picture, and the gold that reads on it.
    static let cream = Color(UIColor(rgb: 0xF7EFDD))
    static let inkGold = Color(UIColor(rgb: 0x765214))
}

private extension View {
    /// Marks the part that takes the accent colour in the tinted look (iOS 16+).
    @ViewBuilder func accent() -> some View { if #available(iOSApplicationExtension 16.0, *) { self.widgetAccentable() } else { self } }
}

private func number(_ n: Int, _ locale: Locale) -> String { let f = NumberFormatter(); f.locale = locale; f.numberStyle = .decimal; return f.string(from: NSNumber(value: n)) ?? String(n) }

/// True when the widget is drawn in full colour; false for the tinted and clear looks (iOS 18+), where filled panels
/// are left out and only outlines, text and accents remain.
private struct FullColor<Content: View>: View {
    @ViewBuilder let content: (Bool) -> Content
    var body: some View {
        if #available(iOSApplicationExtension 16.0, *) { Reader(content: content) } else { content(true) }
    }
    @available(iOSApplicationExtension 16.0, *)
    private struct Reader: View {
        @Environment(\.widgetRenderingMode) var mode
        let content: (Bool) -> Content
        var body: some View { content(mode == .fullColor) }
    }
}

/// The system's content margins (iOS 17+), or the classic 16 pt.
private struct Margins<Content: View>: View {
    @ViewBuilder let content: (EdgeInsets) -> Content
    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) { Reader(content: content) } else { content(EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)) }
    }
    @available(iOSApplicationExtension 17.0, *)
    private struct Reader: View {
        @Environment(\.widgetContentMargins) var margins
        let content: (EdgeInsets) -> Content
        var body: some View { content(margins) }
    }
}

/// A mosque arch: straight sides, rounded shoulders rising to a gentle point.
private struct ArchShape: Shape {
    var shoulder: CGFloat = 0.3
    func path(in r: CGRect) -> Path {
        let s = min(r.height * shoulder, r.width * 0.55), mid = r.midX
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.minY + s))
        p.addCurve(to: CGPoint(x: mid, y: r.minY), control1: CGPoint(x: r.minX, y: r.minY + s * 0.35), control2: CGPoint(x: mid - r.width * 0.18, y: r.minY + s * 0.12))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + s), control1: CGPoint(x: mid + r.width * 0.18, y: r.minY + s * 0.12), control2: CGPoint(x: r.maxX, y: r.minY + s * 0.35))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// Eight-pointed stars on a square lattice: the faint geometric pattern of the header band.
private struct StarLattice: Shape {
    var cell: CGFloat = 18
    func path(in r: CGRect) -> Path {
        var p = Path()
        let k = cell * 0.22
        var y = r.minY + cell / 2
        while y < r.maxY + cell {
            var x = r.minX + cell / 2
            while x < r.maxX + cell {
                p.addRect(CGRect(x: x - k, y: y - k, width: 2 * k, height: 2 * k))
                p.addPath(Path(CGRect(x: -k, y: -k, width: 2 * k, height: 2 * k)).applying(CGAffineTransform(rotationAngle: .pi / 4).concatenating(CGAffineTransform(translationX: x, y: y))))
                x += cell
            }
            y += cell
        }
        return p
    }
}

/// A crescent: a disc with a smaller offset disc taken out.
private struct Crescent: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path(ellipseIn: r)
        p.addPath(Path(ellipseIn: r.offsetBy(dx: r.width * 0.3, dy: -r.height * 0.12).insetBy(dx: r.width * 0.06, dy: r.height * 0.06)))
        return p
    }
}

/// A mosque silhouette: a dome on a hall, two minarets.
private struct MosqueShape: Shape {
    func path(in r: CGRect) -> Path {
        let w = r.width, h = r.height
        var p = Path()
        let hall = CGRect(x: r.minX + w * 0.2, y: r.minY + h * 0.55, width: w * 0.6, height: h * 0.45)
        p.addRect(hall)
        p.addEllipse(in: CGRect(x: r.minX + w * 0.3, y: r.minY + h * 0.2, width: w * 0.4, height: h * 0.55))
        p.addRect(CGRect(x: r.minX + w * 0.49, y: r.minY + h * 0.08, width: w * 0.02, height: h * 0.14))
        for x in [w * 0.04, w * 0.88] {
            p.addRect(CGRect(x: r.minX + x, y: r.minY + h * 0.18, width: w * 0.08, height: h * 0.82))
            p.addEllipse(in: CGRect(x: r.minX + x - w * 0.005, y: r.minY + h * 0.1, width: w * 0.09, height: h * 0.12))
        }
        return p
    }
}

/// The Kaaba: a block with its gold band.
private struct KaabaArt: View {
    var body: some View {
        ZStack(alignment: .top) {
            RoundedRectangle(cornerRadius: 1.5).fill(Color.black.opacity(0.85))
            Rectangle().fill(Palette.leaf).frame(height: 2.5).padding(.top, 5)
        }.frame(width: 26, height: 24)
    }
}

/// Prayer beads in a ring.
private struct BeadsArt: View {
    var body: some View {
        ZStack {
            ForEach(0..<16, id: \.self) { i in
                Circle().fill(Palette.leaf).frame(width: 4.2, height: 4.2)
                    .offset(x: 12 * cos(Double(i) / 16 * 2 * .pi), y: 12 * sin(Double(i) / 16 * 2 * .pi))
            }
            Capsule().fill(Palette.leaf).frame(width: 2.5, height: 9).offset(y: 17)
        }.frame(width: 30, height: 36)
    }
}

/// The illustrated backgrounds (Backgrounds.xcassets, the approved 1200 × 675 JPEGs). They are decoration only: every
/// word, time, countdown and count is drawn over them by SwiftUI, and they are left out in the tinted and clear looks and
/// with Increase Contrast. Only the eight the widget uses are in its catalog (the Home and Hifz art ship in the app alone).
enum Art: String, CaseIterable {
    case fajr = "fajr_dawn", dhuhr = "dhuhr_daylight", asr = "asr_afternoon", maghrib = "maghrib_sunset", isha = "isha_night"
    case dhikr = "dhikr_tasbih", moments = "daily_moments", dua = "quran_dua"
    /// The scene for the next prayer (after Isha that is tomorrow's Fajr, which is simply the next prayer's key).
    static func prayer(_ key: String) -> Art? {
        switch key { case "fajr": return .fajr; case "dhuhr": return .dhuhr; case "asr": return .asr; case "maghrib": return .maghrib; case "isha": return .isha; default: return nil }
    }
    /// Scrim over the picture, chosen per picture so text keeps at least 4.5:1 where it crosses the scene (measured by
    /// scripts/art-contrast.swift; keep the two in step). Daylight needs the most.
    var scrim: Double {
        switch self { case .fajr: return 0.3; case .dhuhr: return 0.66; case .asr: return 0.45; case .maghrib: return 0.35; case .isha: return 0.25; case .dhikr: return 0.35; case .moments: return 0.3; case .dua: return 0.45 }
    }
    /// The light pictures (midday, the cream du'a) fill their arch like paper and take dark text; the others are a
    /// window along the bottom of an emerald arch.
    var light: Bool { self == .dua || self == .dhuhr }
}

/// A dark scene as a window along the bottom of the arch: the whole picture across the width (its printed frame trimmed
/// off the sides), anchored at the bottom and fading in from the emerald above, so the mosque sits beside the centred
/// text rather than under it. Never mirrored in Arabic: a scene is not text.
private struct ArtWindow: View {
    let art: Art
    var body: some View {
        GeometryReader { g in
            let w = g.size.width / 0.9, h = w * 675 / 1200
            Image(art.rawValue).resizable().interpolation(.medium).frame(width: w, height: h)
                .overlay(Palette.emeraldDeep.opacity(art.scrim))
                .mask(LinearGradient(stops: [.init(color: .clear, location: 0.3), .init(color: .black, location: 0.62)], startPoint: .top, endPoint: .bottom))
                .offset(x: (g.size.width - w) / 2, y: g.size.height - h)
        }
        .environment(\.layoutDirection, .leftToRight)
        .clipped()
        .accessibilityHidden(true)
    }
}

/// A light picture filling its frame like paper: enlarged and anchored at the bottom right, where its mosque is, so the
/// arch printed at the top of the picture stays out of the crop; a cream scrim keeps dark text above 4.5:1.
private struct ArtPaper: View {
    let art: Art
    var body: some View {
        GeometryReader { g in
            let h = max(g.size.height * 1.95, g.size.width * 675 / 1200 / 0.9), w = h * 1200 / 675, edge = w * 0.04
            Image(art.rawValue).resizable().interpolation(.medium).frame(width: w, height: h)
                .offset(x: min(max(g.size.width / 2 - 0.8 * w, g.size.width - w + edge), -edge), y: g.size.height - h * 0.93)
            LinearGradient(stops: [.init(color: Palette.cream.opacity(art.scrim), location: 0), .init(color: Palette.cream.opacity(art.scrim), location: 0.82), .init(color: Palette.cream.opacity(art.scrim * 0.25), location: 1)], startPoint: .top, endPoint: .bottom)
        }
        .environment(\.layoutDirection, .leftToRight)
        .clipped()
        .accessibilityHidden(true)
    }
}

/// Text colours inside an arch: cream and gold on emerald or a dark scene, ink and dark gold on a light one.
private struct ArchInk {
    let light: Bool
    init(_ art: Art?) { light = art?.light == true }
    var title: Color { light ? Palette.ink : Palette.onEmerald }
    var label: Color { light ? Palette.inkGold : Palette.leafLight }
    var tag: Color { light ? Palette.inkGold : Palette.leaf }
}

private struct ArtBackdrop: View {
    let art: Art
    var body: some View { if art.light { ArtPaper(art: art) } else { ArtWindow(art: art) } }
}

/// Passes the picture on only when it should be drawn: full colour (decided by the caller), Increase Contrast off, and
/// the image present. Otherwise the plain emerald arch is the fallback.
private struct ArtGate<Content: View>: View {
    @Environment(\.colorSchemeContrast) private var contrast
    let art: Art?
    @ViewBuilder let content: (Art?) -> Content
    var body: some View { content(art.flatMap { contrast == .increased || UIImage(named: $0.rawValue) == nil ? nil : $0 }) }
}

/// The arch panel on the leading side of each page: emerald, a gold outline, a small ornament at the apex and the
/// page's illustration. `content` is told whether the picture is shown (a cream picture takes dark text).
private struct ArchPanel<Content: View>: View {
    var width: CGFloat
    var art: Art? = nil
    @ViewBuilder let content: (Art?) -> Content
    var body: some View {
        FullColor { full in
            ArtGate(art: full ? art : nil) { shown in
                ZStack {
                    if full {
                        ArchShape().fill(LinearGradient(colors: [Palette.emerald, Palette.emeraldDeep], startPoint: .top, endPoint: .bottom))
                        if let shown { ArtBackdrop(art: shown).clipShape(ArchShape()) }
                        ArchShape().stroke(Palette.leaf.opacity(0.75), lineWidth: 1).padding(3)
                    } else {
                        ArchShape().stroke(Palette.leaf.opacity(0.6), lineWidth: 1)
                    }
                    content(shown).padding(.horizontal, 6).padding(.top, 12).padding(.bottom, 6)
                }
            }
        }.frame(width: width)
    }
}

extension ArchPanel {
    /// A panel without a picture.
    init(width: CGFloat, @ViewBuilder content: @escaping () -> Content) { self.init(width: width, art: nil) { _ in content() } }
}

/// "—◆—", the gold mark under the apex.
private struct Ornament: View {
    var crescent = false
    var body: some View {
        HStack(spacing: 3) {
            Rectangle().fill(Palette.leaf.opacity(0.7)).frame(width: 12, height: 0.8)
            if crescent { Crescent().fill(Palette.leaf, style: FillStyle(eoFill: true)).frame(width: 8, height: 8) }
            else { Rectangle().fill(Palette.leaf).frame(width: 4, height: 4).rotationEffect(.degrees(45)) }
            Rectangle().fill(Palette.leaf.opacity(0.7)).frame(width: 12, height: 0.8)
        }.accessibilityHidden(true)
    }
}

/// A small progress ring for the Dhikr rows.
private struct MiniRing: View {
    let value: Double
    var done = false
    var size: CGFloat = 15
    var body: some View {
        ZStack {
            Circle().stroke(Palette.line, lineWidth: 2.2)
            if value > 0 || done { Circle().trim(from: 0, to: done ? 1 : min(1, value)).stroke(done ? Palette.green : Palette.gold, style: StrokeStyle(lineWidth: 2.2, lineCap: .round)).rotationEffect(.degrees(-90)) }
            if done { Image(systemName: "checkmark").font(.system(size: size * 0.45, weight: .bold)).foregroundColor(Palette.green) }
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}

/// A progress ring with content in the middle.
private struct Ring<Inner: View>: View {
    let value: Double
    var color: Color = Palette.gold
    var track: Color = Palette.line
    var width: CGFloat = 6
    @ViewBuilder let inner: () -> Inner
    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: width)
            if value > 0 { Circle().trim(from: 0, to: min(1, value)).stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round)).rotationEffect(.degrees(-90)) }
            inner()
        }
    }
}

private func formatted(_ date: Date, _ locale: Locale, hijri: Bool) -> String {
    let f = DateFormatter()
    f.locale = locale
    if hijri { f.calendar = Calendar(identifier: .islamicUmmAlQura); f.setLocalizedDateFormatFromTemplate("d MMMM y") }
    else { f.setLocalizedDateFormatFromTemplate("EEEE d MMMM") }
    return f.string(from: date)
}

// MARK: - Shared reading of the entry

/// What every page derives from the entry: Ramadan, occasions, today's adhkar, counters. Nothing is computed that the
/// app did not share, apart from the day arithmetic.
private struct EntryInfo {
    let entry: PrayerEntry
    var l: [String: String] { entry.labels }
    var phase: RamadanPhase? { RamadanPhase.of(entry.ramadan, on: entry.date) }
    func num(_ n: Int) -> String { number(n, entry.locale) }
    /// "day" / "days", with the Arabic forms for 1, 2, 3-10 and 11+.
    func dayWord(_ n: Int) -> String {
        let ar = entry.locale.identifier.hasPrefix("ar")
        return n == 1 ? (l["wDay1"] ?? "day") : ar && n == 2 ? (l["wDay2"] ?? "days") : ar && n <= 10 ? (l["wDayFew"] ?? "days") : (l["wDayMany"] ?? "days")
    }
    func daysFrom(_ ms: Double) -> Int { let c = Calendar.current; return c.dateComponents([.day], from: c.startOfDay(for: entry.date), to: c.startOfDay(for: Date(timeIntervalSince1970: ms / 1000))).day ?? 0 }
    func inDays(_ n: Int) -> String { n <= 0 ? (l["wToday"] ?? "Today") : n == 1 ? (l["wTomorrow"] ?? "Tomorrow") : "\(num(n)) \(dayWord(n))" }
    var iftar: String? {
        guard let m = entry.today.first(where: { $0.key == "maghrib" }), Calendar.current.isDate(m.date, inSameDayAs: entry.date) else { return nil }
        let f = DateFormatter(); f.locale = entry.locale; f.setLocalizedDateFormatFromTemplate("jmm"); return f.string(from: m.date)
    }
    var coming: [SharedTimeline.Upcoming] { let start = Calendar.current.startOfDay(for: entry.date).timeIntervalSince1970 * 1000; return entry.upcoming.filter { $0.at >= start }.sorted { $0.at < $1.at } }
    /// Header chip: the days until Ramadan, or the day of Ramadan with today's iftar (long) or alone (short).
    func ramadanText(short: Bool) -> String? {
        guard let p = phase else { return nil }
        switch p {
        case let .before(n, _): return short ? "\(num(n)) \(dayWord(n))" : "\(l["wRamadanDay"] ?? "Ramadan") · \(num(n)) \(dayWord(n))"
        case let .during(d, _): return "\(l["wDayWord"] ?? "Day") \(num(d))" + (short ? "" : iftar.map { " · \(l["wIftar"] ?? "Iftar") \($0)" } ?? "")
        }
    }
    func counter(_ id: String) -> SharedTimeline.Daily.Counter? { entry.daily?.counters.first { $0.id == id } }
    func adhkar(_ key: String) -> SharedTimeline.Daily.Adhkar? { entry.daily?.adhkar.first { $0.key == key } }
    /// The adhkar of the moment: the open morning or evening window; else before sleep from the chosen sleep time until
    /// 03:00; else morning before noon and evening after.
    var adhkarKey: String {
        if let m = entry.moment { return m.key }
        let c = Calendar.current, h = c.component(.hour, from: entry.date), minutes = h * 60 + c.component(.minute, from: entry.date)
        if let at = l["sleepAt"], at.count == 5, let sh = Int(at.prefix(2)), let sm = Int(at.suffix(2)), minutes >= sh * 60 + sm || h < 3 { return "sleep" }
        return h < 12 ? "morning" : "evening"
    }
}

// MARK: - Medium widget: five pages under one row of tabs

/// The pages of the medium widget. The chosen page is kept in the widget extension's own defaults.
enum WidgetPage: Int, CaseIterable {
    // Raw values are saved (the chosen page), so a page is only ever added at the end; `order` is how the tabs are shown.
    // 2 was the step page until the step tracker was removed (v29): a widget left on it now shows Daily moments.
    case prayer, dhikr, moments, ayah, upcoming
    static let order: [WidgetPage] = [.prayer, .upcoming, .dhikr, .moments, .ayah]
    static var current: WidgetPage { WidgetPage(rawValue: UserDefaults.standard.integer(forKey: "widgetPage")) ?? .prayer }
    var symbol: String { switch self { case .prayer: return "moon.stars"; case .upcoming: return "clock"; case .dhikr: return "circle.dotted"; case .moments: return "door.left.hand.open"; case .ayah: return "book" } }
    func label(_ labels: [String: String]) -> String {
        switch self {
        case .prayer: return labels["prayerTab"] ?? "Prayer"
        case .upcoming: return labels["upcomingShort"] ?? "Upcoming"
        case .dhikr: return labels["dhikrTab"] ?? "Dhikr"
        case .moments: return labels["momentsTab"] ?? "Moments"
        case .ayah: return labels["quranTab"] ?? "Quran"
        }
    }
}

#if canImport(AppIntents)
/// Tapping a tab in the widget switches page without opening the app (iOS 17 interactive widgets).
@available(iOS 17.0, *)
struct ShowWidgetPage: AppIntent {
    static var title: LocalizedStringResource = "Show widget page"
    static var isDiscoverable = false
    @Parameter(title: "Page") var page: Int
    init() {}
    init(_ page: WidgetPage) { self.page = page.rawValue }
    func perform() async throws -> some IntentResult {
        UserDefaults.standard.set(page, forKey: "widgetPage")
        return .result()
    }
}
#endif

/// The emerald band across the top: brand, the Ramadan chip and the tabs. Each layout is tried whole, widest first, so
/// the selected tab's label is never cut: the wordmark and the chip give way first.
private struct HeaderBar: View {
    let info: EntryInfo
    var tabs = true
    var trailing: AnyView? = nil
    private var page: WidgetPage { info.entry.page }
    var body: some View {
        if #available(iOSApplicationExtension 16.0, *) {
            // The wordmark comes before the Ramadan chip, which also shows on the Upcoming page.
            ViewThatFits(in: .horizontal) {
                row(mark: true, chip: false, divider: true)
                row(mark: true, chip: true, divider: true)
                row(mark: true, chip: true, divider: false)
                row(mark: true, chip: nil, divider: false)
                row(mark: false, chip: true, divider: false)
                row(mark: false, chip: nil, divider: false)
            }
        } else { row(mark: true, chip: nil, divider: false) }
    }
    /// `chip`: false = the long text, true = the short one, nil = no chip.
    private func row(mark: Bool, chip: Bool?, divider: Bool) -> some View {
        HStack(spacing: 6) {
            if mark { wordmark }
            if let chip, let text = info.ramadanText(short: chip) { ramadanChip(text) }
            Spacer(minLength: 2)
            if divider && tabs { Rectangle().fill(Palette.leaf.opacity(0.35)).frame(width: 0.8, height: 16).accessibilityHidden(true) }
            if tabs { tabRow } else if let trailing { trailing }
        }
    }
    private var wordmark: some View {
        (Text("Ayah").foregroundColor(Palette.onEmerald) + Text("Flow").foregroundColor(Palette.leafLight))
            .font(.system(size: 14.5, weight: .semibold, design: .serif)).lineLimit(1).fixedSize()
            .accessibilityLabel("AyahFlow")
    }
    private func ramadanChip(_ text: String) -> some View {
        HStack(spacing: 3) { Image(systemName: "moon").font(.system(size: 8.5, weight: .semibold)); Text(text) }
            .font(.system(size: 9.5, weight: .semibold)).foregroundColor(Palette.leafLight).lineLimit(1).fixedSize()
            .padding(.horizontal, 6).padding(.vertical, 3).overlay(Capsule().stroke(Palette.leaf.opacity(0.55), lineWidth: 0.8))
            .accessibilityElement(children: .ignore).accessibilityLabel("\(info.ramadanText(short: false) ?? text). \(info.l["wSighting"] ?? "Umm al-Qura")")
    }
    @ViewBuilder private var tabRow: some View {
        #if canImport(AppIntents)
        if #available(iOSApplicationExtension 17.0, *) {
            // Laid out left to right with the order reversed for Arabic: the same look as a mirrored row, but the tap
            // targets stay where the tabs are drawn (in a right-to-left environment the buttons did not respond).
            HStack(spacing: 2) {
                ForEach(info.entry.rtl ? WidgetPage.order.reversed() : WidgetPage.order, id: \.rawValue) { p in
                    let on = p == page
                    Button(intent: ShowWidgetPage(p)) {
                        // Full colour: a gold capsule with dark text. Tinted or clear: an outline, so the label stays readable.
                        FullColor { full in
                            HStack(spacing: 3) {
                                // The row is laid out left to right (see above), so the icon goes after the label in Arabic.
                                if on && info.entry.rtl { Text(p.label(info.l)).font(.system(size: 10, weight: .semibold)).lineLimit(1).fixedSize() }
                                Image(systemName: p.symbol).font(.system(size: 10, weight: .semibold))
                                if on && !info.entry.rtl { Text(p.label(info.l)).font(.system(size: 10, weight: .semibold)).lineLimit(1).fixedSize() }
                            }
                            .foregroundColor(on ? (full ? Palette.ink : Palette.onEmerald) : Palette.onEmeraldMuted)
                            .padding(.horizontal, on ? 7 : 0).frame(minWidth: 21, minHeight: 21)
                            .background(Group {
                                if on && full { Capsule().fill(LinearGradient(colors: [Palette.leafLight, Palette.leaf], startPoint: .top, endPoint: .bottom)) }
                                else if on { Capsule().stroke(Palette.onEmerald, lineWidth: 1.2) }
                                else { Capsule().fill(Color.white.opacity(0.07)) }
                            })
                            .widgetAccentable(on)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(p.label(info.l))
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }.fixedSize().environment(\.layoutDirection, .leftToRight)
        }
        #endif
    }
}

/// The emerald band with its faint star lattice (left out in the tinted and clear looks).
private struct Band: View {
    var body: some View {
        FullColor { full in
            if full {
                ZStack {
                    LinearGradient(colors: [Palette.emerald, Palette.emeraldDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
                    StarLattice().stroke(Palette.leaf.opacity(0.09), lineWidth: 0.6)
                    VStack { Spacer(); Rectangle().fill(Palette.leaf.opacity(0.55)).frame(height: 0.8) }
                }.clipped()
            } else {
                VStack { Spacer(); Rectangle().fill(Palette.leaf.opacity(0.5)).frame(height: 0.8) }
            }
        }.accessibilityHidden(true)
    }
}

struct MediumWidget: View {
    let entry: PrayerEntry
    private var info: EntryInfo { EntryInfo(entry: entry) }
    var body: some View {
        Margins { m in
            VStack(spacing: 0) {
                HeaderBar(info: info, tabs: tabsAvailable)
                    .padding(.leading, max(12, m.leading - 2)).padding(.trailing, max(10, m.trailing - 6))
                    .padding(.top, max(8, m.top * 0.55)).padding(.bottom, 6)
                    .background(Band())
                page
                    .padding(.leading, m.leading).padding(.trailing, m.trailing)
                    .padding(.top, 7).padding(.bottom, max(8, m.bottom * 0.6))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }
    private var tabsAvailable: Bool { if #available(iOSApplicationExtension 17.0, *) { return true }; return false }
    @ViewBuilder private var page: some View {
        switch tabsAvailable ? entry.page : .prayer {
        case .prayer: PrayerPage(info: info)
        case .upcoming: UpcomingPage(info: info)
        case .dhikr: DhikrPage(info: info)
        case .moments: MomentsPage(info: info)
        case .ayah: QuranPage(entry: entry)
        }
    }
}

// MARK: Page 1: Prayer

private struct PrayerPage: View {
    let info: EntryInfo
    var large = false
    private var entry: PrayerEntry { info.entry }
    var body: some View {
        if entry.state != .ready || entry.next == nil {
            HStack(spacing: 10) {
                ArchPanel(width: 92) { VStack(spacing: 6) { Ornament(); Crescent().fill(Palette.leaf, style: FillStyle(eoFill: true)).frame(width: 18, height: 18); Spacer(minLength: 0); MosqueShape().fill(Palette.leaf.opacity(0.35)).frame(width: 56, height: 30) } }
                Text(entry.state == .stale ? (info.l["stale"] ?? "Open AyahFlow to refresh prayer times.") : (info.l["noPlace"] ?? "Save Home in AyahFlow to see prayer times."))
                    .font(.system(size: 12)).foregroundColor(Palette.muted).frame(maxWidth: .infinity, alignment: .leading)
            }
        } else if let next = entry.next {
            HStack(alignment: .top, spacing: 10) {
                nextPanel(next)
                if #available(iOSApplicationExtension 16.0, *) {
                    ViewThatFits(in: .vertical) {
                        VStack(spacing: large ? 8 : 3) { rows(next); AdhkarStrip(info: info) }
                        rows(next)
                    }
                } else { rows(next) }
            }
        }
    }
    private func nextPanel(_ next: SharedTimeline.Prayer) -> some View {
        // The scene of the next prayer: dawn for Fajr (also tomorrow's Fajr after Isha), daylight, afternoon, sunset, night.
        ArchPanel(width: large ? 128 : 112, art: Art.prayer(next.key)) { shown in
            let ink = ArchInk(shown)
            VStack(spacing: large ? 4 : 1) {
                if tomorrow(next) {
                    Text(info.l["wTomorrow"] ?? "Tomorrow").font(.system(size: 8, weight: .semibold)).foregroundColor(ink.tag).lineLimit(1)
                } else { Ornament(crescent: true) }
                Text((info.l["next"] ?? "Next prayer").uppercased()).font(.system(size: 7.5, weight: .semibold)).kerning(info.entry.rtl ? 0 : 1.1).foregroundColor(ink.label).lineLimit(1).minimumScaleFactor(0.8)
                Text(next.label).font(.system(size: large ? 30 : 21, weight: .regular, design: .serif)).foregroundColor(ink.title).lineLimit(1).minimumScaleFactor(0.7).accent()
                Text(next.date, style: .time).font(.system(size: large ? 19 : 14, weight: .semibold, design: .serif)).foregroundColor(ink.label).monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
                Text(next.date, style: .timer).font(.system(size: 9.5).monospacedDigit()).foregroundColor(shown == nil ? Palette.onEmeraldMuted : ink.title).multilineTextAlignment(.center).lineLimit(1)
                Spacer(minLength: 0)
            }
            .background(alignment: .bottom) { if shown == nil { MosqueShape().fill(Palette.leaf.opacity(0.11)).frame(width: 78, height: 30).offset(y: 6).accessibilityHidden(true) } }
        }
        .accessibilityElement(children: .combine)
    }
    /// After Isha the next prayer is tomorrow's Fajr, and the list shows tomorrow's times (as the app's Home card does).
    private func tomorrow(_ next: SharedTimeline.Prayer) -> Bool { (next.day ?? dayKey(next.date)) > dayKey(entry.date) }
    private func rows(_ next: SharedTimeline.Prayer) -> some View {
        let shownDay = entry.today.first?.day ?? dayKey(entry.date)
        return VStack(spacing: large ? 5 : 0.5) {
            ForEach(entry.today, id: \.at) { p in
                let isNext = p.at == next.at, past = p.date <= entry.date
                HStack(spacing: 4) {
                    Text(p.label).fontWeight(isNext ? .semibold : .regular).foregroundColor(isNext ? Palette.text : Palette.text.opacity(past ? 0.5 : 0.85))
                    if entry.kept.contains(p.key) && (p.day ?? dayKey(p.date)) == shownDay {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 9)).foregroundColor(Palette.green).accessibilityLabel(info.l["prayed"] ?? "prayed")
                    }
                    Spacer(minLength: 4)
                    Text(p.date, style: .time).monospacedDigit().fontWeight(isNext ? .semibold : .regular).foregroundColor(isNext ? Palette.goldBright : Palette.muted.opacity(past ? 0.7 : 1))
                }
                .font(.system(size: large ? 15 : 11, design: large ? .serif : .default)).lineLimit(1)
                .padding(.horizontal, 7).padding(.vertical, large ? 3 : 1)
                .background(FullColor { full in
                    if isNext { if full { Capsule().fill(Palette.highlight) } else { Capsule().stroke(Palette.text.opacity(0.6), lineWidth: 1) } }
                })
            }
        }
    }
}

/// "Today's adhkar": the collection for this moment, its confirmed progress, and its Arabic name; tapping opens it.
private struct AdhkarStrip: View {
    let info: EntryInfo
    var body: some View {
        let key = info.adhkarKey, a = info.adhkar(key)
        let name = a?.label ?? info.l[key == "sleep" ? "m_sleep" : key] ?? (key == "morning" ? "Morning adhkar" : key == "evening" ? "Evening adhkar" : "Before sleep")
        Link(destination: URL(string: "ayahflow://moment/\(key)")!) {
            Group {
                // Both names when they fit whole, else the name in the app's language alone: nothing is cut off.
                if #available(iOSApplicationExtension 16.0, *), let ar = a?.labelAr, !info.entry.rtl {
                    ViewThatFits(in: .horizontal) { line(key, name, a, arabic: ar); line(key, name, a, arabic: nil) }
                } else { line(key, name, a, arabic: nil) }
            }
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(FullColor { full in if full { RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Palette.panel) } })
            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Palette.line, lineWidth: 0.7))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(info.l["todaysAdhkar"] ?? "Today's adhkar"): \(name)")
    }
    private func line(_ key: String, _ name: String, _ a: SharedTimeline.Daily.Adhkar?, arabic: String?) -> some View {
        HStack(spacing: 6) {
            Image(systemName: key == "morning" ? "sun.max" : key == "sleep" ? "moon.zzz" : "book").font(.system(size: 9, weight: .semibold)).foregroundColor(Palette.gold)
                .frame(width: 16, height: 16).background(FullColor { full in if full { Circle().fill(Palette.bg) } }).accessibilityHidden(true)
            Text(name).font(.system(size: 10.5, weight: .semibold, design: .serif)).foregroundColor(Palette.text).lineLimit(1).fixedSize()
            Spacer(minLength: 2)
            if let arabic { Text(arabic).font(.system(size: 11.5, weight: .medium)).foregroundColor(Palette.gold).lineLimit(1).fixedSize().environment(\.layoutDirection, .rightToLeft) }
            if let a, a.total > 0 {
                if a.done >= a.total { Image(systemName: "checkmark.circle.fill").font(.system(size: 11)).foregroundColor(Palette.green) }
                else if a.done > 0 { Text("\(info.num(a.done))/\(info.num(a.total))").font(.system(size: 9.5, weight: .medium).monospacedDigit()).foregroundColor(Palette.muted).fixedSize() }
            }
            Image(systemName: info.entry.rtl ? "chevron.left" : "chevron.right").font(.system(size: 9, weight: .semibold)).foregroundColor(Palette.gold).accessibilityHidden(true)
        }
    }
}

// MARK: Page 2: Upcoming

private struct UpcomingPage: View {
    let info: EntryInfo
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ArchPanel(width: 86) {
                VStack(spacing: 4) {
                    Ornament()
                    Text(info.l["upcomingTitle"] ?? "Upcoming in Islam").font(.system(size: 11.5, design: .serif)).foregroundColor(Palette.onEmerald).multilineTextAlignment(.center).lineLimit(3).minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                    KaabaArt().accessibilityHidden(true)
                }
            }
            list.frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .widgetURL(URL(string: "ayahflow://occasions"))
    }
    private var rows: [(title: String, short: String, at: Double, kind: String, lunar: Bool)] {
        var r = info.coming.map { (title: $0.title, short: $0.short ?? $0.title, at: $0.at, kind: $0.kind, lunar: $0.lunar ?? ($0.kind != "jumuah")) }
        // Before Ramadan its first day is always the last row (it is usually further away than the rest).
        if case let .before(_, start) = info.phase { let t = info.l["wRamadanBegins"] ?? "Ramadan begins"; r = Array(r.prefix(3)) + [(title: t, short: t, at: start.timeIntervalSince1970 * 1000, kind: "ramadan", lunar: true)] }
        return r
    }
    private func symbol(_ kind: String) -> String { kind == "jumuah" ? "building.columns" : kind == "fast" ? "moon" : kind == "ramadan" ? "moon.stars" : "sparkles" }
    private var list: some View {
        var during: (Int, Int)? = nil
        if case let .during(d, e) = info.phase { during = (d, e) }
        let shown = Array(rows.prefix(during == nil ? 4 : 2))
        return VStack(alignment: .leading, spacing: 3) {
            if let (d, e) = during {
                HStack {
                    Text("\(info.l["wDayWord"] ?? "Day") \(info.num(d)) · \(info.l["wOf2930"] ?? "of 29 or 30")").font(.system(size: 12, design: .serif)).foregroundColor(Palette.goldBright)
                    Spacer(minLength: 4)
                    Text((info.l["wEidIn"] ?? "Eid al-Fitr in {n}").replacingOccurrences(of: "{n}", with: info.inDays(e))).font(.system(size: 9.5)).foregroundColor(Palette.muted)
                }.lineLimit(1).minimumScaleFactor(0.8)
                HStack(spacing: 1.5) {
                    ForEach(1...30, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 1.5).fill(i < d ? Palette.gold : i == d ? Palette.goldBright : i >= 21 && i % 2 == 1 ? Palette.line.opacity(1.6) : Palette.line.opacity(0.6))
                            .frame(height: i == d ? 6 : 4).opacity(i == 30 && d < 30 ? 0.5 : 1)
                    }
                }.accessibilityHidden(true)
            }
            if shown.isEmpty {
                Text(info.l["upcomingEmpty"] ?? "No Friday or voluntary fast in the next two weeks.").font(.system(size: 11)).foregroundColor(Palette.muted)
            }
            ForEach(Array(shown.enumerated()), id: \.offset) { i, r in
                row(r)
                if i < shown.count - 1 { Rectangle().fill(Palette.line).frame(height: 0.6).accessibilityHidden(true) }
            }
            Spacer(minLength: 0)
            if shown.contains(where: { $0.lunar }) || during != nil {
                Text("≈ " + (info.l["wSightingLong"] ?? "Umm al-Qura · ±1 day. Local moon sighting may differ.")).font(.system(size: 8.5)).foregroundColor(Palette.muted).lineLimit(1).minimumScaleFactor(0.75)
            }
        }
    }
    @ViewBuilder private func row(_ r: (title: String, short: String, at: Double, kind: String, lunar: Bool)) -> some View {
        let date = Date(timeIntervalSince1970: r.at / 1000), days = info.inDays(info.daysFrom(r.at)), mark = r.lunar ? "≈ " : ""
        let long: DateFormatter = { let f = DateFormatter(); f.locale = info.entry.locale; f.setLocalizedDateFormatFromTemplate("EEE d MMM"); return f }()
        let short: DateFormatter = { let f = DateFormatter(); f.locale = info.entry.locale; f.setLocalizedDateFormatFromTemplate("d MMM"); return f }()
        let line = { (title: String, when: String) in
            HStack(spacing: 5) {
                Image(systemName: symbol(r.kind)).font(.system(size: 9.5)).foregroundColor(Palette.gold).frame(width: 12).accessibilityHidden(true)
                Text(title).font(.system(size: 11.5)).foregroundColor(Palette.text).lineLimit(1).fixedSize()
                Spacer(minLength: 4)
                Text(when).font(.system(size: 9.5)).foregroundColor(Palette.muted).lineLimit(1).fixedSize()
            }
        }
        if #available(iOSApplicationExtension 16.0, *) {
            ViewThatFits(in: .horizontal) {
                line(r.title, "\(mark)\(long.string(from: date)) · \(days)")
                line(r.title, "\(mark)\(short.string(from: date)) · \(days)")
                line(r.short, "\(mark)\(short.string(from: date)) · \(days)")
                line(r.short, "\(mark)\(days)")
            }
            .accessibilityElement(children: .combine)
        } else { line(r.short, "\(mark)\(days)") }
    }
}

// MARK: Page 3: Dhikr

private struct DhikrPage: View {
    let info: EntryInfo
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            istighfar
            rows.frame(maxWidth: .infinity)
        }
    }
    /// Istighfar in the arch: the ring fills each hundred (or the chosen target) and the count is today's taps.
    private var istighfar: some View {
        let c = info.counter("istighfar"), n = c?.n ?? 0, total = max(1, c?.total ?? 100)
        let met = n >= total, value = Double(n % total == 0 && n > 0 ? total : n % total) / Double(total)
        return Link(destination: URL(string: "ayahflow://counter/istighfar")!) {
            ArchPanel(width: 96, art: .dhikr) { _ in
                VStack(spacing: 3) {
                    Text("أستغفر الله").font(.system(size: 10.5, weight: .medium)).foregroundColor(Palette.leafLight).lineLimit(1).environment(\.layoutDirection, .rightToLeft)
                    Ring(value: value, color: met ? Palette.green : Palette.leaf, track: Color.white.opacity(0.14), width: 4.5) {
                        VStack(spacing: -1) {
                            Text(info.num(n)).font(.system(size: 19, design: .serif)).foregroundColor(Palette.onEmerald).monospacedDigit().minimumScaleFactor(0.5).lineLimit(1)
                            Text("/ " + info.num(total)).font(.system(size: 8.5)).foregroundColor(Palette.onEmeraldMuted)
                        }.padding(7)
                    }.frame(width: 62, height: 62)
                    Spacer(minLength: 0)
                }
            }
        }
        .accessibilityElement(children: .ignore).accessibilityLabel("\(c?.label ?? "Istighfar"): \(info.num(n)) / \(info.num(total))")
    }
    private func row(_ label: String, _ value: String, _ progress: Double, done: Bool, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 7) {
                MiniRing(value: progress, done: done)
                Text(label).font(.system(size: 11.5)).foregroundColor(Palette.text).lineLimit(1).minimumScaleFactor(0.85)
                Spacer(minLength: 3)
                Text(value).font(.system(size: 11, weight: .semibold).monospacedDigit()).foregroundColor(done ? Palette.green : Palette.goldBright).lineLimit(1).fixedSize()
            }
            .padding(.vertical, 3.5)
        }
        .accessibilityElement(children: .combine)
    }
    private var rows: some View {
        VStack(spacing: 0) {
            if let t = info.counter("istighfar-tawbah") {
                row(t.label, info.num(t.n) + " / " + info.num(t.total) + (t.atLeast ? "+" : ""), Double(t.n) / Double(max(1, t.total)), done: t.n >= t.total, url: "ayahflow://counter/\(t.id)")
                divider
            }
            if let t = info.counter("tasbih-prayer") {
                // Rounds of 33 · 33 · 34 completed today; the ring shows the round under way.
                row(t.label, info.num(t.n / max(1, t.total)) + " " + (info.l["rounds"] ?? "rounds"), Double(t.n % max(1, t.total)) / Double(max(1, t.total)), done: false, url: "ayahflow://counter/\(t.id)")
                divider
            }
            ForEach(["morning", "evening"], id: \.self) { key in
                if let a = info.adhkar(key), a.total > 0 {
                    row(a.label, info.num(a.done) + " / " + info.num(a.total), Double(a.done) / Double(a.total), done: a.done >= a.total, url: "ayahflow://moment/\(key)")
                    if key == "morning" { divider }
                }
            }
            if info.entry.daily == nil {
                Text(info.l["ayahEmpty"] ?? "Open AyahFlow to update.").font(.system(size: 10)).foregroundColor(Palette.muted).frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
        }
    }
    private var divider: some View { Rectangle().fill(Palette.line).frame(height: 0.6).accessibilityHidden(true) }
}

// MARK: Page 4: Moments (replaces Steps)

/// Shortcuts to the adhkar of four daily moments. The widget detects nothing itself: automatic reminders stay with the
/// reminder engine. A tick appears only when the user confirmed every dhikr of that moment today.
private struct MomentsPage: View {
    let info: EntryInfo
    static let items: [(key: String, symbol: String, fallback: String)] = [("vehicle", "car.fill", "Riding or travelling"), ("leave_home", "door.left.hand.open", "Leaving home"), ("enter_home", "house.fill", "Entering home"), ("sleep", "moon.zzz.fill", "Before sleep")]
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ArchPanel(width: 86, art: .moments) { shown in
                VStack(spacing: 4) {
                    Ornament()
                    Text(info.l["momentsTitle"] ?? "Adhkar for daily moments").font(.system(size: 11.5, design: .serif)).foregroundColor(Palette.onEmerald).multilineTextAlignment(.center).lineLimit(3).minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                    if shown == nil { Image(systemName: "house").font(.system(size: 18, weight: .light)).foregroundColor(Palette.leaf).accessibilityHidden(true) }
                }
            }
            VStack(spacing: 0) {
                ForEach(Array(MomentsPage.items.enumerated()), id: \.offset) { i, m in
                    Link(destination: URL(string: "ayahflow://moment/\(m.key)")!) {
                        HStack(spacing: 8) {
                            Image(systemName: m.symbol).font(.system(size: 10.5)).foregroundColor(Palette.gold).frame(width: 16).accessibilityHidden(true)
                            Text(info.l["m_\(m.key)"] ?? m.fallback).font(.system(size: 11.5)).foregroundColor(Palette.text).lineLimit(1).minimumScaleFactor(0.85)
                            Spacer(minLength: 3)
                            if let a = info.adhkar(m.key), a.total > 0, a.done >= a.total {
                                Image(systemName: "checkmark.circle.fill").font(.system(size: 10.5)).foregroundColor(Palette.green).accessibilityLabel(info.l["prayed"] ?? "done")
                            }
                            Image(systemName: info.entry.rtl ? "chevron.left" : "chevron.right").font(.system(size: 9, weight: .semibold)).foregroundColor(Palette.gold).accessibilityHidden(true)
                        }.padding(.vertical, 4.5)
                    }
                    if i < MomentsPage.items.count - 1 { Rectangle().fill(Palette.line).frame(height: 0.6).accessibilityHidden(true) }
                }
                Spacer(minLength: 0)
            }.frame(maxWidth: .infinity)
        }
    }
}

// MARK: Page 5: Du'a from the Quran

/// The day's Quranic du'a, the corpus text as it is. Beside the arch while it fits at 14 pt or more; otherwise across the
/// whole width (FittedAyah steps down to 11 pt, then points to the surah instead of cutting the text).
private struct QuranPage: View {
    let entry: PrayerEntry
    var body: some View {
        if let a = entry.ayah {
            Link(destination: URL(string: "ayahflow://ayah/\(a.surah):\(a.ayah)")!) {
                if #available(iOSApplicationExtension 16.0, *) {
                    ViewThatFits(in: .vertical) {
                        HStack(spacing: 10) {
                            // The cream du'a scene takes dark text; the plain emerald arch keeps cream text.
                            ArchPanel(width: 76, art: .dua) { shown in
                                VStack(spacing: 4) {
                                    Ornament()
                                    Text(entry.labels["ayahTab"] ?? "Du'a from the Quran").font(.system(size: 10.5, design: .serif)).foregroundColor(ArchInk(shown).title).multilineTextAlignment(.center).lineLimit(3).minimumScaleFactor(0.8)
                                    Spacer(minLength: 0)
                                    if shown == nil { Image(systemName: "book").font(.system(size: 16, weight: .light)).foregroundColor(Palette.leaf).accessibilityHidden(true) }
                                }
                            }
                            VStack(spacing: 4) { lines([19, 16.5, 14]); reference(a) }
                        }
                        VStack(spacing: 4) {
                            FittedAyah(text: a.text, sizes: FittedAyah.sizes(.systemMedium), caption: entry.labels["readAyah"] ?? "Read it in its surah")
                                .foregroundColor(Palette.text).frame(maxWidth: .infinity, maxHeight: .infinity)
                            reference(a)
                        }
                    }
                } else { AyahBody(entry: entry, compact: true) }
            }
        } else {
            Text(entry.labels["ayahEmpty"] ?? "Open AyahFlow to load the du'a of the day.").font(.caption).foregroundColor(Palette.muted)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
    /// The ayah at the first size that fits whole, never cut (the fallback above takes over when none does).
    @available(iOSApplicationExtension 16.0, *)
    private func lines(_ sizes: [CGFloat]) -> some View {
        let text = entry.ayah?.text ?? ""
        return ViewThatFits(in: .vertical) {
            ForEach(sizes, id: \.self) { s in
                Text(text).font(.quran(s)).foregroundColor(Palette.text).multilineTextAlignment(.center).lineSpacing(s * 0.12)
                    .fixedSize(horizontal: false, vertical: true).environment(\.layoutDirection, .rightToLeft)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    private func reference(_ a: SharedTimeline.Ayah) -> some View {
        HStack(spacing: 6) {
            Text(a.nameAr).foregroundColor(Palette.gold)
            Circle().fill(Palette.line).frame(width: 3, height: 3)
            Text(a.ref).foregroundColor(Palette.muted).monospacedDigit()
        }.font(.system(size: 10.5, weight: .medium)).lineLimit(1)
    }
}

// MARK: - The prayer widget in every size

struct PrayerWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    private var info: EntryInfo { EntryInfo(entry: entry) }

    var body: some View {
        content
            .environment(\.layoutDirection, entry.rtl ? .rightToLeft : .leftToRight)
            .environment(\.locale, entry.locale) // times and countdowns in the app's language, as the app shows them
            .widgetURL(URL(string: "ayahflow://prayer"))
            .modifier(WidgetBackground(marginsOff: true))
    }

    @ViewBuilder var content: some View {
        if family == .systemMedium { MediumWidget(entry: entry) }
        else if family == .systemLarge { large }
        else if entry.state != .ready || entry.next == nil {
            VStack(alignment: .leading, spacing: 6) {
                Text("AyahFlow").font(.system(.headline, design: .serif)).foregroundColor(Palette.gold)
                Text(entry.state == .stale ? (entry.labels["stale"] ?? "Open AyahFlow to refresh prayer times.") : (entry.labels["noPlace"] ?? "Save Home in AyahFlow to see prayer times."))
                    .font(.caption).foregroundColor(Palette.muted)
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(family == .systemSmall ? 14 : 0)
        } else if let next = entry.next {
            switch family {
            case .accessoryInline: Text("\(next.label) \(next.date, style: .time)")
            case .accessoryCircular: circular(next)
            case .accessoryRectangular: rectangular(next)
            default: small(next)
            }
        }
    }

    @ViewBuilder private func progress(_ next: SharedTimeline.Prayer) -> some View {
        if #available(iOSApplicationExtension 16.0, *), entry.since < next.date {
            ProgressView(timerInterval: entry.since...next.date, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear).tint(Palette.gold)
        }
    }

    /// The small size: the next prayer in the arch, the countdown under it.
    private func small(_ next: SharedTimeline.Prayer) -> some View {
        Margins { m in
            FullColor { full in
                ArtGate(art: full ? Art.prayer(next.key) : nil) { shown in
                    let ink = ArchInk(shown)
                    VStack(spacing: 3) {
                        Ornament()
                        Text((entry.labels["next"] ?? "Next prayer").uppercased()).font(.system(size: 9, weight: .semibold)).kerning(entry.rtl ? 0 : 1.2).foregroundColor(ink.label).lineLimit(1).minimumScaleFactor(0.8)
                        Text(next.label).font(.system(size: 26, design: .serif)).foregroundColor(ink.title).lineLimit(1).minimumScaleFactor(0.6).accent()
                        Text(next.date, style: .time).font(.system(size: 16, weight: .semibold, design: .serif)).foregroundColor(ink.label).monospacedDigit()
                        Text(next.date, style: .timer).font(.system(size: 11).monospacedDigit()).foregroundColor(shown == nil ? Palette.onEmeraldMuted : ink.title).multilineTextAlignment(.center)
                        Spacer(minLength: 0)
                    }
                    .padding(.top, 16).padding(.horizontal, 8).padding(.bottom, 6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZStack {
                        if full { ArchShape(shoulder: 0.26).fill(LinearGradient(colors: [Palette.emerald, Palette.emeraldDeep], startPoint: .top, endPoint: .bottom)) }
                        if let shown { ArtBackdrop(art: shown).clipShape(ArchShape(shoulder: 0.26)) }
                        ArchShape(shoulder: 0.26).stroke(Palette.leaf.opacity(0.7), lineWidth: 1).padding(full ? 3 : 0)
                        if shown == nil { VStack { Spacer(); MosqueShape().fill(Palette.leaf.opacity(0.14)).frame(width: 90, height: 34) }.accessibilityHidden(true) }
                    })
                    .padding(EdgeInsets(top: m.top * 0.6, leading: m.leading * 0.6, bottom: m.bottom * 0.6, trailing: m.trailing * 0.6))
                }
            }
        }
    }

    /// The large size: the header band, the next prayer and today's five, today's adhkar and the dhikr counts.
    private var large: some View {
        Margins { m in
            VStack(spacing: 0) {
                HeaderBar(info: info, tabs: false, trailing: AnyView(athanStatus))
                    .padding(.horizontal, m.leading).padding(.top, max(10, m.top * 0.7)).padding(.bottom, 9)
                    .background(Band())
                VStack(alignment: .leading, spacing: 10) {
                    dateLine
                    PrayerPage(info: info, large: true).frame(height: 178)
                    if entry.daily != nil { DhikrPage(info: info).frame(maxHeight: .infinity) }
                    else { Spacer(minLength: 0) }
                }
                .padding(.horizontal, m.leading).padding(.top, 10).padding(.bottom, max(10, m.bottom * 0.8))
            }
        }
    }

    private var athanStatus: some View {
        HStack(spacing: 4) { Image(systemName: entry.labels["athanOn"] == "1" ? "bell.fill" : "bell.slash"); Text(entry.labels["athan"] ?? "") }
            .font(.system(size: 10, weight: .medium)).foregroundColor(entry.labels["athanOn"] == "1" ? Palette.leafLight : Palette.onEmeraldMuted).lineLimit(1)
    }

    /// The day's Gregorian and Umm al-Qura dates, with the user's ±1 day correction shared by the app.
    private var dateLine: some View {
        let hijriDay = Calendar.current.date(byAdding: .day, value: Int(entry.labels["hijriOffset"] ?? "0") ?? 0, to: entry.date) ?? entry.date
        return HStack(spacing: 6) {
            Image(systemName: "calendar").foregroundColor(Palette.gold)
            Text(formatted(entry.date, entry.locale, hijri: false)).foregroundColor(Palette.text)
            Circle().fill(Palette.line).frame(width: 3, height: 3)
            Text(formatted(hijriDay, entry.locale, hijri: true)).foregroundColor(Palette.gold)
        }.font(.system(size: 12, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
    }

    @ViewBuilder private func rectangular(_ next: SharedTimeline.Prayer) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(next.label).font(.headline); Spacer(); Text(next.date, style: .time).font(.headline.monospacedDigit()) }
            Text(next.date, style: .timer).font(.caption.monospacedDigit())
            progress(next)
        }
    }

    @ViewBuilder private func circular(_ next: SharedTimeline.Prayer) -> some View {
        if #available(iOSApplicationExtension 16.0, *), entry.since < next.date {
            Gauge(value: max(0, min(1, entry.date.timeIntervalSince(entry.since) / next.date.timeIntervalSince(entry.since)))) {
                Text(String(next.label.prefix(1)))
            } currentValueLabel: {
                Text(next.date, style: .time).font(.system(size: 9).monospacedDigit())
            }.gaugeStyle(.accessoryCircular)
        } else {
            Text(next.label.prefix(1))
        }
    }
}

/// The cream (or green-black) page behind every widget. `marginsOff`: the widget draws its own margins (the prayer
/// widget, whose emerald band reaches the edges).
private struct WidgetBackground: ViewModifier {
    @Environment(\.widgetFamily) var family
    var marginsOff = false
    func body(content: Content) -> some View {
        let lockScreen: Bool
        if #available(iOSApplicationExtension 16.0, *) { lockScreen = [.accessoryInline, .accessoryRectangular, .accessoryCircular].contains(family) } else { lockScreen = false }
        if #available(iOSApplicationExtension 17.0, *) {
            return AnyView(content.containerBackground(for: .widget) { lockScreen ? AnyView(Color.clear) : AnyView(Palette.bg) })
        }
        return AnyView((marginsOff ? AnyView(content) : AnyView(content.padding())).background(lockScreen ? AnyView(Color.clear) : AnyView(Palette.bg)))
    }
}

extension WidgetConfiguration {
    /// The prayer widget draws its own margins so its emerald band can reach the edges (iOS 17+).
    func edgeToEdge() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) { return self.contentMarginsDisabled() } else { return self }
    }
}

struct NextPrayerWidget: Widget {
    var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) { return [.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline] }
        return [.systemSmall, .systemMedium, .systemLarge]
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowNextPrayer", provider: Provider()) { PrayerWidgetView(entry: $0) }
            .configurationDisplayName("Prayer times")
            .description("Prayer times with a live countdown. The medium size has five pages: Prayer, Upcoming, Dhikr, Moments and Quran.")
            .supportedFamilies(families)
            .edgeToEdge()
    }
}

/// Small istighfar widget: stack it with the prayer widget (Smart Stack) and swipe between them.
struct DhikrWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        let c = entry.daily?.counters.first { $0.id == "istighfar" }, n = c?.n ?? 0, total = c?.total ?? 100
        Group {
            if family == .systemSmall {
                VStack(spacing: 6) {
                    Text((c?.label ?? "Istighfar").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(entry.rtl ? 0 : 1.1).foregroundColor(Palette.gold).lineLimit(1)
                    Ring(value: Double(n >= total ? total : n) / Double(total), color: n >= total ? Palette.green : Palette.gold, width: 8) {
                        VStack(spacing: 0) {
                            Text(number(n, entry.locale)).font(.system(size: 30, design: .serif)).foregroundColor(Palette.text).monospacedDigit().minimumScaleFactor(0.5)
                            Text("/ " + number(total, entry.locale)).font(.system(size: 11)).foregroundColor(Palette.muted)
                        }
                    }
                }
            } else {
                circularGauge(Double(min(n, total)) / Double(total), symbol: "circle.dotted", value: number(n, entry.locale))
            }
        }
        .widgetURL(URL(string: "ayahflow://counter/istighfar"))
        .modifier(WidgetBackground())
    }
}

/// Daily moments in the small size: four shortcuts to the adhkar of the day's moments (driving, leaving and entering
/// home, before sleep). It replaced the step widget (v29) and keeps its kind, so a widget already placed turns into this.
struct MomentsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        Group {
            if family == .systemSmall {
                VStack(alignment: .leading, spacing: 6) {
                    Text((entry.labels["momentsTab"] ?? "Moments").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(entry.rtl ? 0 : 1.1).foregroundColor(Palette.gold).lineLimit(1)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 6) {
                        ForEach(Array(MomentsPage.items.enumerated()), id: \.offset) { _, m in
                            VStack(spacing: 3) {
                                Image(systemName: m.symbol).font(.system(size: 15)).foregroundColor(Palette.gold)
                                Text(entry.labels["m_\(m.key)"] ?? m.fallback).font(.system(size: 9)).foregroundColor(Palette.text).lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                            }
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(FullColor { full in if full { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.panel) } else { RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Palette.line, lineWidth: 0.8) } })
                        }
                    }
                }
            } else {
                if #available(iOSApplicationExtension 16.0, *) {
                    ZStack { AccessoryWidgetBackground(); Image(systemName: "door.left.hand.open").font(.system(size: 18)) }
                } else { Image(systemName: "house") }
            }
        }
        .widgetURL(URL(string: "ayahflow://adhkar"))
        .modifier(WidgetBackground())
    }
}

@ViewBuilder private func circularGauge(_ value: Double, symbol: String, value label: String) -> some View {
    if #available(iOSApplicationExtension 16.0, *) {
        Gauge(value: max(0, min(1, value))) { Image(systemName: symbol) } currentValueLabel: { Text(label).font(.system(size: 11).monospacedDigit()) }.gaugeStyle(.accessoryCircular)
    } else { Text(label) }
}

struct IstighfarWidget: Widget {
    var families: [WidgetFamily] { if #available(iOSApplicationExtension 16.0, *) { return [.systemSmall, .accessoryCircular] }; return [.systemSmall] }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowIstighfar", provider: Provider()) { DhikrWidgetView(entry: $0) }
            .configurationDisplayName("Istighfar")
            .description("Today's istighfar count. Tap to keep counting.")
            .supportedFamilies(families)
    }
}

/// Kind "AyahFlowSteps" is kept on purpose: widgets placed while it showed steps keep their place and show Daily moments.
struct MomentsWidget: Widget {
    var families: [WidgetFamily] { if #available(iOSApplicationExtension 16.0, *) { return [.systemSmall, .accessoryCircular] }; return [.systemSmall] }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowSteps", provider: Provider()) { MomentsWidgetView(entry: $0) }
            .configurationDisplayName("Daily moments")
            .description("Adhkar for driving, leaving and entering home, and before sleep.")
            .supportedFamilies(families)
    }
}

extension Font {
    /// Quran text in the bundled AyahFlow Quran font (DigitalKhatt Madina, adapted; UIAppFonts), the same font as the reader: the system font misplaces
    /// Mushaf marks such as the small waw and madd. Falls back to the system font only if the file is missing.
    static func quran(_ size: CGFloat) -> Font { .custom("AyahFlow Quran", size: size) }
}

/// An ayah at the largest size that fits the widget, stepping down to about 11 pt (sizes measured against every du'a and
/// Ayah of the Moment with this font: all fit the large widget, nearly all the medium); when even the smallest does not
/// fit, a pointer to read it in the app. The Quran text is never cut off (iOS 15 keeps scaling it).
struct FittedAyah: View {
    let text: String
    /// Largest first; exactly six (repeat the last to use fewer).
    let sizes: [CGFloat]
    let caption: String
    var body: some View {
        if #available(iOSApplicationExtension 16.0, *) {
            ViewThatFits(in: .vertical) {
                line(sizes[0]); line(sizes[1]); line(sizes[2]); line(sizes[3]); line(sizes[4]); line(sizes[5])
                Label(caption, systemImage: "book").font(.caption).foregroundColor(Palette.muted).multilineTextAlignment(.center)
            }
        } else {
            line(sizes[0]).minimumScaleFactor(0.35)
        }
    }
    static func sizes(_ family: WidgetFamily) -> [CGFloat] {
        switch family {
        case .systemLarge: return [30, 26, 22, 19, 16, 14]
        case .systemSmall: return [19, 16, 14, 12.5, 11, 11]
        default: return [22, 19, 16.5, 14, 12.5, 11]
        }
    }
    private func line(_ s: CGFloat) -> some View {
        Text(text).font(.quran(s)).multilineTextAlignment(.center).lineSpacing(s * 0.12)
            .fixedSize(horizontal: false, vertical: true).environment(\.layoutDirection, .rightToLeft)
    }
}

/// The Lock Screen rectangle (about 145–172 × 56–76 pt): the reference line with the ayah under it at 13–10 pt; if it
/// does not fit, the ayah alone filling the rectangle at 15–10 pt. Daily du'as are only those measured to fit whole
/// (src/lock-duas.ts). A longer ayah (some Ayahs of the Moment) shows the reference and its opening words, unchanged,
/// with iOS's "…" marking that it continues; tapping opens it whole. The Arabic is never left out.
@available(iOSApplicationExtension 16.0, *)
struct LockScreenAyah: View {
    let text: String
    let title: String
    let caption: String
    var body: some View {
        ViewThatFits(in: .vertical) {
            titled(13); titled(11.5); titled(10)
            line(15); line(13); line(11.5); line(10)
            VStack(alignment: .leading, spacing: 1) { header; opening(2) }
            opening(2)
        }
        .accessibilityElement(children: .combine).accessibilityHint(Text(caption))
    }
    private var header: some View {
        Label(title, systemImage: "book.closed.fill").font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
    }
    private func titled(_ s: CGFloat) -> some View { VStack(alignment: .leading, spacing: 1) { header; line(s) } }
    /// The first lines of the ayah as stored (never edited); the tail truncation adds the "…".
    private func opening(_ lines: Int) -> some View {
        Text(text).font(.quran(10)).multilineTextAlignment(.trailing).lineLimit(lines).truncationMode(.tail)
            .environment(\.layoutDirection, .rightToLeft).frame(maxWidth: .infinity, alignment: .trailing)
    }
    private func line(_ s: CGFloat) -> some View {
        Text(text).font(.quran(s)).multilineTextAlignment(.trailing).fixedSize(horizontal: false, vertical: true)
            .environment(\.layoutDirection, .rightToLeft).frame(maxWidth: .infinity, alignment: .trailing)
    }
}

/// The du'a of the day: Arabic exactly as in the corpus, surah name and reference. Tapping opens it in the reader.
struct AyahBody: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var compact = false
    var body: some View {
        if let a = entry.ayah {
            Link(destination: URL(string: "ayahflow://ayah/\(a.surah):\(a.ayah)")!) {
                VStack(spacing: compact ? 4 : 8) {
                    if !compact {
                        Text((entry.labels["ayahTab"] ?? "Du'a from the Quran").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(entry.rtl ? 0 : 1.2).foregroundColor(Palette.gold).lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    FittedAyah(text: a.text, sizes: FittedAyah.sizes(family), caption: entry.labels["readAyah"] ?? "Read it in its surah")
                        .foregroundColor(Palette.text).frame(maxWidth: .infinity, maxHeight: .infinity)
                    HStack(spacing: 6) {
                        Text(a.nameAr).foregroundColor(Palette.goldBright)
                        Circle().fill(Palette.line).frame(width: 3, height: 3)
                        Text(a.ref).foregroundColor(Palette.muted).monospacedDigit()
                    }.font(.system(size: 11, weight: .medium)).lineLimit(1)
                }
            }
        } else {
            Text(entry.labels["ayahEmpty"] ?? "Open AyahFlow to load the du'a of the day.").font(.caption).foregroundColor(Palette.muted)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct AyahWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        Group {
            if #available(iOSApplicationExtension 16.0, *), family == .accessoryRectangular {
                if let a = entry.ayah {
                    // Like a Lock Screen quote: "📖 Surah Name, ref" on top, the whole du'a under it (never cut).
                    LockScreenAyah(text: a.text, title: surahRef(a), caption: entry.labels["readAyah"] ?? "Read it in its surah")
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else { Text(entry.labels["ayahEmpty"] ?? "Open AyahFlow").font(.caption2) }
            } else if #available(iOSApplicationExtension 16.0, *), family == .accessoryInline {
                // One line above the clock is too short for a du'a, so it names it instead of cutting it.
                if let a = entry.ayah { Label(surahRef(a), systemImage: "book.closed.fill") } else { Text("AyahFlow") }
            } else {
                AyahBody(entry: entry)
            }
        }
        .widgetURL(URL(string: entry.ayah.map { "ayahflow://ayah/\($0.surah):\($0.ayah)" } ?? "ayahflow://adhkar"))
        .modifier(WidgetBackground())
    }
    func surahRef(_ a: SharedTimeline.Ayah) -> String {
        (entry.labels["surahRef"] ?? "Surah {name}, {ref}").replacingOccurrences(of: "{name}", with: entry.rtl ? a.nameAr : a.name).replacingOccurrences(of: "{ref}", with: a.ref)
    }
}

struct AyahWidget: Widget {
    var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) { return [.accessoryRectangular, .accessoryInline, .systemSmall, .systemMedium, .systemLarge] }
        return [.systemSmall, .systemMedium, .systemLarge]
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowAyah", provider: Provider()) { AyahWidgetView(entry: $0) }
            .configurationDisplayName("Du'a from the Quran")
            .description("A Quranic du'a each day, in Arabic, on your Lock Screen or Home Screen. Tap to read it in its surah.")
            .supportedFamilies(families)
    }
}

struct MomentWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        Group {
            if let a = entry.momentAyah {
                if #available(iOSApplicationExtension 16.0, *), family == .accessoryRectangular {
                    LockScreenAyah(text: a.text, title: "\(entry.rtl ? a.nameAr : a.name) \(a.ref)", caption: entry.labels["readAyah"] ?? "Read it in its surah")
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else {
                    VStack(spacing: 8) {
                        Text((entry.labels["momentTab"] ?? "Ayah of the moment").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(entry.rtl ? 0 : 1.2).foregroundColor(Palette.gold).lineLimit(1)
                        FittedAyah(text: a.text, sizes: FittedAyah.sizes(family), caption: entry.labels["readAyah"] ?? "Read it in its surah")
                            .foregroundColor(Palette.text).frame(maxWidth: .infinity, maxHeight: .infinity)
                        HStack(spacing: 6) {
                            Text(a.nameAr).foregroundColor(Palette.goldBright)
                            Circle().fill(Palette.line).frame(width: 3, height: 3)
                            Text(a.ref).foregroundColor(Palette.muted).monospacedDigit()
                        }.font(.system(size: 11, weight: .medium)).lineLimit(1)
                    }
                }
            } else {
                Text(entry.labels["ayahEmpty"] ?? "Open AyahFlow to load the verses.").font(.caption).foregroundColor(Palette.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .widgetURL(URL(string: entry.momentAyah.map { "ayahflow://ayah/\($0.surah):\($0.ayah)" } ?? "ayahflow://home"))
        .modifier(WidgetBackground())
    }
}

struct MomentWidget: Widget {
    var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) { return [.accessoryRectangular, .systemSmall, .systemMedium, .systemLarge] }
        return [.systemSmall, .systemMedium, .systemLarge]
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowMoment", provider: MomentProvider()) { MomentWidgetView(entry: $0) }
            .configurationDisplayName("Ayah of the moment")
            .description("A different ayah every half hour, in Arabic, from the verses AyahFlow prepared. Tap to read it in its surah.")
            .supportedFamilies(families)
    }
}

@main
struct AyahFlowWidgets: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        UpcomingWidget()
        MomentWidget()
        AyahWidget()
        IstighfarWidget()
        MomentsWidget()
    }
}

// MARK: - Jumu'ah and voluntary fasts

struct UpcomingEntry: TimelineEntry {
    let date: Date
    let items: [SharedTimeline.Upcoming]
    let labels: [String: String]
    let rtl: Bool
    let locale: Locale
    var ramadan: SharedTimeline.RamadanSpan? = nil
    var prayers: [SharedTimeline.Prayer] = []
}

/// Where the entry's day stands against Ramadan (Umm al-Qura, from the app): days to go, the day of Ramadan, or neither.
enum RamadanPhase: Equatable {
    case before(days: Int, start: Date)
    case during(day: Int, eidIn: Int)
    static func of(_ span: SharedTimeline.RamadanSpan?, on date: Date, calendar cal: Calendar = .current) -> RamadanPhase? {
        guard let span else { return nil }
        let today = cal.startOfDay(for: date), start = cal.startOfDay(for: Date(timeIntervalSince1970: span.start / 1000)), eid = cal.startOfDay(for: Date(timeIntervalSince1970: span.eid / 1000))
        let toStart = cal.dateComponents([.day], from: today, to: start).day ?? 0, toEid = cal.dateComponents([.day], from: today, to: eid).day ?? 0
        if toStart > 0 { return .before(days: toStart, start: start) }
        if toEid > 0 { return .during(day: -toStart + 1, eidIn: toEid) }
        return nil
    }
}

/// Days from the app's last share: an entry now and one at each midnight, so "today" moves on without the app.
struct UpcomingProvider: TimelineProvider {
    private func entry(at date: Date, _ t: SharedTimeline?) -> UpcomingEntry {
        let start = Calendar.current.startOfDay(for: date).timeIntervalSince1970 * 1000
        return UpcomingEntry(date: date, items: (t?.upcoming ?? []).filter { $0.at >= start }, labels: t?.labels ?? [:], rtl: t?.rtl ?? false, locale: t?.locale.map(Locale.init(identifier:)) ?? .current, ramadan: t?.ramadan, prayers: t?.prayers ?? [])
    }
    func placeholder(in context: Context) -> UpcomingEntry { UpcomingEntry(date: Date(), items: [], labels: [:], rtl: false, locale: .current) }
    func getSnapshot(in context: Context, completion: @escaping (UpcomingEntry) -> Void) { completion(entry(at: Date(), SharedTimeline.load())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<UpcomingEntry>) -> Void) {
        let t = SharedTimeline.load(), now = Date(), cal = Calendar.current
        let midnights = (1...7).compactMap { cal.date(byAdding: .day, value: $0, to: cal.startOfDay(for: now)) }
        completion(Timeline(entries: [entry(at: now, t)] + midnights.map { entry(at: $0, t) }, policy: .after(midnights.last ?? now.addingTimeInterval(86400))))
    }
}

struct UpcomingWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: UpcomingEntry
    private func dayName(_ u: SharedTimeline.Upcoming) -> String {
        let date = Date(timeIntervalSince1970: u.at / 1000)
        if Calendar.current.isDateInToday(date) { return entry.labels["todayWord"] ?? "Today" }
        let f = DateFormatter(); f.locale = entry.locale; f.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return f.string(from: date)
    }
    private func symbol(_ kind: String) -> String { kind == "fast" ? "moon.stars" : kind == "ramadan" ? "moon" : kind == "occasion" ? "sparkles" : "book" }
    var body: some View {
        let shown = Array(entry.items.prefix(family == .systemSmall ? 1 : 3))
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.labels["upcomingTab"] ?? "Coming up").font(.system(size: 11, weight: .semibold)).foregroundColor(Palette.gold)
            if shown.isEmpty {
                Text(entry.labels["upcomingEmpty"] ?? "No Friday or voluntary fast in the next two weeks.").font(.caption).foregroundColor(Palette.muted)
            }
            ForEach(Array(shown.enumerated()), id: \.offset) { _, u in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: symbol(u.kind)).foregroundColor(Palette.gold).font(.system(size: 14))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(dayName(u)).font(.system(size: 11)).foregroundColor(Palette.muted)
                        Text(u.title).font(.system(size: family == .systemSmall ? 17 : 15, design: .serif)).foregroundColor(Palette.text).lineLimit(1).minimumScaleFactor(0.7)
                        Text(u.sub).font(.system(size: 11)).foregroundColor(Palette.muted).lineLimit(family == .systemSmall ? 3 : 1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .environment(\.layoutDirection, entry.rtl ? .rightToLeft : .leftToRight)
        .widgetURL(URL(string: shown.first?.kind == "jumuah" ? "ayahflow://ayah/18:1" : "ayahflow://prayer"))
        .modifier(WidgetBackground())
    }
}

struct UpcomingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowUpcoming", provider: UpcomingProvider()) { UpcomingWidgetView(entry: $0) }
            .configurationDisplayName("Jumu'ah and fasts")
            .description("The next Friday, voluntary fast days and the start of Ramadan.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
