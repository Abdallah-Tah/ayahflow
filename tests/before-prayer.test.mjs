// Reminder before prayer (schema v14) and the notification budget. Time zones are set per test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { initialState, validateState, dayKey, STATE_VERSION, BEFORE_MINUTES, PRAYERS } from '../www/js/engine.js';
import { beforeSchedule, beforeId, athanId, athanSchedule, prayersFrom, timesFor, istighfarId, timedId, rotationReminders, rotationMax, ROTATION_MAX, ATHAN_MAX, BEFORE_MAX, PLAN_DAYS, SALAH_MAX, TEST_BEFORE_ID, TEST_ATHAN_ID } from '../www/js/smart.js';
import { salahReminderId } from '../www/js/worship.js';
import { beforeCopy } from '../www/js/i18n.js';

const zone = (tz) => { process.env.TZ = tz; };
const MIN = 60000;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const label = (p, m) => ({ title: `${p} ${m}`, body: '' });
const place = (lat, lng, method = 'NorthAmerica', before = { enabled: true, minutes: 15 }) => { const s = initialState(); s.places.home = { lat, lng, radius: 150 }; s.smart.method = method; s.athan.before = before; return s; };

test('Migration v13 → v14: every saved setting is kept and the reminder before prayer stays off at 15 minutes', () => {
    assert.equal(STATE_VERSION, 14);
    const v13 = { ...initialState(), version: 13, xp: 54, places: { home: { lat: 40.7, lng: -74, radius: 300 }, work: null, mosque: null }, smart: { ...initialState().smart, method: 'NorthAmerica' }, athan: { ...initialState().athan, enabled: true, prayers: { fajr: true, dhuhr: false, asr: true, maghrib: true, isha: false }, reciter: 'madinah' }, counts: [{ id: 'istighfar', day: '2026-10-25', n: 9 }] };
    delete v13.athan.before;
    const m = validateState(JSON.parse(JSON.stringify(v13)));
    assert.equal(m.version, 14);
    assert.deepEqual(m.athan.before, { enabled: false, minutes: 15 }, 'not switched on for anyone who has not chosen it');
    assert.equal(m.athan.enabled, true); assert.equal(m.athan.reciter, 'madinah'); assert.deepEqual(m.athan.prayers, v13.athan.prayers);
    assert.equal(m.places.home.radius, 300); assert.equal(m.smart.method, 'NorthAmerica'); assert.equal(m.xp, 54); assert.equal(m.counts[0].n, 9);
    // Older saves get it too, and a v14 save round-trips.
    const v6 = JSON.parse(JSON.stringify(initialState())); v6.version = 7; delete v6.athan.before;
    assert.deepEqual(validateState(v6).athan.before, { enabled: false, minutes: 15 });
    const on = { ...initialState(), athan: { ...initialState().athan, before: { enabled: true, minutes: 10 } } };
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(on))).athan.before, { enabled: true, minutes: 10 });
    for (const bad of [{ enabled: true, minutes: 20 }, { enabled: 'yes', minutes: 15 }, null, { enabled: true }, { enabled: true, minutes: 15, extra: 1 }])
        assert.throws(() => validateState({ ...initialState(), athan: { ...initialState().athan, before: bad } }), /before prayer/);
    assert.deepEqual([...BEFORE_MINUTES], [5, 10, 15, 30]);
});

test('Ids: reminders before prayers use 18–22 × 10⁶, never an athan, check-in, adhkar, istighfar, rotation or test id', () => {
    zone('America/New_York');
    const ids = new Map();
    const claim = (id, what) => { assert.ok(!ids.has(id), `${id} is both ${ids.get(id)} and ${what}`); ids.set(id, what); };
    for (let d = 0; d < 366; d++) {
        const day = dayKey(new Date(2026, 0, 1 + d).getTime());
        for (const p of PRAYERS) { claim(beforeId(p, day), 'before'); claim(athanId(p, day), 'athan'); claim(salahReminderId(p, day), 'salah'); }
        for (const slot of ['lateMorning', 'afternoon', 'evening']) claim(istighfarId(slot, day), 'istighfar');
        for (const m of ['morning', 'evening', 'sleep']) claim(timedId(m, day), 'timed');
    }
    for (const id of ids.keys()) if (ids.get(id) === 'before') assert.ok(id >= 18000000 && id < 23000000);
    for (const id of [TEST_BEFORE_ID, TEST_ATHAN_ID, 701]) assert.ok(!ids.has(id) && !(id >= 12000000 && id < 13000000));
    // The native bridge replaces only its own range.
    const bridge = read('native/bridge.mjs');
    assert.match(bridge, /const BEFORE = \(id\) => id >= 18000000 && id < 23000000;/);
    assert.match(bridge, /const TEST = \(id\) => id >= 23000000 && id < 23000100;/);
    assert.match(bridge, /const ATHAN = \(id\) => id >= 4000000 && id < 9000000;/);
});

