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

struct PrayerEntry: TimelineEntry {
    let date: Date
    let next: SharedTimeline.Prayer?
    let laterToday: [SharedTimeline.Prayer]
    let moment: (key: String, label: String)?
    let labels: [String: String]
    let rtl: Bool
    let state: State
    enum State { case ready, noData, stale }
}

struct Provider: TimelineProvider {
    private static let sample = PrayerEntry(date: Date(), next: .init(key: "asr", label: "Asr", at: Date().addingTimeInterval(5400).timeIntervalSince1970 * 1000), laterToday: [.init(key: "maghrib", label: "Maghrib", at: Date().addingTimeInterval(9000).timeIntervalSince1970 * 1000), .init(key: "isha", label: "Isha", at: Date().addingTimeInterval(14000).timeIntervalSince1970 * 1000)], moment: nil, labels: ["next": "Next prayer"], rtl: false, state: .ready)

    func placeholder(in context: Context) -> PrayerEntry { Provider.sample }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(context.isPreview ? Provider.sample : entry(at: Date(), SharedTimeline.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let data = SharedTimeline.load(), now = Date()
        // A new entry at now and at each prayer and window boundary in the next day, so "next" stays correct without the app.
        var dates = [now]
        if let data {
            let horizon = now.addingTimeInterval(26 * 3600).timeIntervalSince1970 * 1000, nowMs = now.timeIntervalSince1970 * 1000
            let bounds = data.prayers.map { $0.at } + data.windows.flatMap { ($0.morning ?? []) + ($0.evening ?? []) }
            dates += bounds.filter { $0 > nowMs && $0 < horizon }.sorted().map { Date(timeIntervalSince1970: $0 / 1000 + 1) }
        }
        let entries = dates.map { entry(at: $0, data) }
        completion(Timeline(entries: entries, policy: .after(dates.last!.addingTimeInterval(3600))))
    }

    private func entry(at date: Date, _ data: SharedTimeline?) -> PrayerEntry {
        guard let data, !data.prayers.isEmpty else { return PrayerEntry(date: date, next: nil, laterToday: [], moment: nil, labels: data?.labels ?? [:], rtl: data?.rtl ?? false, state: .noData) }
        let ms = date.timeIntervalSince1970 * 1000
        let upcoming = data.prayers.filter { $0.at > ms }
        guard let next = upcoming.first else { return PrayerEntry(date: date, next: nil, laterToday: [], moment: nil, labels: data.labels, rtl: data.rtl, state: .stale) }
        let today = Calendar.current.startOfDay(for: date).addingTimeInterval(86400).timeIntervalSince1970 * 1000
        let inside = { (w: [Double]?) in w.map { $0.count == 2 && ms >= $0[0] && ms < $0[1] } ?? false }
        let moment: (String, String)? = data.windows.contains { inside($0.morning) } ? ("morning", data.labels["morning"] ?? "Morning adhkar") : data.windows.contains { inside($0.evening) } ? ("evening", data.labels["evening"] ?? "Evening adhkar") : nil
        return PrayerEntry(date: date, next: next, laterToday: Array(upcoming.dropFirst().filter { $0.at < today }.prefix(3)), moment: moment.map { (key: $0.0, label: $0.1) }, labels: data.labels, rtl: data.rtl, state: .ready)
    }
}

private enum Palette {
    static let bg = Color(red: 16 / 255, green: 20 / 255, blue: 17 / 255)
    static let panel = Color(red: 30 / 255, green: 35 / 255, blue: 28 / 255)
    static let gold = Color(red: 217 / 255, green: 187 / 255, blue: 121 / 255)
    static let goldBright = Color(red: 239 / 255, green: 220 / 255, blue: 173 / 255)
    static let text = Color(red: 243 / 255, green: 240 / 255, blue: 231 / 255)
    static let muted = Color(red: 167 / 255, green: 173 / 255, blue: 159 / 255)
}

private extension SharedTimeline.Prayer { var date: Date { Date(timeIntervalSince1970: at / 1000) } }

struct PrayerWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerEntry

    var body: some View {
        content
            .environment(\.layoutDirection, entry.rtl ? .rightToLeft : .leftToRight)
            .widgetURL(URL(string: "ayahflow://prayer"))
            .modifier(Background())
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
            case .accessoryInline:
                Text("\(next.label) \(next.date, style: .time)")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(next.label).font(.headline)
                    Text(next.date, style: .time).font(.caption)
                    Text(next.date, style: .relative).font(.caption2)
                }
            case .systemMedium:
                HStack(alignment: .top, spacing: 14) {
                    nextBlock(next)
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(entry.laterToday, id: \.at) { p in
                            HStack { Text(p.label).foregroundColor(Palette.text); Spacer(); Text(p.date, style: .time).foregroundColor(Palette.muted) }.font(.caption)
                        }
                        Spacer(minLength: 0)
                        if let m = entry.moment, let url = URL(string: "ayahflow://moment/\(m.key)") {
                            Link(destination: url) {
                                Text(m.label).font(.caption2.weight(.semibold)).foregroundColor(Palette.bg)
                                    .padding(.horizontal, 9).padding(.vertical, 4).background(Capsule().fill(Palette.gold))
                            }
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            default:
                nextBlock(next)
            }
        }
    }

    func nextBlock(_ next: SharedTimeline.Prayer) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text((entry.labels["next"] ?? "Next prayer").uppercased()).font(.system(size: 10, weight: .semibold)).kerning(1.2).foregroundColor(Palette.gold)
            Text(next.label).font(.system(size: 26, weight: .regular, design: .serif)).foregroundColor(Palette.text).minimumScaleFactor(0.7).lineLimit(1)
            Text(next.date, style: .time).font(.subheadline.monospacedDigit()).foregroundColor(Palette.goldBright)
            Spacer(minLength: 0)
            Text(next.date, style: .timer).font(.caption.monospacedDigit()).foregroundColor(Palette.muted)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct Background: ViewModifier {
    @Environment(\.widgetFamily) var family
    func body(content: Content) -> some View {
        let lockScreen: Bool
        if #available(iOSApplicationExtension 16.0, *) { lockScreen = [.accessoryInline, .accessoryRectangular, .accessoryCircular].contains(family) } else { lockScreen = false }
        if #available(iOSApplicationExtension 17.0, *) {
            return AnyView(content.containerBackground(for: .widget) { lockScreen ? AnyView(Color.clear) : AnyView(LinearGradient(colors: [Palette.panel, Palette.bg], startPoint: .topLeading, endPoint: .bottomTrailing)) })
        }
        return AnyView(content.padding().background(lockScreen ? Color.clear : Palette.bg))
    }
}

struct NextPrayerWidget: Widget {
    var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) { return [.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline] }
        return [.systemSmall, .systemMedium]
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AyahFlowNextPrayer", provider: Provider()) { PrayerWidgetView(entry: $0) }
            .configurationDisplayName("Next prayer")
            .description("The next prayer time with a countdown, and the adhkar for the moment.")
            .supportedFamilies(families)
    }
}

@main
struct AyahFlowWidgets: WidgetBundle {
    var body: some Widget { NextPrayerWidget() }
}
