import WidgetKit
import SwiftUI
import Security

/// Timeline precomputed by the app (src/smart.ts widgetData) and shared through the keychain. No coordinates.
struct SharedTimeline: Decodable {
    struct Prayer: Decodable { let key: String; let label: String; let at: Double }
    struct Window: Decodable { let morning: [Double]?; let evening: [Double]? }
    let v: Int
    let updatedAt: Double
    let rtl: Bool
    let locale: String?
    let prayers: [Prayer]
    let windows: [Window]
    let labels: [String: String]

    static func load() -> SharedTimeline? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "AyahFlowSharedKeychain") as? String else { return nil }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "app.ayahflow.widget", kSecAttrAccount as String: "timeline", kSecAttrAccessGroup as String: group, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SharedTimeline.self, from: data)
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
}

struct Provider: TimelineProvider {
    private static func sample() -> PrayerEntry {
        let now = Date(), at = { (h: Double) in now.addingTimeInterval(h * 3600).timeIntervalSince1970 * 1000 }
        let today: [SharedTimeline.Prayer] = [.init(key: "fajr", label: "Fajr", at: at(-8)), .init(key: "dhuhr", label: "Dhuhr", at: at(-2)), .init(key: "asr", label: "Asr", at: at(1.4)), .init(key: "maghrib", label: "Maghrib", at: at(4)), .init(key: "isha", label: "Isha", at: at(5.3))]
        return PrayerEntry(date: now, state: .ready, next: today[2], since: today[1].date, today: today, moment: nil, labels: ["next": "Next prayer", "athan": "Athan", "athanOn": "1"], rtl: false, locale: .current)
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
            let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(86400).timeIntervalSince1970 * 1000
            let bounds = data.prayers.map { $0.at } + data.windows.flatMap { ($0.morning ?? []) + ($0.evening ?? []) } + [midnight]
            dates += Set(bounds.filter { $0 > nowMs && $0 < horizon }).sorted().map { Date(timeIntervalSince1970: $0 / 1000 + 1) }
        }
        completion(Timeline(entries: dates.map { entry(at: $0, data) }, policy: .after(dates.last!.addingTimeInterval(3600))))
    }

    private func entry(at date: Date, _ data: SharedTimeline?) -> PrayerEntry {
        let locale = data?.locale.map { Locale(identifier: $0) } ?? .current
        func empty(_ s: PrayerEntry.State) -> PrayerEntry { PrayerEntry(date: date, state: s, next: nil, since: date, today: [], moment: nil, labels: data?.labels ?? [:], rtl: data?.rtl ?? false, locale: locale) }
        guard let data, !data.prayers.isEmpty else { return empty(.noData) }
        let ms = date.timeIntervalSince1970 * 1000
        guard let index = data.prayers.firstIndex(where: { $0.at > ms }) else { return empty(.stale) }
        let next = data.prayers[index]
        let dayStart = Calendar.current.startOfDay(for: date)
        let since = index > 0 ? data.prayers[index - 1].date : dayStart
        let dayEnd = dayStart.addingTimeInterval(86400)
        let today = data.prayers.filter { $0.date >= dayStart && $0.date < dayEnd }
        let inside = { (w: [Double]?) in w.map { $0.count == 2 && ms >= $0[0] && ms < $0[1] } ?? false }
        let moment: (key: String, label: String)? = data.windows.contains { inside($0.morning) } ? (key: "morning", label: data.labels["morning"] ?? "Morning adhkar")
            : data.windows.contains { inside($0.evening) } ? (key: "evening", label: data.labels["evening"] ?? "Evening adhkar") : nil
        return PrayerEntry(date: date, state: .ready, next: next, since: max(since, next.date.addingTimeInterval(-12 * 3600)), today: today.isEmpty ? Array(data.prayers[index...].prefix(5)) : today, moment: moment, labels: data.labels, rtl: data.rtl, locale: locale)
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
        if entry.state != .ready || entry.next == nil {
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
            case .systemMedium: medium(next)
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
            prayerRows(next, spacing: 8, font: .system(size: 15, design: .serif))
            Spacer(minLength: 0)
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
            .description("The next prayer with a live countdown, today's times, the Hijri date and the adhkar for the moment.")
            .supportedFamilies(families)
    }
}

@main
struct AyahFlowWidgets: WidgetBundle {
    var body: some Widget { NextPrayerWidget() }
}