test('Schedule: exactly 15 minutes before each chosen prayer, never sunrise, independent of the athan switch', () => {
    zone('America/New_York');
    const now = new Date(2026, 9, 25, 3).getTime(), s = place(40.7128, -74.006);
    const list = beforeSchedule(s, label, now);
    assert.equal(list.length, BEFORE_MAX, 'today and tomorrow, five each');
    const prayers = prayersFrom(s, now, 2);
    for (const r of list) {
        const p = prayers.find(x => x.prayer === r.prayer && x.day === r.day);
        assert.equal(p.at - r.at, 15 * MIN, `${r.prayer} ${r.day}`);
        assert.equal(r.id, beforeId(r.prayer, r.day));
        assert.ok(r.at > now);
    }
    assert.ok(list.every(r => PRAYERS.includes(r.prayer)), 'sunrise is not a prayer');
    const sunrise = timesFor(s, new Date(now)).sunrise;
    assert.ok(!list.some(r => Math.abs(r.at + 15 * MIN - sunrise) < MIN));
    assert.equal(s.athan.enabled, false, 'works with the athan off');
    assert.deepEqual(beforeSchedule({ ...s, athan: { ...s.athan, before: { enabled: false, minutes: 15 } } }, label, now), [], 'off means none');
    // Per-prayer bells are respected.
    const some = { ...s, athan: { ...s.athan, prayers: { fajr: true, dhuhr: false, asr: true, maghrib: false, isha: false } } };
    assert.deepEqual([...new Set(beforeSchedule(some, label, now).map(r => r.prayer))].sort(), ['asr', 'fajr']);
    // Other leads, and a reminder whose time has passed is dropped, not sent late.
    for (const m of [5, 10, 30]) assert.ok(beforeSchedule({ ...s, athan: { ...s.athan, before: { enabled: true, minutes: m } } }, label, now).every(r => prayers.find(x => x.prayer === r.prayer && x.day === r.day).at - r.at === m * MIN));
    const asr = timesFor(s, new Date(now)).asr, close = beforeSchedule(s, label, asr - 10 * MIN);
    assert.ok(!close.some(r => r.prayer === 'asr' && r.day === dayKey(now)), '10 minutes before Asr, its reminder is gone');
    assert.ok(close.some(r => r.prayer === 'maghrib' && r.day === dayKey(now)));
    // No place, no reminders.
    assert.deepEqual(beforeSchedule({ ...initialState(), athan: { ...initialState().athan, before: { enabled: true, minutes: 15 } } }, label, now), []);
});

test('Recalculated from the place, method and Asr setting; re-planning gives the same ids (no duplicates)', () => {
    zone('Europe/London');
    const now = new Date(2026, 9, 25, 3).getTime(), s = place(51.5074, -0.1278, 'MuslimWorldLeague');
    const at = (st, p) => beforeSchedule(st, label, now).find(r => r.prayer === p).at;
    assert.equal(at({ ...s, smart: { ...s.smart, hanafi: true } }, 'asr') - at(s, 'asr'), timesFor({ ...s, smart: { ...s.smart, hanafi: true } }, new Date(now)).asr - timesFor(s, new Date(now)).asr);
    assert.notEqual(at({ ...s, smart: { ...s.smart, hanafi: true } }, 'asr'), at(s, 'asr'));
    assert.notEqual(at({ ...s, smart: { ...s.smart, method: 'Egyptian' } }, 'fajr'), at(s, 'fajr'));
    const moved = { ...s, places: { ...s.places, home: { lat: 48.8566, lng: 2.3522, radius: 150 } } };
    assert.notEqual(at(moved, 'maghrib'), at(s, 'maghrib'));
    const a = beforeSchedule(s, label, now), b = beforeSchedule(s, label, now + 2 * 3600000);
    assert.deepEqual(a, beforeSchedule(s, label, now), 'deterministic');
    for (const r of b) { const same = a.find(x => x.id === r.id); if (same) assert.equal(same.at, r.at, 'a later plan keeps each reminder\'s id and time'); }
    assert.equal(new Set(a.map(r => r.id)).size, a.length);
});

test('DST and midnight: 15 elapsed minutes before the prayer on both 2026 New York changes and after-midnight Isha', () => {
    zone('America/New_York');
    for (const from of [new Date(2026, 2, 7, 12), new Date(2026, 9, 31, 12)]) {
        const s = place(40.7128, -74.006), list = beforeSchedule(s, label, from.getTime()), prayers = prayersFrom(s, from.getTime(), 2);
        assert.ok(list.length >= 8);
        for (const r of list) assert.equal(prayers.find(x => x.prayer === r.prayer && x.day === r.day).at - r.at, 15 * MIN);
        assert.equal(new Set(list.map(r => r.id)).size, list.length);
    }
    zone('Europe/Oslo');
    let afterMidnight = 0;
    for (let d = 150; d < 200; d++) {
        const s = place(59.91, 10.75, 'MuslimWorldLeague'), now = new Date(2026, 0, d, 21).getTime(), list = beforeSchedule(s, label, now);
        assert.equal(new Set(list.map(r => r.id)).size, list.length, `${dayKey(now)}: unique ids`);
        for (const r of list.filter(x => x.prayer === 'isha')) if (dayKey(r.at + 15 * MIN) !== r.day) { afterMidnight++; assert.equal(r.id, beforeId('isha', r.day), 'keyed on the prayer day'); }
    }
    assert.ok(afterMidnight > 0, 'Oslo summer has Ishas after midnight');
});

