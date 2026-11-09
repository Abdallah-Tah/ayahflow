// Measures text contrast over the illustrated backgrounds as the widget and the app draw them: each picture placed and
// cropped the same way, the same scrim and fade composited in display (gamma) space as SwiftUI and WebKit do, then the
// WCAG contrast between the dimmest text colour drawn there and every background pixel behind that text.
//
//   swift scripts/art-contrast.swift > evidence/art-backgrounds-2026-11-09/contrast.json
//   ART_PNG=<folder> swift scripts/art-contrast.swift   # also writes each composited surface (no text) as a PNG
//
// A surface passes when 99% of the pixels behind its text give at least 4.5:1; "worst" is the single brightest pixel
// (a star, a lit window) and is reported, not hidden. Geometry and scrims must stay in step with `Art` in
// ios/App/AyahFlowWidget/AyahFlowWidget.swift and the "Illustrated backgrounds" block of public/style.css.
import Foundation
import CoreGraphics
import ImageIO

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let emerald: UInt32 = 0x0F3D2E, deep: UInt32 = 0x082519, cream: UInt32 = 0xF7EFDD
func widgetFile(_ n: String) -> String { "ios/App/AyahFlowWidget/Backgrounds.xcassets/\(n).imageset/\(n).jpg" }
func webFile(_ n: String) -> String { "public/art/\(n).webp" }

func load(_ path: String) -> CGImage {
    let url = root.appendingPathComponent(path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("cannot read \(path)") }
    return img
}
func rgb(_ c: UInt32) -> [Double] { [Double((c >> 16) & 255) / 255, Double((c >> 8) & 255) / 255, Double(c & 255) / 255] }
func lin(_ v: Double) -> Double { v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
func lum(_ c: [Double]) -> Double { 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) }
func ratio(_ a: Double, _ b: Double) -> Double { (max(a, b) + 0.05) / (min(a, b) + 0.05) }
func mix(_ a: [Double], _ b: [Double], _ t: Double) -> [Double] { (0..<3).map { a[$0] * (1 - t) + b[$0] * t } }

/// A surface `w` × `h` points. `place` gives the picture's frame in points (top-left origin); `base` is the colour under
/// the picture at a point; `show` how much of the picture shows there (mask × layer); `scrim` the colour and opacity over
/// it; `text` the zones where text sits, as fractions, with the dimmest colour used in each.
struct Surface {
    let name: String; let file: String; let w: Double; let h: Double
    let place: CGRect
    var base: (Double, Double) -> [Double] = { _, _ in rgb(0x082519) }
    var show: (Double, Double) -> Double = { _, _ in 1 }
    var scrim: (Double, Double) -> ([Double], Double)
    let text: [(CGRect, UInt32)]
}

