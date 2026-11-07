// Measures each du'a against the Lock Screen rectangle with the widget's own font and SwiftUI layout (macOS).
// Run through scripts/measure-lock-duas.mjs, which passes: font path, du'as JSON path, width, height.
import SwiftUI
import AppKit
import CoreText

let args = CommandLine.arguments
CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: args[1]) as CFURL, .process, nil)
struct Dua: Decodable { let ref: String; let name: String; let text: String }
let duas = try! JSONDecoder().decode([Dua].self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
let width = CGFloat(Double(args[3])!), height = CGFloat(Double(args[4])!)

// Same views as LockScreenAyah in ios/App/AyahFlowWidget/AyahFlowWidget.swift.
func line(_ t: String, _ s: CGFloat) -> some View {
    Text(t).font(.custom("AyahFlow Quran", size: s)).multilineTextAlignment(.trailing).fixedSize(horizontal: false, vertical: true)
        .environment(\.layoutDirection, .rightToLeft).frame(maxWidth: .infinity, alignment: .trailing)
}
func header(_ t: String) -> some View { Label(t, systemImage: "book.closed.fill").font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8) }
@MainActor func fits<V: View>(_ v: V) -> Bool { NSHostingController(rootView: v.frame(width: width)).sizeThatFits(in: CGSize(width: width, height: 10000)).height <= height }

MainActor.assumeIsolated {
    for d in duas {
        let titled = [13.0, 11.5, 10.0].contains { s in fits(VStack(alignment: .leading, spacing: 1) { header("Surah \(d.name), \(d.ref)"); line(d.text, s) }) }
        if titled || [15.0, 13.0, 11.5, 10.0].contains(where: { fits(line(d.text, $0)) }) { print(d.ref) }
    }
}