test('Budget: athans keep their place in iOS\'s 64 pending notifications, also with the reminders before prayers on', () => {
    zone('Europe/Oslo');
    const s = place(59.91, 10.75, 'MuslimWorldLeague'); s.athan.enabled = true;
    for (let d = 140; d < 220; d++) assert.ok(athanSchedule(s, (p) => ({ title: p, body: '' }), new Date(2026, 0, d, 0, 30).getTime()).length <= ATHAN_MAX);
    const fixed = ATHAN_MAX + PLAN_DAYS * 3 + 6 + SALAH_MAX + 3;
    assert.equal(fixed + ROTATION_MAX, 64);
    assert.equal(fixed + BEFORE_MAX + rotationMax(s), 64);
    assert.equal(rotationMax({ ...s, athan: { ...s.athan, before: { enabled: false, minutes: 15 } } }), ROTATION_MAX);
    const busy = { ...s, rotation: { ...s.rotation, enabled: true, every: 30, from: '06:00', to: '23:30' } };
    assert.equal(rotationReminders(busy, [{ id: 'x', text: 'x', note: '' }], 'Dhikr', new Date(2026, 9, 25, 5).getTime()).length, rotationMax(busy));
});

test('Notification text: the requested English, French and Arabic wording, with the number and grammar per locale', () => {
    assert.deepEqual(beforeCopy('asr', 15, 'en'), { title: 'Asr prayer in 15 minutes', body: 'A gentle reminder to prepare for prayer. May Allah make it easy for you.' });
    assert.deepEqual(beforeCopy('asr', 15, 'fr'), { title: 'Prière d’Asr dans 15 minutes', body: 'Un petit rappel pour vous préparer à la prière. Qu’Allah accepte nos prières.' });
    assert.deepEqual(beforeCopy('asr', 15, 'ar'), { title: 'بقي ١٥ دقيقة على صلاة العصر', body: 'تذكير لطيف للاستعداد للصلاة. تقبّل الله منا ومنكم.' });
    assert.equal(beforeCopy('fajr', 10, 'fr').title, 'Prière de Fajr dans 10 minutes');
    assert.equal(beforeCopy('isha', 30, 'fr').title, 'Prière d’Isha dans 30 minutes');
    assert.equal(beforeCopy('maghrib', 5, 'ar').title, 'بقيت ٥ دقائق على صلاة المغرب');
    assert.equal(beforeCopy('isha', 30, 'ar').title, 'بقي ٣٠ دقيقة على صلاة العشاء');
});

test('Sounds: the reminder uses the bundled chime, the athan keeps the chosen reciter, and the chime is installed for iOS', () => {
    const bridge = read('native/bridge.mjs'), store = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SharedWidgetStore.swift');
    assert.ok(existsSync(new URL('../public/sounds/adhkar-chime.caf', import.meta.url)));
    assert.match(store, /name == "adhkar-chime\.caf" \{ targetName = "ayahflow-prayer-chime\.caf" \}/);
    assert.match(bridge, /const CHIME_SOUND = 'ayahflow-prayer-chime\.caf';/);
    assert.match(bridge, /const beforeContent = \(\) => ANDROID \? \{ channelId: 'ayahflow-prayer-before' \} : \{ sound: CHIME_SOUND \};/);
    // scheduleBefore only ever uses beforeContent (never an athan recording); athan alerts keep their reciter's file.
    const before = bridge.slice(bridge.indexOf('async scheduleBefore'), bridge.indexOf('/** One test notification'));
    assert.ok(before.includes('...beforeContent()') && !before.includes('athanContent') && !before.includes('athanSoundName') && !before.includes('reciter'));
    assert.match(bridge, /`ayahflow-athan-\$\{n\.reciter\}\.caf`/);
    assert.match(bridge, /\.\.\.athanContent\(n\), extra: \{ url: 'ayahflow:\/\/prayer' \}/);
    assert.match(read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift'), /CAPPluginMethod\(name: "notificationCheck"/);
    // Taps open the prayer screen, which the app routes.
    assert.ok(before.includes("extra: { url: 'ayahflow://prayer' }"));
    assert.match(read('src/app.ts'), /\^ayahflow:\\\/\\\/prayer\\\/\?\$/);
});
