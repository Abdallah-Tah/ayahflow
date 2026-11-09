// The 2026-11-08 widget redesign (emerald, cream, gold): five pages under the same in-widget tabs, Daily moments in place
// of Steps, honest data (lunar dates marked, only confirmed adhkar ticked), Arabic laid out right to left and tappable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upcomingDays, upcomingOccasions } from '../www/js/calendar.js';
import { tr } from '../www/js/i18n.js';

process.env.TZ = 'America/New_York';
const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const smart = readFileSync(new URL('../src/smart.ts', import.meta.url), 'utf8');

test('Five pages switched in place by the same App Intent; a widget left on Steps opens on Daily moments', () => {
    assert.match(swift, /case prayer, dhikr, moments, ayah, upcoming\n/);
    assert.match(swift, /WidgetPage\(rawValue: UserDefaults\.standard\.integer\(forKey: "widgetPage"\)\) \?\? \.prayer/, 'the saved page is read as before');
    assert.match(swift, /struct ShowWidgetPage: AppIntent[\s\S]*?UserDefaults\.standard\.set\(page, forKey: "widgetPage"\)/);
    assert.match(swift, /Button\(intent: ShowWidgetPage\(p\)\)/);
    for (const page of ['PrayerPage', 'UpcomingPage', 'DhikrPage', 'MomentsPage', 'QuranPage']) assert.match(swift, new RegExp(`case \\.\\w+: ${page}\\(`), page);
    assert.doesNotMatch(swift, /figure\.walk"|stepsTab|stepsOff|struct StepsWidgetView|\bSteps: Decodable/, 'no step page, label or decoder');
    assert.match(swift, /StaticConfiguration\(kind: "AyahFlowSteps", provider: Provider\(\)\) \{ MomentsWidgetView/, 'the old kind now shows Daily moments, so a placed widget keeps its place');
});

test('Tabs: the selected one is a gold capsule with its whole label, every tab has a VoiceOver name', () => {
    assert.match(swift, /if on && !info\.entry\.rtl \{ Text\(p\.label\(info\.l\)\)[^\n]*\.fixedSize\(\) \}/, 'the selected label is never cut');
    assert.match(swift, /\.accessibilityLabel\(p\.label\(info\.l\)\)\s*\.accessibilityAddTraits\(on \? \.isSelected : \[\]\)/);
    assert.match(swift, /LinearGradient\(colors: \[Palette\.leafLight, Palette\.leaf\]/);
    // The header tries each layout whole, widest first: the wordmark and the chip give way before the tabs.
    assert.match(swift, /ViewThatFits\(in: \.horizontal\) \{\s*row\(mark: true, chip: false, divider: true\)[\s\S]*?row\(mark: false, chip: nil, divider: false\)\s*\}/);
    for (const [k, en] of [['widgetQuran', 'Quran'], ['widgetUpcomingShort', 'Upcoming'], ['widgetMoments', 'Moments']]) assert.equal(tr(k, 'en'), en);
    assert.match(smart, /quranTab: label\('widgetQuran'\), upcomingShort: label\('widgetUpcomingShort'\)/);
});

test('Arabic: right to left, tabs still tappable, no letter spacing, times in the app language', () => {
    // In a right-to-left environment the tab buttons did not respond on iOS 18.6 (simulator, 2026-11-08): the row is laid
    // out left to right with the order reversed, which looks the same and keeps the taps where the tabs are drawn.
    assert.match(swift, /ForEach\(info\.entry\.rtl \? WidgetPage\.order\.reversed\(\) : WidgetPage\.order, id: \\\.rawValue\)/);
    assert.match(swift, /\}\.fixedSize\(\)\.environment\(\\\.layoutDirection, \.leftToRight\)/);
    for (const m of swift.matchAll(/\.kerning\(([^)]*)\)/g)) assert.match(m[1], /rtl \? 0 :/, 'letter spacing breaks Arabic joining');
    assert.match(swift, /\.environment\(\\\.locale, entry\.locale\)/);
    // A language change re-plans the widget and reminders at once (they carried the old language until the next launch).
    assert.match(app, /case 'language':\s*await commit\(\{ \.\.\.state, locale: d\.locale as Locale \}\);\s*render\(\);[\s\S]{0,160}void syncSmart\(\);\s*break;/);
});

test('Tinted and clear looks: filled panels become outlines so no text sits on a solid block', () => {
    assert.match(swift, /@Environment\(\\\.widgetRenderingMode\) var mode/);
    assert.match(swift, /if isNext \{ if full \{ Capsule\(\)\.fill\(Palette\.highlight\) \} else \{ Capsule\(\)\.stroke/);
    assert.match(swift, /if on && full \{ Capsule\(\)\.fill\(LinearGradient[\s\S]*?else if on \{ Capsule\(\)\.stroke/);
    assert.match(swift, /static let bg = tone\(0xF6EEDC, 0x0F1712\)/, 'cream in light mode, green-black in dark mode');
});

test('Prayer page: the next prayer\'s day (tomorrow after Isha), confirmed prayers only, Today\'s adhkar never cut', () => {
    assert.match(swift, /let shownDay = next\.day \?\? dayKey\(date\)/);
    assert.match(swift, /info\.l\["wTomorrow"\] \?\? "Tomorrow"/);
    assert.match(swift, /if entry\.kept\.contains\(p\.key\)/, 'a tick only for prayers the user confirmed');
    assert.match(swift, /ViewThatFits\(in: \.horizontal\) \{ line\(key, name, a, arabic: ar\); line\(key, name, a, arabic: nil\) \}/);
    assert.match(swift, /Link\(destination: URL\(string: "ayahflow:\/\/moment\/\\\(key\)"\)!\)/);
    assert.match(app, /adhkar: \(\['morning', 'evening', 'sleep', 'vehicle', 'leave_home', 'enter_home'\] as const\)\.map\(m => \{ const \[done, total\] = momentProgress\(m\)/);
    assert.match(app, /function momentProgress\(m: Moment\): \[number, number\] \{ const e = entriesFor\(m\); const done = completedToday\(state, m\);/, 'progress counts confirmed adhkar only');
    assert.match(app, /sleepAt: state\.smart\.sleepTime \?\? ''/);
});

test('Upcoming: lunar dates marked "≈" with the Umm al-Qura note; Fridays, Mondays and Thursdays are certain', () => {
    const copy = { jumuah: 'J', jumuahSub: '', fast: 'F', why: r => r.join('+'), ramadan: 'R', ramadanSub: '' };
    const list = upcomingDays(copy, new Date(2026, 9, 29, 15).getTime(), 30, 30);
    for (const u of list) {
        if (u.kind === 'jumuah') assert.equal(u.lunar, false);
        if (u.kind === 'ramadan') assert.equal(u.lunar, true);
        if (u.kind === 'fast') assert.equal(u.lunar, !/monday|thursday/.test(u.sub), u.sub);
    }
    assert.ok(list.some(u => u.kind === 'fast' && u.lunar), 'a white day that is neither Monday nor Thursday');
    assert.ok(upcomingOccasions(k => k, 'UQ', Date.now(), 400).every(o => o.lunar === true));
    assert.match(swift, /var lunar: Bool\? = nil/, 'older shared data (no flag) still decodes');
    assert.match(swift, /mark = r\.lunar \? "≈ " : ""/);
    assert.match(swift, /"≈ " \+ \(info\.l\["wSightingLong"\]/);
});

test('Moments and Dhikr pages: links to the real screens, no claim of detection, rings only from saved counts', () => {
    for (const k of ['vehicle', 'leave_home', 'enter_home', 'sleep']) assert.match(swift, new RegExp(`\\("${k}", "[a-z.]+", "`), k);
    assert.match(swift, /Link\(destination: URL\(string: "ayahflow:\/\/moment\/\\\(m\.key\)"\)!\)/);
    assert.match(swift, /The widget detects nothing itself/);
    assert.match(swift, /if let a = info\.adhkar\(m\.key\), a\.total > 0, a\.done >= a\.total \{/);
    assert.match(swift, /if value > 0 \{ Circle\(\)\.trim/, 'an empty ring draws no progress at zero');
    assert.match(swift, /Link\(destination: URL\(string: "ayahflow:\/\/counter\/istighfar"\)!\)/);
});

test('Quran page: the corpus text, never cut; beside the arch only when it fits at 14 pt or more', () => {
    assert.match(swift, /VStack\(spacing: 4\) \{ lines\(\[19, 16\.5, 14\]\); reference\(a\) \}/);
    assert.match(swift, /FittedAyah\(text: a\.text, sizes: FittedAyah\.sizes\(\.systemMedium\)/);
    assert.match(swift, /Text\(text\)\.font\(\.quran\(s\)\)/);
    assert.doesNotMatch(swift, /\.lineLimit\([^)]*\)[^\n]*\.font\(\.quran|\.font\(\.quran\([^)]*\)\)[^\n]*\.minimumScaleFactor/, 'the Quran text is never truncated or squeezed');
});
