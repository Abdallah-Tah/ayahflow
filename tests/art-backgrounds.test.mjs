// The approved illustrated backgrounds (2026-11-09): WebP in the app, JPEG in the widget, each file used and none
// duplicated, the scene following the next prayer, words always live text, and a measured scrim behind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { prayerDayView } from '../www/js/smart.js';
import { initialState } from '../www/js/engine.js';

process.env.TZ = 'America/New_York';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bytes = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const css = read('public/style.css'), app = read('src/app.ts'), swift = read('ios/App/AyahFlowWidget/AyahFlowWidget.swift');
const PRAYER = { fajr: 'fajr_dawn', dhuhr: 'dhuhr_daylight', asr: 'asr_afternoon', maghrib: 'maghrib_sunset', isha: 'isha_night' };
const APP_ART = ['home_emerald', ...Object.values(PRAYER), 'quran_dua', 'dhikr_tasbih', 'hifz_practice', 'daily_moments'];
const WIDGET_ART = [...Object.values(PRAYER), 'dhikr_tasbih', 'daily_moments', 'quran_dua'];
const CATALOG = 'ios/App/AyahFlowWidget/Backgrounds.xcassets';

test('The app ships the ten WebP scenes, 1200 × 675, and nothing else in public/art', () => {
    assert.deepEqual(readdirSync(new URL('../public/art', import.meta.url)).sort(), APP_ART.map(n => `${n}.webp`).sort());
    let total = 0;
    for (const n of APP_ART) {
        const b = bytes(`public/art/${n}.webp`);
        assert.equal(b.toString('ascii', 0, 4), 'RIFF'); assert.equal(b.toString('ascii', 8, 15), 'WEBPVP8');
        // VP8 key frame: 14-bit width and height after the 3-byte start code.
        assert.deepEqual([b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff], [1200, 675], n);
        assert.ok(b.length < 50_000, `${n}: ${b.length} bytes`);
        total += b.length;
    }
    assert.equal(total, 369_288, 'the measured payload in the release checklist');
});

