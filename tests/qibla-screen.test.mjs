// Qibla screen redesign (2026-11-09): the guidance is computed, never drawn from the mockup; the dial turns with the real
// heading; missing or unreliable sensors, location denial and magnetic north are said plainly; right to left never
// mirrors the compass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qiblaBearing, qiblaTurn, qiblaGuide, nearestAngle, QIBLA_ALIGNED, QIBLA_ROUGH } from '../www/js/qibla.js';
import { tr } from '../www/js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = read('src/app.ts'), css = read('public/style.css');
const view = app.slice(app.indexOf('let heading: QiblaHeading'), app.indexOf('/** The compass runs only while the Qibla tab'));
const H = (heading, accuracy = 5, trueNorth = true) => ({ heading, accuracy, trueNorth });

test('Guidance: the turn agrees with the geodesic bearing and the heading, both ways round', () => {
    const london = qiblaBearing(51.5074, -0.1278);
    const g = qiblaGuide(H(london + 91), london, true, false);
    assert.equal(g.kind, 'turn'); assert.equal(Math.round(g.turn), -91, 'pointing 91° clockwise of the Qibla: turn left 91°');
    assert.equal(qiblaGuide(H(london - 40), london, true, false).turn > 0, true, 'pointing anticlockwise of it: turn right');
    assert.deepEqual(qiblaGuide(H(10), 350, true, false), { kind: 'turn', turn: -20, magnetic: false }, 'across north, the short way');
    assert.equal(qiblaGuide(H(london + QIBLA_ALIGNED), london, true, false).kind, 'facing');
    assert.equal(qiblaGuide(H(london + QIBLA_ALIGNED + 1), london, true, false).kind, 'turn');
    // Every heading and bearing: heading + turn lands on the bearing, and the turn is never longer than half a circle.
    for (let b = 0; b < 360; b += 7.5) for (let h = 0; h < 360; h += 11.25) {
        const t = qiblaTurn(h, b);
        assert.ok(t > -180 && t <= 180);
        assert.ok(Math.abs(((h + t - b) % 360 + 360) % 360) < 1e-9);
    }
});

test('Dial geometry: the Kaaba marker is drawn at bearing − heading, which is the instruction (left of the pointer = turn left)', () => {
    // The dial group turns by −heading and the marker sits at +bearing inside it, so on screen it is at bearing − heading.
    assert.match(view, /dial\.style\.transform = `rotate\(\$\{\(-dialAngle\)\.toFixed\(1\)\}deg\)`/);
    assert.match(view, /dialAngle = nearestAngle\(dialAngle, heading\.heading\)/);
    assert.match(view, /<g transform="rotate\(\$\{b\.toFixed\(2\)\} \$\{C\} \$\{C\}\)"><line x1="\$\{C\}" y1="\$\{C\}" x2="\$\{C\}" y2="66" class="qb-needle"\/>/);
    assert.match(view, /data-bearing="\$\{b\}"/, 'the bearing comes from qiblaBearing, never a literal');
    for (let b = 3; b < 360; b += 29) for (let h = 0; h < 360; h += 17) {
        const screen = ((b - h) % 360 + 360) % 360, turn = qiblaTurn(h, b), x = Math.sin(screen * Math.PI / 180);
        assert.ok(Math.abs(((screen - turn) % 360 + 360) % 360) < 1e-9);
        if (Math.abs(turn) > 0.5 && Math.abs(turn) < 179.5) assert.equal(Math.sign(x), Math.sign(turn), 'right of the top pointer exactly when told to turn right');
    }
});

test('Dial animation: the unwrapped angle stays continuous across north and equals the heading', () => {
    let a = 0, prev = 0;
    for (const h of [350, 355, 359, 2, 8, 359, 300, 120, 2, 181, 179]) {
        a = nearestAngle(a, h);
        assert.ok(Math.abs(((a - h) % 360 + 360) % 360) < 1e-9, `${a} is ${h}`);
        assert.ok(Math.abs(a - prev) <= 180, 'never the long way round'); prev = a;
    }
});

test('Unavailable or unreliable sensors: no turn instruction is invented', () => {
    assert.deepEqual(qiblaGuide(null, 119, false, false), { kind: 'noLive' }, 'the web has no compass');
    assert.deepEqual(qiblaGuide(null, 119, true, false), { kind: 'waiting' });
    assert.deepEqual(qiblaGuide(null, 119, true, true), { kind: 'noCompass' }, 'startHeading refused or failed');
    for (const h of [H(200, -1), H(200, QIBLA_ROUGH + 0.1), H(NaN), H(-1), H(200, NaN)]) assert.equal(qiblaGuide(h, 119, true, false).kind, 'calibrate');
    assert.equal(qiblaGuide(H(200, QIBLA_ROUGH), 119, true, false).kind, 'turn');
    assert.match(app, /if \(!ok\) \{ compassMissing = true; compassOn = false; paintQibla\(\); \}/, 'a device without a compass is told so');
    // Without a trusted heading the dial is north-up and the phone pointer disappears (it would claim the phone points north).
    assert.match(view, /else \{ dialAngle = 0; dial\.style\.transform = ''; \}/);
    assert.match(view, /box\.classList\.toggle\('north-up', !live\)/);
    assert.match(css, /\.qibla\.north-up \.qb-phone\{display:none\}/);
    assert.match(css, /\.qibla\.rough \.qb-turn,\.qibla\.rough \.qb-phone\{opacity:\.5\}/, 'a heading that needs calibrating is shown dimmed');
    assert.match(view, /g\.kind === 'noLive' \? `\$\{t\('qiblaNoLive'\)\} \$\{t\('qiblaNorthUp'\)\}`/);
});

