// Athan only at Home, soft beep elsewhere (schema v15). The sound swap itself runs in the iOS plugin, so its rules are
// checked in the source here and the swap on a real phone is a device check (docs/RELEASE-CHECKLIST.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION } from '../www/js/engine.js';
import { athanSchedule, athanHomeOnly, nativeConfig } from '../www/js/smart.js';
import { tr } from '../www/js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const label = () => ({ title: 't', body: 'b' });
const copy = () => ({ title: 't', body: 'b' });
const home = (athan = {}) => { const s = initialState(); s.places.home = { lat: 40.7, lng: -74, radius: 150 }; s.smart.method = 'NorthAmerica'; s.athan = { ...s.athan, enabled: true, reciter: 'online-zahrani', downloads: ['zahrani', 'nafees-fajr'], ...athan }; return s; };

test('Migration v14 → v15: the away beep starts off and every athan setting is kept', () => {
    assert.equal(STATE_VERSION, 21);
    const v14 = JSON.parse(JSON.stringify({ ...home({ fajrReciter: 'online-nafees-fajr', before: { enabled: true, minutes: 10 } }), version: 14 }));
    delete v14.athan.awayChime;
    const m = validateState(v14);
    assert.equal(m.version, 21);
    assert.equal(m.athan.awayChime, false, 'never switched on for anyone who has not chosen it');
    assert.equal(m.athan.reciter, 'online-zahrani'); assert.equal(m.athan.fajrReciter, 'online-nafees-fajr');
    assert.deepEqual(m.athan.before, { enabled: true, minutes: 10 }); assert.equal(m.places.home.radius, 150);
    const v5 = JSON.parse(JSON.stringify(initialState())); v5.version = 5; delete v5.athan;
    assert.equal(validateState(v5).athan.awayChime, false);
    assert.equal(validateState(JSON.parse(JSON.stringify(home({ awayChime: true })))).athan.awayChime, true);
    assert.throws(() => validateState({ ...initialState(), athan: { ...initialState().athan, awayChime: 'yes' } }), /away/);
});

test('Home-only needs the athan on, the athan sound, the switch and a saved Home', () => {
    assert.equal(athanHomeOnly(home({ awayChime: true })), true);
    assert.equal(athanHomeOnly(home({ awayChime: false })), false);
    assert.equal(athanHomeOnly(home({ awayChime: true, sound: 'chime' })), false, 'the gentle alert is already a beep everywhere');
    assert.equal(athanHomeOnly(home({ awayChime: true, enabled: false })), false);
    const noHome = home({ awayChime: true }); noHome.places.home = null;
    assert.equal(athanHomeOnly(noHome), false);
});

test('Athan alerts carry the flag and the reciter; native config asks iOS to watch Home only when it is on', () => {
    process.env.TZ = 'America/New_York';
    const now = new Date(2026, 9, 26, 9).getTime();
    const on = athanSchedule(home({ awayChime: true }), label, now), off = athanSchedule(home(), label, now);
    assert.ok(on.length > 0 && on.every(a => a.homeOnly === true));
    assert.ok(off.every(a => a.homeOnly === false));
    assert.deepEqual(on.map(a => [a.id, a.at, a.reciter]), off.map(a => [a.id, a.at, a.reciter]), 'same alerts and times; only the sound may change');
    assert.ok(on.filter(a => a.prayer === 'fajr').every(a => a.reciter === 'online-nafees-fajr' || a.reciter === home().athan.fajrReciter));
    assert.equal(nativeConfig(home({ awayChime: true }), copy, now).athanHome, true);
    assert.equal(nativeConfig(home(), copy, now).athanHome, false);
    assert.equal(nativeConfig(home({ awayChime: true }), copy, now).location, false, 'place reminders are not switched on by this');
});

test('Bridge: home-only alerts keep both sounds so iOS can swap them; Android is unchanged', () => {
    const b = read('native/bridge.mjs');
    const content = b.slice(b.indexOf('const athanContent'), b.indexOf('\n', b.indexOf('const athanContent')));
    assert.match(content, /n\.homeOnly && !ANDROID && sound \? \{ homeOnly: true, athanSound: sound, awaySound: CHIME_SOUND \}/);
    assert.match(content, /url: 'ayahflow:\/\/prayer'/, 'a tap still opens the prayer screen');
    const schedule = b.slice(b.indexOf('async scheduleAthan('), b.indexOf('async saveCustomAthan('));
    assert.match(schedule, /if \(list\.some\(n => n\.homeOnly\)\) await placeAthan\(\);/);
    assert.match(b, /const placeAthan = \(\) => ANDROID \? Promise\.resolve\(\) : Smart\.placeAthan\(\)\.catch/);
    assert.match(b.slice(b.indexOf('scheduleTest'), b.indexOf('notificationCheck')), /if \(n\.homeOnly\) await placeAthan\(\);/);
});

test('iOS: the athan only plays when Home is known to be inside; place reminders stay off unless chosen', () => {
    const s = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
    const place = s.slice(s.indexOf('func placeAthan('), s.indexOf('// MARK: Rules'));
    assert.match(place, /let atHome = defaults\.string\(forKey: homeKey\) == "in"/);
    assert.match(place, /let want = atHome \? athan : away/);
    assert.match(place, /UNNotificationRequest\(identifier: r\.identifier, content: content, trigger: r\.trigger\)/, 'replaced in place: same id and time');
    assert.match(s, /var athanHome: Bool\?/, 'configs saved by earlier builds still decode');
    assert.match(s, /if !wanted\.contains\(where: \{ \$0\.id == "home" \}\) \{ setHome\(nil\) \}/, 'a stale "at Home" is dropped when Home is no longer watched');
    const event = s.slice(s.indexOf('private func regionEvent('), s.indexOf('// MARK: Home-only athan'));
    assert.match(event, /guard config\?\.location == true else \{ return \}/);
    assert.match(read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift'), /CAPPluginMethod\(name: "placeAthan"/);
});

test('Wording exists in English, French and Arabic', () => {
    for (const k of ['awayToggle', 'awayNote', 'awayNeedHome', 'awayOpenPlaces', 'awayNeedAlways', 'awayNow', 'awayAtHome', 'awayAway', 'awayUnknown', 'awayDelay'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});