test('The widget catalog holds only the eight JPEGs it draws (no Home or Hifz art), and the project bundles it', () => {
    const sets = readdirSync(new URL(`../${CATALOG}`, import.meta.url)).filter(n => n.endsWith('.imageset')).map(n => n.replace('.imageset', ''));
    assert.deepEqual(sets.sort(), [...WIDGET_ART].sort());
    for (const n of WIDGET_ART) {
        const files = readdirSync(new URL(`../${CATALOG}/${n}.imageset`, import.meta.url));
        assert.deepEqual(files.sort(), ['Contents.json', `${n}.jpg`], 'one rendition, no duplicates');
        const b = bytes(`${CATALOG}/${n}.imageset/${n}.jpg`);
        assert.deepEqual([b[0], b[1]], [0xff, 0xd8], 'JPEG');
        assert.equal(JSON.parse(read(`${CATALOG}/${n}.imageset/Contents.json`)).images[0].filename, `${n}.jpg`);
    }
    // The Swift enum names exactly the catalog's images.
    const cases = [...swift.matchAll(/case [a-z, =" _]+/g)].join(' ');
    for (const n of WIDGET_ART) assert.ok(cases.includes(`"${n}"`), n);
    const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
    assert.match(pbx, /Backgrounds\.xcassets in Resources \*\/ = \{isa = PBXBuildFile; fileRef = (\w+)/);
    const widgetResources = pbx.slice(pbx.indexOf('F01ED660805D311F80E8FE42 /* Resources */ = {'), pbx.indexOf('/* End PBXResourcesBuildPhase section */'));
    assert.match(widgetResources, /Backgrounds\.xcassets in Resources/, 'in the widget target, not the app');
    assert.match(read('scripts/ios-add-widget.rb'), /group\.new_file\('Backgrounds\.xcassets'\)/, 'the setup helper adds it too');
});

test('Every scene is wired once: CSS maps each data-art to its file, and every file is used', () => {
    for (const n of APP_ART) assert.ok(css.includes(`[data-art=${n}]{--art:url(art/${n}.webp)}`) || (n === 'home_emerald' && css.includes('url(art/home_emerald.webp)')), n);
    for (const n of ['dhikr_tasbih', 'hifz_practice', 'quran_dua', 'daily_moments']) assert.match(app, new RegExp(`artHero\\('${n}'`), n);
    assert.match(app, /const PRAYER_ART: Record<PrayerName, string> = \{ fajr: 'fajr_dawn', dhuhr: 'dhuhr_daylight', asr: 'asr_afternoon', maghrib: 'maghrib_sunset', isha: 'isha_night' \};/);
    assert.match(css, /\.home-band::before\{[^}]*url\(art\/home_emerald\.webp\)/);
});

test('The scene follows the next prayer, including tomorrow\'s Fajr after Isha', () => {
    assert.match(app, /class="prayer-day widget has-art" data-art="\$\{PRAYER_ART\[next\.prayer\]\}"/);
    for (const [k, v] of Object.entries(PRAYER)) assert.match(swift, new RegExp(`case "${k}": return \\.${k}`), v);
    assert.match(swift, /ArchPanel\(width: large \? 128 : 112, art: Art\.prayer\(next\.key\)\)/);
    assert.match(swift, /ArtGate\(art: full \? Art\.prayer\(next\.key\) : nil\)/, 'the small size too');
    // After Isha, the app's next prayer is tomorrow's Fajr (so the card shows fajr_dawn).
    const s = { ...initialState(), places: { ...initialState().places, home: { lat: 40.71, lng: -74.0, radius: 150 } } };
    const late = new Date(2026, 10, 9, 22, 0).getTime();
    const day = prayerDayView(s, late);
    assert.ok(day); assert.equal(day.next.prayer, 'fajr'); assert.equal(day.tomorrow, true); assert.equal(day.next.day, '2026-11-10');
});

test('Pictures are decoration: words stay text, never behind Quran or adhkar text, hidden from assistive tech', () => {
    // App: only the banners, the prayer card window and the Home band carry a scene; reading cards never do.
    const uses = [...css.matchAll(/([^{}]+)\{[^}]*var\(--art\)/g)].map(m => m[1].trim());
    assert.ok(uses.length > 0 && uses.every(sel => /\.art-hero::before|\.art-window/.test(sel)), uses.join(' | '));
    for (const card of ['.verse-card', '.dhikr-card', '.ayah-day', '.hifz-verse', '.question-ayah']) assert.ok(!uses.some(sel => sel.includes(card)), card);
    assert.match(app, /<header class="art-hero" data-art="\$\{art\}"><p class="eyebrow">\$\{eyebrow\}<\/p><h1 class="page-title">\$\{title\}<\/h1><\/header>/);
    assert.match(app, /<span class="art-window" aria-hidden="true"><\/span>/);
    // Widget: every picture view is hidden from VoiceOver; the Quran page keeps the du'a on its own surface.
    for (const v of ['ArtWindow', 'ArtPaper']) assert.match(swift.slice(swift.indexOf(`private struct ${v}`), swift.indexOf(`private struct ${v}`) + 1400), /\.accessibilityHidden\(true\)/, v);
    assert.doesNotMatch(swift, /TEMP-SCREENSHOT|clock-offset/, 'no screenshot clock left in the widget');
});

test('Fallbacks: no picture in the tinted and clear looks or with Increase Contrast; the scene is never mirrored', () => {
    assert.match(swift, /ArtGate\(art: full \? art : nil\)/, 'ArchPanel passes art only in full colour');
    assert.match(swift, /contrast == \.increased \|\| UIImage\(named: \$0\.rawValue\) == nil \? nil : \$0/);
    for (const v of ['ArtWindow', 'ArtPaper']) assert.match(swift.slice(swift.indexOf(`private struct ${v}`), swift.indexOf(`private struct ${v}`) + 1400), /\.environment\(\\\.layoutDirection, \.leftToRight\)/, v);
    assert.doesNotMatch(css, /\.art-hero[^{]*\{[^}]*scaleX\(-1\)/, 'no mirroring in Arabic');
    assert.match(css, /\[dir=rtl\] \.art-hero::before\{right:auto;left:-6\.6%;width:165%\}/, 'cropped to the other side instead');
    assert.match(css, /\[dir=rtl\] \.home-band::before\{inset:28px auto 0 0;/);
});

test('Contrast: the measured report covers every surface and every one passes 4.5:1; scrims match the measurement', () => {
    const report = JSON.parse(read('evidence/art-backgrounds-2026-11-09/contrast.json'));
    assert.ok(report.surfaces.length >= 45);
    for (const s of report.surfaces) { assert.equal(s.pass, true, s.surface); for (const z of s.zones) assert.ok(z.p99 >= 4.5, `${s.surface}: ${z.p99}`); }
    const script = read('scripts/art-contrast.swift');
    const scrim = Object.fromEntries([...swift.slice(swift.indexOf('var scrim: Double'), swift.indexOf('var light: Bool')).matchAll(/case \.(\w+): return ([\d.]+)/g)].map(m => [m[1], Number(m[2])]));
    for (const [k, file] of [['fajr', 'fajr_dawn'], ['asr', 'asr_afternoon'], ['maghrib', 'maghrib_sunset'], ['isha', 'isha_night'], ['dhikr', 'dhikr_tasbih'], ['moments', 'daily_moments']]) assert.match(script, new RegExp(`"${file}": ${scrim[k]}[,\\]]`), k);
    assert.match(script, new RegExp(`let daylightScrim = ${scrim.dhuhr}\\b`));
    assert.match(script, new RegExp(`"quran_dua", w: 76, h: 105, scrim: ${scrim.dua},`));
    for (const [n, v] of [['hifz_practice', '.7'], ['daily_moments', '.5'], ['dhikr_tasbih', '.6']]) assert.ok(css.includes(`.art-hero[data-art=${n}]{--scrim:${v}}`), n);
});

test('Offline and light: the art is bundled, no network URL, the stylesheet stays small', () => {
    assert.doesNotMatch(css, /url\((?:"|')?https?:/);
    assert.ok(statSync(new URL('../public/style.css', import.meta.url)).size < 120_000);
    if (existsSync(new URL('../www/art', import.meta.url))) assert.deepEqual(readdirSync(new URL('../www/art', import.meta.url)).sort(), APP_ART.map(n => `${n}.webp`).sort(), 'the build copies exactly these');
});