let s3 = 3.0
func pixels(_ img: CGImage, _ s: Surface) -> (Int, Int, [UInt8]) {
    let pw = Int(s.w * s3), ph = Int(s.h * s3)
    var px = [UInt8](repeating: 0, count: pw * ph * 4)
    px.withUnsafeMutableBytes { buf in
        let ctx = CGContext(data: buf.baseAddress, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: pw * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.interpolationQuality = .medium
        let r = s.place
        ctx.draw(img, in: CGRect(x: r.minX * s3, y: (s.h - r.maxY) * s3, width: r.width * s3, height: r.height * s3)) // CG: bottom-left origin
    }
    return (pw, ph, px)
}

func run(_ s: Surface) -> [String: Any] {
    let img = load(s.file), (pw, ph, px) = pixels(img, s)
    var out = px, results: [[String: Any]] = [], allPass = true
    func colour(_ x: Int, _ y: Int) -> [Double] {
        let fx = (Double(x) + 0.5) / Double(pw), fy = (Double(y) + 0.5) / Double(ph), i = (y * pw + x) * 4
        let p = [Double(px[i]), Double(px[i + 1]), Double(px[i + 2])].map { $0 / 255 }
        let inside = s.place.contains(CGPoint(x: fx * s.w, y: fy * s.h))
        let under = mix(s.base(fx, fy), p, inside ? s.show(fx, fy) : 0)
        let (c, a) = s.scrim(fx, fy)
        return mix(under, c, inside ? a : 0) // the scrim belongs to the picture's layer
    }
    for y in 0..<ph { for x in 0..<pw { let c = colour(x, y), i = (y * pw + x) * 4; for k in 0..<3 { out[i + k] = UInt8((c[k] * 255).rounded()) }; out[i + 3] = 255 } }
    for (zone, text) in s.text {
        let fl = lum(rgb(text))
        var ratios: [Double] = []
        for y in Int(zone.minY * Double(ph))..<Int(zone.maxY * Double(ph)) { for x in Int(zone.minX * Double(pw))..<Int(zone.maxX * Double(pw)) {
            let i = (y * pw + x) * 4
            ratios.append(ratio(fl, lum([Double(out[i]), Double(out[i + 1]), Double(out[i + 2])].map { $0 / 255 })))
        } }
        ratios.sort()
        let p99 = ratios[Int(Double(ratios.count) * 0.01)], worst = ratios[0]
        allPass = allPass && p99 >= 4.5
        results.append(["zone": [zone.minX, zone.minY, zone.maxX, zone.maxY].map { ($0 * 100).rounded() / 100 }, "text": String(format: "#%06X", text), "p99": (p99 * 100).rounded() / 100, "worst": (worst * 100).rounded() / 100])
    }
    if let dir = ProcessInfo.processInfo.environment["ART_PNG"] {
        out.withUnsafeMutableBytes { buf in
            let ctx = CGContext(data: buf.baseAddress, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: pw * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            let url = URL(fileURLWithPath: dir).appendingPathComponent(s.name.replacingOccurrences(of: " · ", with: "-").replacingOccurrences(of: " ", with: "-") + ".png")
            let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
            CGImageDestinationAddImage(dest, ctx.makeImage()!, nil); CGImageDestinationFinalize(dest)
        }
    }
    return ["surface": s.name, "size": "\(Int(s.w)) × \(Int(s.h)) pt", "pass": allPass, "zones": results]
}

var surfaces: [Surface] = []
let ar = 1200.0 / 675.0

// Widget, dark scenes: ArtWindow. The picture spans the width / 0.9, anchored at the bottom, the scrim inside it, a mask
// from clear at 30% of its height to opaque at 62%; above it the arch's emerald gradient. Text: medium/small centred
// column, large text in the top 62%.
let widgetScrim: [String: Double] = ["fajr_dawn": 0.3, "asr_afternoon": 0.45, "maghrib_sunset": 0.35, "isha_night": 0.25, "dhikr_tasbih": 0.35, "daily_moments": 0.3]
let gold: UInt32 = 0xD8B56C, goldLight: UInt32 = 0xEFD293, onEmeraldMuted: UInt32 = 0xB7C2AF, onEmerald: UInt32 = 0xF4ECD8
func window(_ name: String, _ art: String, w: Double, h: Double, text: [(CGRect, UInt32)]) -> Surface {
    let iw = w / 0.9, ih = iw / ar, a = widgetScrim[art]!
    let rect = CGRect(x: (w - iw) / 2, y: h - ih, width: iw, height: ih)
    return Surface(name: name, file: widgetFile(art), w: w, h: h, place: rect,
                   base: { _, y in mix(rgb(emerald), rgb(deep), y) },
                   show: { _, y in let t = (y * h - rect.minY) / ih; return min(1, max(0, (t - 0.3) / 0.32)) },
                   scrim: { _, y in let t = (y * h - rect.minY) / ih; return (rgb(deep), a * min(1, max(0, (t - 0.3) / 0.32))) },
                   text: text)
}
// Text zones measured from the simulator screenshots (fractions of the arch).
for art in ["fajr_dawn", "asr_afternoon", "maghrib_sunset", "isha_night"] {
    surfaces.append(window("widget medium · \(art)", art, w: 112, h: 105, text: [(CGRect(x: 0.1, y: 0.1, width: 0.8, height: 0.18), gold), (CGRect(x: 0.08, y: 0.28, width: 0.84, height: 0.32), onEmerald), (CGRect(x: 0.2, y: 0.6, width: 0.6, height: 0.14), goldLight), (CGRect(x: 0.28, y: 0.74, width: 0.44, height: 0.1), onEmerald)]))
    surfaces.append(window("widget large · \(art)", art, w: 128, h: 178, text: [(CGRect(x: 0.08, y: 0.06, width: 0.84, height: 0.56), gold)]))
    surfaces.append(window("widget small · \(art)", art, w: 139, h: 139, text: [(CGRect(x: 0.1, y: 0.1, width: 0.8, height: 0.5), goldLight), (CGRect(x: 0.22, y: 0.6, width: 0.56, height: 0.13), goldLight), (CGRect(x: 0.28, y: 0.73, width: 0.44, height: 0.1), onEmerald)]))
}
surfaces.append(window("widget dhikr · dhikr_tasbih", "dhikr_tasbih", w: 96, h: 105, text: [(CGRect(x: 0.15, y: 0.1, width: 0.7, height: 0.14), gold), (CGRect(x: 0.32, y: 0.36, width: 0.36, height: 0.24), onEmerald), (CGRect(x: 0.36, y: 0.6, width: 0.28, height: 0.1), onEmeraldMuted)]))
surfaces.append(window("widget moments · daily_moments", "daily_moments", w: 86, h: 105, text: [(CGRect(x: 0.1, y: 0.25, width: 0.8, height: 0.45), onEmerald)]))
// Widget, the light scenes (midday, the cream du'a): ArtPaper. 1.95× the height, 7% below the frame, centred near the
// mosque (0.8 across); a cream scrim down to 82%, then easing to a quarter. Dark text: labels and the time in gold
// #765214, the prayer's name and the countdown in ink #1B271E.
let ink: UInt32 = 0x1B271E, inkGold: UInt32 = 0x765214
let daylightScrim = 0.66
func paper(_ name: String, _ art: String, w: Double, h: Double, scrim a: Double, text: [(CGRect, UInt32)]) -> Surface {
    let ih = max(h * 1.95, w / ar / 0.9), iw = ih * ar, edge = iw * 0.04
    let x = min(max(w / 2 - 0.8 * iw, w - iw + edge), -edge)
    return Surface(name: name, file: widgetFile(art), w: w, h: h, place: CGRect(x: x, y: h - ih * 0.93, width: iw, height: ih),
                   scrim: { _, y in (rgb(cream), y <= 0.82 ? a : a * (1 - 0.75 * (y - 0.82) / 0.18)) }, text: text)
}
surfaces.append(paper("widget medium · dhuhr_daylight", "dhuhr_daylight", w: 112, h: 105, scrim: daylightScrim, text: [(CGRect(x: 0.1, y: 0.1, width: 0.8, height: 0.18), inkGold), (CGRect(x: 0.08, y: 0.28, width: 0.84, height: 0.32), ink), (CGRect(x: 0.2, y: 0.6, width: 0.6, height: 0.14), inkGold), (CGRect(x: 0.28, y: 0.74, width: 0.44, height: 0.1), ink)]))
surfaces.append(paper("widget large · dhuhr_daylight", "dhuhr_daylight", w: 128, h: 178, scrim: daylightScrim, text: [(CGRect(x: 0.08, y: 0.06, width: 0.84, height: 0.56), inkGold)]))
surfaces.append(paper("widget small · dhuhr_daylight", "dhuhr_daylight", w: 139, h: 139, scrim: daylightScrim, text: [(CGRect(x: 0.1, y: 0.1, width: 0.8, height: 0.2), inkGold), (CGRect(x: 0.1, y: 0.3, width: 0.8, height: 0.3), ink), (CGRect(x: 0.22, y: 0.6, width: 0.56, height: 0.13), inkGold), (CGRect(x: 0.28, y: 0.73, width: 0.44, height: 0.1), ink)]))
surfaces.append(paper("widget quran · quran_dua", "quran_dua", w: 76, h: 105, scrim: 0.45, text: [(CGRect(x: 0.08, y: 0.2, width: 0.84, height: 0.4), ink)]))

// App banner (.art-hero), at a 358 pt phone card 133 pt high and a 556 × 188 tablet card, left to right and right to
// left. Text column: the start 58% (title max-width 62% inside 18 pt padding); scrim full there, easing to a quarter.
let heroScrim: [String: Double] = ["dhikr_tasbih": 0.6, "hifz_practice": 0.7, "daily_moments": 0.5, "quran_dua": 0.55]
for art in ["dhikr_tasbih", "hifz_practice", "daily_moments", "quran_dua"] {
    let light = art == "quran_dua", a = heroScrim[art]!, tint = light ? cream : deep
    let textColour: UInt32 = light ? 0x765214 : 0xEFD293 // the eyebrow; the title is brighter (darker on cream)
    for (label, w, h) in [("phone", 358.0, 133.0), ("tablet", 556.0, 188.0)] {
        for rtl in [false, true] {
            let iw = (rtl ? 1.65 : 1.12) * w, ih = iw / ar, x = rtl ? -0.066 * w : w + 0.04 * w - iw
            let column = rtl ? CGRect(x: 0.42, y: 0.12, width: 0.53, height: 0.8) : CGRect(x: 0.05, y: 0.12, width: 0.53, height: 0.8)
            surfaces.append(Surface(name: "app banner \(label)\(rtl ? " rtl" : "") · \(art)", file: webFile(art), w: w, h: h, place: CGRect(x: x, y: h - ih, width: iw, height: ih),
                                    base: { _, _ in rgb(light ? cream : deep) },
                                    scrim: { fx, _ in let d = rtl ? 1 - fx : fx; return (rgb(tint), d <= 0.58 ? a : a * (1 - 0.75 * (d - 0.58) / 0.42)) },
                                    text: [(column, textColour)]))
        }
    }
}
// Next-prayer card (.prayer-day.has-art): the scene in a window 3.4:1 across the arch top, 112% wide, bottom-anchored,
// a scrim, masked opaque to 40% then clear at 85%; the eyebrow and athan chip start at 23% of the width. Measured over
// the band from there to the end of the window, against the eyebrow gold #D9BB79 (dark page) / the light page's #E6C780.
let cardScrim: [String: Double] = ["fajr_dawn": 0.2, "dhuhr_daylight": 0.42, "asr_afternoon": 0.3, "maghrib_sunset": 0.2, "isha_night": 0.2]
for art in ["fajr_dawn", "dhuhr_daylight", "asr_afternoon", "maghrib_sunset", "isha_night"] {
    for (label, w) in [("phone", 358.0), ("tablet", 556.0)] {
        let wh = w / 3.4, h = w * 0.23 + 60, iw = 1.12 * w, ih = iw / ar, a = cardScrim[art]!
        surfaces.append(Surface(name: "app prayer card \(label) · \(art)", file: webFile(art), w: w, h: h, place: CGRect(x: (w - iw) / 2, y: wh - ih, width: iw, height: ih),
                                base: { _, _ in rgb(0x0D2C21) },
                                show: { _, y in let t = y * h / wh; return t <= 0.4 ? 1 : max(0, 1 - (t - 0.4) / 0.45) },
                                scrim: { _, y in let t = y * h / wh; return (rgb(deep), t >= 1 ? 0 : a * (t <= 0.4 ? 1 : max(0, 1 - (t - 0.4) / 0.45))) },
                                text: [(CGRect(x: 0.04, y: (w * 0.23) / h, width: 0.92, height: min(1, wh / h) - (w * 0.23) / h + 0.001), 0xD9BB79)]))
    }
}
// Home band: a vignette of the home scene below the date row: a box from 28 pt down, 175 pt wide at the end side of a
// 390 × 112 pt band, the picture 240 pt wide anchored right −7 pt / bottom, faded in from the start side (opaque at 45%)
// and from the top (opaque at 30%). The date line (#F4ECD8, the hijri date link in gold #D9BB79) is above the box.
do {
    let w = 390.0, h = 112.0, top = 28.0, bw = 175.0, iw = 240.0, ih = iw / ar
    surfaces.append(Surface(name: "app home band · home_emerald", file: webFile("home_emerald"), w: w, h: h, place: CGRect(x: w + 7 - iw, y: h - ih, width: iw, height: ih),
                            base: { _, _ in rgb(0x082119) },
                            show: { fx, fy in let x = fx * w - (w - bw), y = fy * h - top; return x < 0 || y < 0 ? 0 : min(1, x / (0.45 * bw)) * min(1, y / (0.3 * (h - top))) },
                            scrim: { _, _ in (rgb(deep), 0) },
                            text: [(CGRect(x: 22 / w, y: 8 / h, width: 1 - 44 / w, height: 20 / h), 0xD9BB79)]))
}

let rows = surfaces.map(run)
let out = try! JSONSerialization.data(withJSONObject: ["measuredWith": "scripts/art-contrast.swift", "rule": "99% of the background pixels behind each text zone give at least 4.5:1 against the dimmest text colour in that zone", "surfaces": rows], options: [.prettyPrinted, .sortedKeys])
print(String(data: out, encoding: .utf8)!)
for r in rows where (r["pass"] as? Bool) != true {
    let worst = (r["zones"] as! [[String: Any]]).map { $0["p99"] as! Double }.min()!
    FileHandle.standardError.write("FAIL \(r["surface"]!): \(worst)\n".data(using: .utf8)!)
}
