import WidgetKit
import SwiftUI
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
    /// Today's dhikr counts, adhkar progress and the latest step reading (src/smart.ts WidgetDaily).
    let daily: Daily?
    /** The next days' Quranic du'as (src/smart.ts dailyAyahs): the Arabic is the corpus text as it is. */
    let ayahs: [Ayah]?
    /// Prayers the user confirmed and the Ayah of the Moment for the next half hours (src/smart.ts WidgetWorship).
    let worship: Worship?

    struct Worship: Decodable {
        struct Day: Decodable { let day: String; let kept: [String] }
        struct Moment: Decodable { let at: Double; let surah: Int; let ayah: Int; let ref: String; let text: String; let name: String; let nameAr: String }
        let salah: [Day]
        let moments: [Moment]
    }

    struct Ayah: Decodable { let day: String; let surah: Int; let ayah: Int; let to: Int; let ref: String; let text: String; let name: String; let nameAr: String }

    struct Daily: Decodable {
        struct Counter: Decodable { let id: String; let label: String; let n: Int; let total: Int; let atLeast: Bool; let perPrayer: Bool }
        struct Adhkar: Decodable { let key: String; let label: String; let done: Int; let total: Int }
        struct Steps: Decodable { let today: Int; let goal: Int; let at: Double }
        let day: String
        let counters: [Counter]
        let adhkar: [Adhkar]
        let steps: Steps?
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
    /// Today's dhikr and steps, or nil when the app has not shared any for today (counts start again at midnight).
    var daily: SharedTimeline.Daily? = nil
    var page: WidgetPage = .prayer
    /// Today's du'a from the Quran, if the app has shared it.
    var ayah: SharedTimeline.Ayah? = nil
    /// The shown day's prayers the user confirmed in the app (their own note; nothing is inferred).
    var kept: Set<String> = []
    /// The Ayah of the Moment for this entry's half hour.
    var momentAyah: SharedTimeline.Worship.Moment? = nil
}