test('True and magnetic north are told apart; location denial keeps the calculated bearing', () => {
    assert.equal(qiblaGuide(H(10, 5, false), 119, true, false).magnetic, true);
    assert.equal(qiblaGuide(H(10, 5, true), 119, true, false).magnetic, false);
    assert.match(view, /const north = live \? t\(g\.magnetic \? 'qiblaMagnetic' : 'qiblaTrueNorth'\) : '';/);
    assert.match(view, /class="qb-mag">\$\{escapeHtml\(t\('qiblaMagDial'\)\)\}/);
    assert.match(css, /\.qibla\.magnetic \.qb-mag\{display:inline\}/);
    // iOS reports true north only with location; without it the bridge sends magnetic headings (SmartRemindersPlugin).
    assert.match(read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift'), /let trueNorth = h\.trueHeading >= 0/);
    // A refused "where I am now" leaves the saved place in use; no place at all asks for one instead of guessing.
    assert.match(app, /try \{ const p = await bridge\.currentPosition\(\); qiblaFrom = \{ lat: p\.lat, lng: p\.lng \}; \} catch \{ toast\(t\('locationError'\)\); \}/);
    assert.match(view, /if \(!from\) return `<section class="qibla">\$\{intro\}<div class="notice warning mt12">\$\{ic\('pin', 18\)\}<p>\$\{t\('qiblaNoPlace'\)\}<\/p>/);
    assert.match(view, /t\('qiblaBearing'\)\.replace\('\{n\}°', `<bdi>\$\{num\(Math\.round\(b\)\)\}°<\/bdi>`\)/, 'the facts show the computed bearing from true north');
});

test('Nothing from the mockup is hard-coded', () => {
    assert.doesNotMatch(view, /\b61\b|\b91\b|London|UK\b/);
    assert.match(view, /const label = qiblaFrom \? t\('qiblaFromHere'\) : t\(state\.places\.home \? 'place_home'/, 'the place is the saved one (no reverse geocoding, no network)');
});

test('Right to left: the compass is never mirrored, left and right stay physical, the mosque stays in view', () => {
    assert.doesNotMatch(css, /\[dir=rtl\][^{]*\.(qibla-dial|qb-)/);
    assert.match(view, /t\(key\)\.replace\('\{n\}°', `<b><bdi>\$\{num\(n\)\}°<\/bdi><\/b>`\)/, 'the degrees stay one left-to-right run inside Arabic');
    assert.match(css, /\[dir=rtl\] \.page-band::before\{inset:0 auto 6px 0;--m:linear-gradient\(270deg,transparent,#000 45%\)\}/);
    assert.match(css, /\.qibla-fact-value\{text-align:end;[^}]*border-inline-start/);
    assert.match(tr('qiblaLeft', 'ar'), /يسار/); assert.match(tr('qiblaRight', 'ar'), /يمين/);
});

test('Wording in English, French and Arabic; the speech is announced only when it changes', () => {
    for (const k of ['qiblaFindTitle', 'qiblaLocation', 'qiblaDistanceShort', 'qiblaShortCalibrate', 'qiblaShortNoCompass', 'qiblaNorthUp', 'qiblaMagnetic', 'qiblaTrueNorth', 'qiblaMagDial', 'qiblaNoLive', 'qiblaNoCompass'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
    for (const l of ['en', 'fr', 'ar']) assert.doesNotMatch(tr('qiblaNoLive', l), /above|ci-dessus|أعلاه/, 'the facts are not above the dial any more');
    assert.match(view, /role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(view, /if \(say\.dataset\.words !== words\) \{ say\.dataset\.words = words; say\.innerHTML = words; \}/);
    assert.match(view, /if \(status\.textContent !== statusText\) status\.textContent = statusText;/);
    assert.match(css, /\.reduced-motion \.qb-turn\{transition:none\}/);
});

test('Tabs, bottom navigation and compass lifetime are unchanged', () => {
    assert.match(app, /\['today', 'history', 'times', 'qibla'\] as const/);
    assert.match(app, /const want = view === 'prayer' && prayerTab === 'qibla' && !document\.hidden/);
    assert.match(app, /if \(!want\) \{ heading = null; void bridge\.stopHeading\(\); return; \}/);
});