/// The pages of the medium widget. The chosen page is kept in the widget extension's own defaults.
enum WidgetPage: Int, CaseIterable {
    case prayer, dhikr, steps, ayah
    static var current: WidgetPage { WidgetPage(rawValue: UserDefaults.standard.integer(forKey: "widgetPage")) ?? .prayer }
    var symbol: String { switch self { case .prayer: return "moon.stars"; case .dhikr: return "circle.dotted"; case .steps: return "figure.walk"; case .ayah: return "book" } }
    func label(_ labels: [String: String]) -> String {
        switch self { case .prayer: return labels["prayerTab"] ?? "Prayer"; case .dhikr: return labels["dhikrTab"] ?? "Dhikr"; case .steps: return labels["stepsTab"] ?? "Steps"; case .ayah: return labels["ayahTab"] ?? "Du'a" }
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

private func dayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

struct Provider: TimelineProvider {
    private static func sample() -> PrayerEntry {
        let now = Date(), at = { (h: Double) in now.addingTimeInterval(h * 3600).timeIntervalSince1970 * 1000 }
        let today: [SharedTimeline.Prayer] = [.init(key: "fajr", label: "Fajr", at: at(-8)), .init(key: "dhuhr", label: "Dhuhr", at: at(-2)), .init(key: "asr", label: "Asr", at: at(1.4)), .init(key: "maghrib", label: "Maghrib", at: at(4)), .init(key: "isha", label: "Isha", at: at(5.3))]
        let daily = SharedTimeline.Daily(day: dayKey(now), counters: [.init(id: "istighfar", label: "Istighfar", n: 64, total: 100, atLeast: false, perPrayer: false), .init(id: "istighfar-tawbah", label: "Istighfar and tawbah", n: 20, total: 70, atLeast: true, perPrayer: false), .init(id: "tasbih-prayer", label: "Tasbih after prayer", n: 200, total: 100, atLeast: false, perPrayer: true)], adhkar: [.init(key: "morning", label: "Morning adhkar", done: 4, total: 5), .init(key: "evening", label: "Evening adhkar", done: 0, total: 5)], steps: .init(today: 5840, goal: 8000, at: now.timeIntervalSince1970 * 1000))
        return PrayerEntry(date: now, state: .ready, next: today[2], since: today[1].date, today: today, moment: nil, labels: ["next": "Next prayer", "athan": "Athan", "athanOn": "1"], rtl: false, locale: .current, daily: daily, page: .current, ayah: .init(day: dayKey(now), surah: 37, ayah: 100, to: 100, ref: "37:100", text: "رَبِّ هَبْ لِى مِنَ ٱلصَّـٰلِحِينَ", name: "As-Saaffaat", nameAr: "الصافات"))
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
        func empty(_ s: PrayerEntry.State) -> PrayerEntry { PrayerEntry(date: date, state: s, next: nil, since: date, today: [], moment: nil, labels: data?.labels ?? [:], rtl: data?.rtl ?? false, locale: locale, daily: daily, page: .current, ayah: ayah, kept: kept) }
        guard let data, !data.prayers.isEmpty else { return empty(.noData) }
        let ms = date.timeIntervalSince1970 * 1000
        guard let index = data.prayers.firstIndex(where: { $0.at > ms }) else { return empty(.stale) }
        let next = data.prayers[index]
        let dayStart = Calendar.current.startOfDay(for: date)
        let since = index > 0 ? data.prayers[index - 1].date : dayStart
        let dayEnd = nextDay(dayStart)
        // The day shown: today, or yesterday while its Isha is still to come after midnight (high latitudes in summer).
        let shownDay = next.day.map { $0 < dayKey(date) ? $0 : dayKey(date) } ?? dayKey(date)
        let today = data.prayers.contains { $0.day != nil } ? data.prayers.filter { $0.day == shownDay } : data.prayers.filter { $0.date >= dayStart && $0.date < dayEnd }
        let keptShown = Set(data.worship?.salah.first { $0.day == shownDay }?.kept ?? [])
        let inside = { (w: [Double]?) in w.map { $0.count == 2 && ms >= $0[0] && ms < $0[1] } ?? false }
        let moment: (key: String, label: String)? = data.windows.contains { inside($0.morning) } ? (key: "morning", label: data.labels["morning"] ?? "Morning adhkar")
            : data.windows.contains { inside($0.evening) } ? (key: "evening", label: data.labels["evening"] ?? "Evening adhkar") : nil
        return PrayerEntry(date: date, state: .ready, next: next, since: max(since, next.date.addingTimeInterval(-12 * 3600)), today: today.isEmpty ? Array(data.prayers[index...].prefix(5)) : today, moment: moment, labels: data.labels, rtl: data.rtl, locale: locale, daily: daily, page: .current, ayah: ayah, kept: keptShown)
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

private enum Palette {
    static let bg = Color(red: 16 / 255, green: 20 / 255, blue: 17 / 255)
    static let panel = Color(red: 33 / 255, green: 38 / 255, blue: 29 / 255)
    static let line = Color(red: 50 / 255, green: 54 / 255, blue: 43 / 255)
    static let gold = Color(red: 217 / 255, green: 187 / 255, blue: 121 / 255)
    static let goldBright = Color(red: 239 / 255, green: 220 / 255, blue: 173 / 255)
    static let text = Color(red: 243 / 255, green: 240 / 255, blue: 231 / 255)
    static let muted = Color(red: 167 / 255, green: 173 / 255, blue: 159 / 255)
    static let green = Color(red: 166 / 255, green: 197 / 255, blue: 165 / 255)
}

private func number(_ n: Int, _ locale: Locale) -> String { let f = NumberFormatter(); f.locale = locale; f.numberStyle = .decimal; return f.string(from: NSNumber(value: n)) ?? String(n) }

/// A progress ring with content in the middle.
private struct Ring<Inner: View>: View {
    let value: Double
    var color: Color = Palette.gold
    var width: CGFloat = 6
    @ViewBuilder let inner: () -> Inner
    var body: some View {
        ZStack {
            Circle().stroke(Palette.line, lineWidth: width)
            Circle().trim(from: 0, to: max(0.001, min(1, value))).stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round)).rotationEffect(.degrees(-90))
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

struct PrayerWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry

    var body: some View {
        content
            .environment(\.layoutDirection, entry.rtl ? .rightToLeft : .leftToRight)
            .widgetURL(URL(string: "ayahflow://prayer"))
            .modifier(WidgetBackground())
    }

    @ViewBuilder var content: some View {
        if family == .systemMedium && entry.page != .prayer { paged(entry.page == .dhikr ? AnyView(dhikrPage) : entry.page == .steps ? AnyView(stepsPage) : AnyView(AyahBody(entry: entry, compact: true))) }
        else if entry.state != .ready || entry.next == nil {
            VStack(alignment: .leading, spacing: 6) {
                Text("AyahFlow").font(.system(.headline, design: .serif)).foregroundColor(Palette.gold)
                Text(entry.state == .stale ? (entry.labels["stale"] ?? "Open AyahFlow to refresh prayer times.") : (entry.labels["noPlace"] ?? "Save Home in AyahFlow to see prayer times."))
                    .font(.caption).foregroundColor(Palette.muted)
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else if let next = entry.next {
            switch family {
            case .accessoryInline: Text("\(next.label) \(next.date, style: .time)")
            case .accessoryCircular: circular(next)
            case .accessoryRectangular: rectangular(next)
            case .systemMedium: paged(AnyView(medium(next)))
            case .systemLarge: large(next)
            default: small(next)
            }
        }
    }

    // MARK: Pieces
    private var eyebrow: some View {
        Text((entry.labels["next"] ?? "Next prayer").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundColor(Palette.gold)
    }

    @ViewBuilder private func progress(_ next: SharedTimeline.Prayer) -> some View {
        if #available(iOSApplicationExtension 16.0, *), entry.since < next.date {
            ProgressView(timerInterval: entry.since...next.date, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear).tint(Palette.gold)
        }
    }

    private func nextBlock(_ next: SharedTimeline.Prayer, size: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            eyebrow
            Text(next.label).font(.system(size: size, weight: .regular, design: .serif)).foregroundColor(Palette.text).minimumScaleFactor(0.6).lineLimit(1)
            Text(next.date, style: .time).font(.system(size: size * 0.55, weight: .medium, design: .serif)).foregroundColor(Palette.goldBright).monospacedDigit()
            Text(next.date, style: .timer).font(.caption.monospacedDigit()).foregroundColor(Palette.muted)
        }
    }

    private func dateHeader() -> some View {
        HStack(spacing: 6) {
            Text(formatted(entry.date, entry.locale, hijri: false)).foregroundColor(Palette.muted)
            Circle().fill(Palette.line).frame(width: 3, height: 3)
            Text(formatted(entry.date, entry.locale, hijri: true)).foregroundColor(Palette.gold)
        }.font(.system(size: 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
    }

    private func prayerRows(_ next: SharedTimeline.Prayer, spacing: CGFloat, font: Font) -> some View {
        VStack(spacing: spacing) {
            ForEach(entry.today, id: \.at) { p in
                let isNext = p.at == next.at, past = p.date <= entry.date
                HStack(spacing: 8) {
                    Rectangle().fill(isNext ? Palette.gold : (past ? Palette.gold.opacity(0.5) : Palette.line)).frame(width: 6, height: 6).rotationEffect(.degrees(45))
                    Text(p.label).foregroundColor(isNext ? Palette.gold : Palette.text)
                    if entry.kept.contains(p.key) && (p.day ?? dayKey(p.date)) == (entry.today.first?.day ?? dayKey(entry.date)) {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 11)).foregroundColor(Palette.green).accessibilityLabel(entry.labels["prayed"] ?? "prayed")
                    }
                    Spacer(minLength: 4)
                    Text(p.date, style: .time).monospacedDigit().foregroundColor(isNext ? Palette.goldBright : Palette.muted)
                }.font(font).opacity(past && !isNext ? 0.55 : 1)
            }
        }
    }

    @ViewBuilder private func momentLink() -> some View {
        if let m = entry.moment, let url = URL(string: "ayahflow://moment/\(m.key)") {
            Link(destination: url) {
                HStack(spacing: 5) { Image(systemName: m.key == "morning" ? "sun.max" : "moon.stars"); Text(m.label) }
                    .font(.caption2.weight(.semibold)).foregroundColor(Palette.bg)
                    .padding(.horizontal, 10).padding(.vertical, 5).background(Capsule().fill(Palette.gold))
            }
        }
    }

    private var athanStatus: some View {
        HStack(spacing: 4) { Image(systemName: entry.labels["athanOn"] == "1" ? "bell.fill" : "bell.slash"); Text(entry.labels["athan"] ?? "") }
            .font(.system(size: 10, weight: .medium)).foregroundColor(entry.labels["athanOn"] == "1" ? Palette.gold : Palette.muted).lineLimit(1)
    }

    // MARK: Pages
    /// Tabs along the top of the medium widget; each one switches page in place (iOS 17+). Older iOS shows prayer times only.
    @ViewBuilder private var tabs: some View {
        #if canImport(AppIntents)
        if #available(iOSApplicationExtension 17.0, *) {
            HStack(spacing: 4) {
                ForEach(WidgetPage.allCases, id: \.rawValue) { p in
                    Button(intent: ShowWidgetPage(p)) {
                        HStack(spacing: 3) { Image(systemName: p.symbol); if p == entry.page { Text(p.label(entry.labels)) } }
                            .font(.system(size: 10, weight: .semibold)).lineLimit(1)
                            .foregroundColor(p == entry.page ? Palette.bg : Palette.muted)
                            .padding(.horizontal, p == entry.page ? 8 : 6).padding(.vertical, 4)
                            .background(Capsule().fill(p == entry.page ? Palette.gold : Palette.line.opacity(0.6)))
                    }.buttonStyle(.plain)
                }
            }
        }
        #endif
    }

    private func paged(_ page: AnyView) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) { dateHeader().layoutPriority(0); Spacer(minLength: 4); tabs.layoutPriority(1) }
            page.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func counter(_ id: String) -> SharedTimeline.Daily.Counter? { entry.daily?.counters.first { $0.id == id } }

    private func istighfarRing(size: CGFloat) -> some View {
        let c = counter("istighfar"), n = c?.n ?? 0, total = c?.total ?? 100
        return Link(destination: URL(string: "ayahflow://counter/istighfar")!) {
            Ring(value: Double(n % total == 0 && n > 0 ? total : n % total) / Double(total), color: n >= total ? Palette.green : Palette.gold, width: size / 11) {
                VStack(spacing: 0) {
                    Text("أستغفر الله").font(.system(size: size * 0.11, design: .serif)).foregroundColor(Palette.goldBright).lineLimit(1).minimumScaleFactor(0.5)
                    Text(number(n, entry.locale)).font(.system(size: size * 0.27, weight: .regular, design: .serif)).foregroundColor(Palette.text).monospacedDigit().minimumScaleFactor(0.5)
                    Text("/ " + number(total, entry.locale)).font(.system(size: size * 0.1)).foregroundColor(Palette.muted)
                }.padding(size * 0.14)
            }.frame(width: size, height: size)
        }
    }

    private func row(_ label: String, _ value: String, _ progress: Double?, done: Bool, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Text(label).foregroundColor(Palette.text).lineLimit(1).minimumScaleFactor(0.8)
                    Spacer(minLength: 2)
                    if done { Image(systemName: "checkmark").foregroundColor(Palette.green) }
                    Text(value).foregroundColor(done ? Palette.green : Palette.goldBright).monospacedDigit()
                }.font(.system(size: 11, weight: .medium))
                if let progress {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.line)
                            Capsule().fill(done ? Palette.green : Palette.gold).frame(width: g.size.width * max(0, min(1, progress)))
                        }
                    }.frame(height: 3)
                }
            }
        }
    }

    private var dhikrRows: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let t = counter("istighfar-tawbah") { row(t.label, number(t.n, entry.locale) + " / " + number(t.total, entry.locale) + (t.atLeast ? "+" : ""), Double(t.n) / Double(t.total), done: t.n >= t.total, url: "ayahflow://counter/\(t.id)") }
            if let t = counter("tasbih-prayer") { row(t.label, number(t.n / t.total, entry.locale) + " " + (entry.labels["rounds"] ?? "rounds"), nil, done: false, url: "ayahflow://counter/\(t.id)") }
            ForEach(entry.daily?.adhkar.filter { $0.total > 0 }.prefix(2) ?? [], id: \.key) { a in
                row(a.label, number(a.done, entry.locale) + " / " + number(a.total, entry.locale), Double(a.done) / Double(a.total), done: a.done >= a.total, url: "ayahflow://moment/\(a.key)")
            }
        }
    }

    private var dhikrPage: some View {
        HStack(alignment: .center, spacing: 14) {
            istighfarRing(size: 92)
            dhikrRows.frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder private func stepsSummary(ringSize: CGFloat) -> some View {
        if let st = entry.daily?.steps {
            let met = st.today >= st.goal
            HStack(alignment: .center, spacing: 14) {
                Ring(value: Double(st.today) / Double(max(1, st.goal)), color: met ? Palette.green : Palette.gold, width: ringSize / 11) {
                    Image(systemName: "figure.walk").font(.system(size: ringSize * 0.32)).foregroundColor(met ? Palette.green : Palette.gold)
                }.frame(width: ringSize, height: ringSize)
                VStack(alignment: .leading, spacing: 3) {
                    Text((entry.labels["stepsTab"] ?? "Steps").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundColor(Palette.gold)
                    Text(number(st.today, entry.locale)).font(.system(size: ringSize * 0.34, design: .serif)).foregroundColor(Palette.text).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
                    Text(met ? (entry.labels["goalReached"] ?? "Goal reached") : number(st.goal - st.today, entry.locale) + " " + (entry.labels["toGo"] ?? "to go"))
                        .font(.system(size: 11, weight: .medium)).foregroundColor(met ? Palette.green : Palette.goldBright)
                    HStack(spacing: 3) { Text(entry.labels["updated"] ?? "Updated"); Text(Date(timeIntervalSince1970: st.at / 1000), style: .time) }
                        .font(.system(size: 10)).foregroundColor(Palette.muted)
                }
                Spacer(minLength: 0)
            }
        } else {
            HStack(spacing: 10) {
                Image(systemName: "figure.walk").font(.title2).foregroundColor(Palette.gold)
                Text(entry.labels["stepsOff"] ?? "Turn on step tracking in AyahFlow to see steps here.").font(.caption).foregroundColor(Palette.muted)
            }
        }
    }

    private var stepsPage: some View { Link(destination: URL(string: "ayahflow://steps")!) { stepsSummary(ringSize: 88) } }

    // MARK: Families
    private func small(_ next: SharedTimeline.Prayer) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            nextBlock(next, size: 26)
            Spacer(minLength: 0)
            progress(next)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func medium(_ next: SharedTimeline.Prayer) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            dateHeader()
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) { nextBlock(next, size: 24); Spacer(minLength: 0); progress(next) }.frame(maxWidth: .infinity, alignment: .leading)
                prayerRows(next, spacing: 3, font: .system(size: 12)).frame(maxWidth: .infinity)
            }
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func large(_ next: SharedTimeline.Prayer) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("AyahFlow").font(.system(size: 13, weight: .semibold, design: .serif)).foregroundColor(Palette.gold); Spacer(); athanStatus }
            dateHeader()
            HStack(alignment: .bottom) { nextBlock(next, size: 34); Spacer() }
            progress(next)
            Rectangle().fill(Palette.line).frame(height: 1)
            prayerRows(next, spacing: 6, font: .system(size: 14, design: .serif))
            Spacer(minLength: 0)
            if entry.daily != nil {
                Rectangle().fill(Palette.line).frame(height: 1)
                HStack(alignment: .center, spacing: 12) {
                    istighfarRing(size: 70)
                    if entry.daily?.steps != nil { Link(destination: URL(string: "ayahflow://steps")!) { stepsSummary(ringSize: 52) } } else { dhikrRows }
                }
            }
            momentLink()
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

private struct WidgetBackground: ViewModifier {
    @Environment(\.widgetFamily) var family
    func body(content: Content) -> some View {
        let lockScreen: Bool
        if #available(iOSApplicationExtension 16.0, *) { lockScreen = [.accessoryInline, .accessoryRectangular, .accessoryCircular].contains(family) } else { lockScreen = false }
        let fill = LinearGradient(colors: [Palette.panel, Palette.bg], startPoint: .topLeading, endPoint: .bottomTrailing)
        if #available(iOSApplicationExtension 17.0, *) {
            return AnyView(content.containerBackground(for: .widget) { lockScreen ? AnyView(Color.clear) : AnyView(fill) })
        }
        return AnyView(content.padding().background(lockScreen ? AnyView(Color.clear) : AnyView(fill)))
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
            .description("Prayer times with a live countdown. The medium size has Prayer, Dhikr and Steps pages; the large size shows them together.")
            .supportedFamilies(families)
    }
}

/// Small istighfar and steps widgets: stack them with the prayer widget (Smart Stack) and swipe between them.
struct DhikrWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        let c = entry.daily?.counters.first { $0.id == "istighfar" }, n = c?.n ?? 0, total = c?.total ?? 100
        Group {
            if family == .systemSmall {
                VStack(spacing: 6) {
                    Text((c?.label ?? "Istighfar").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.1).foregroundColor(Palette.gold).lineLimit(1)
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

struct StepsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry
    var body: some View {
        let st = entry.daily?.steps
        Group {
            if family == .systemSmall {
                if let st {
                    VStack(alignment: .leading, spacing: 6) {
                        Text((entry.labels["stepsTab"] ?? "Steps").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.1).foregroundColor(Palette.gold)
                        Ring(value: Double(st.today) / Double(max(1, st.goal)), color: st.today >= st.goal ? Palette.green : Palette.gold, width: 8) {
                            VStack(spacing: 0) {
                                Text(number(st.today, entry.locale)).font(.system(size: 22, design: .serif)).foregroundColor(Palette.text).monospacedDigit().minimumScaleFactor(0.5).lineLimit(1)
                                Text("/ " + number(st.goal, entry.locale)).font(.system(size: 10)).foregroundColor(Palette.muted)
                            }.padding(10)
                        }.frame(maxWidth: .infinity)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Image(systemName: "figure.walk").font(.title2).foregroundColor(Palette.gold)
                        Text(entry.labels["stepsOff"] ?? "Turn on step tracking in AyahFlow to see steps here.").font(.caption).foregroundColor(Palette.muted)
                    }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            } else {
                circularGauge(st.map { Double($0.today) / Double(max(1, $0.goal)) } ?? 0, symbol: "figure.walk", value: st.map { $0.today >= 10000 ? number($0.today / 1000, entry.locale) + "k" : number($0.today, entry.locale) } ?? "—")
            }
        }
        .widgetURL(URL(string: "ayahflow://steps"))
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

struct StepsWidget: Widget {
    var families: [WidgetFamily] { if #available(iOSApplicationExtension 16.0, *) { return [.systemSmall, .accessoryCircular] }; return [.systemSmall] }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowSteps", provider: Provider()) { StepsWidgetView(entry: $0) }
            .configurationDisplayName("Steps")
            .description("Today's steps against your goal, as last read by AyahFlow.")
            .supportedFamilies(families)
    }
}

extension Font {
    /// Quran text in the bundled AyahFlow Quran font (Scheherazade New, adapted; UIAppFonts), the same font as the reader: the system font misplaces
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

/// The Lock Screen rectangle (about 160×72 pt): the reference line with the ayah under it at 13–10 pt; if it does not
/// fit, the ayah alone filling the rectangle at 15–10 pt; only then the reference and "Read it in its surah". Sizes were
/// measured against every du'a and Ayah of the Moment with this font; the text is never cut off.
@available(iOSApplicationExtension 16.0, *)
struct LockScreenAyah: View {
    let text: String
    let title: String
    let caption: String
    var body: some View {
        ViewThatFits(in: .vertical) {
            titled(13); titled(11.5); titled(10)
            line(15); line(13); line(11.5); line(10)
            VStack(alignment: .leading, spacing: 2) { header; Label(caption, systemImage: "book").font(.system(size: 13)) }
        }
    }
    private var header: some View {
        Label(title, systemImage: "book.closed.fill").font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
    }
    private func titled(_ s: CGFloat) -> some View { VStack(alignment: .leading, spacing: 1) { header; line(s) } }
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
                        Text((entry.labels["ayahTab"] ?? "Du'a from the Quran").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundColor(Palette.gold).lineLimit(1)
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
                        Text((entry.labels["momentTab"] ?? "Ayah of the moment").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundColor(Palette.gold).lineLimit(1)
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
        MomentWidget()
        AyahWidget()
        IstighfarWidget()
        StepsWidget()
    }
}
