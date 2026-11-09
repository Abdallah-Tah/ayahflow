// Smart adhkar reminders, 2026-11-08: one riding reminder per journey, a test that is never a detection, bedtime by the
// clock, and a plain status for each automatic reminder. The TypeScript rules are the reference the native engines mirror.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, emptyHistory, RULES, JOURNEY_GAP_MINUTES, BOUNCE_MINUTES } from '../www/js/adhkar.js';
import { autoStatus, nativeConfig, AUTO_MOMENTS } from '../www/js/smart.js';
import { initialState } from '../www/js/engine.js';
import { allTranslationKeys, tr } from '../www/js/i18n.js';

process.env.TZ = 'America/New_York';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIN = 60000, ALL = new Set(['vehicle', 'leave_home', 'enter_home', 'morning', 'evening', 'sleep']);
const W = { day: '2026-11-09', morning: null, evening: null }, T0 = new Date(2026, 10, 9, 10).getTime();

test('Driving: one reminder per journey, however often the phone reports the vehicle; a new journey after a 30-minute gap', () => {
    assert.equal(JOURNEY_GAP_MINUTES, 30);
    assert.deepEqual(RULES.find(r => r.event === 'ENTER_VEHICLE'), { event: 'ENTER_VEHICLE', moments: ['vehicle'], cooldownMinutes: 30, sameJourneyMinutes: 30 });
    let h = emptyHistory(), sent = 0;
    // A two-hour drive reported every 4 minutes (iOS wakes at significant location changes): one reminder.
    for (let m = 0; m <= 120; m += 4) { const r = decide('ENTER_VEHICLE', T0 + m * MIN, W, h, ALL); h = r.history; if (r.decision) sent++; }
    assert.equal(sent, 1, 'the cooldown alone would have sent one every 30 minutes');
    // Ten minutes parked for fuel: the same journey.
    assert.equal(decide('ENTER_VEHICLE', T0 + 130 * MIN, W, h, ALL).decision, null);
    h = decide('ENTER_VEHICLE', T0 + 130 * MIN, W, h, ALL).history;
    // Parked for 45 minutes, then a new trip: a new reminder.
    assert.deepEqual(decide('ENTER_VEHICLE', T0 + 175 * MIN, W, h, ALL).decision?.moments, ['vehicle']);
    // Evidence is noted even when the reminder is off, and history from earlier builds (no `seen`) still works.
    const off = decide('ENTER_VEHICLE', T0, W, emptyHistory(), new Set());
    assert.equal(off.decision, null); assert.equal(off.history.seen.ENTER_VEHICLE, T0);
    assert.deepEqual(decide('ENTER_VEHICLE', T0, W, { last: {}, lastDay: {}, completedDay: {} }, ALL).decision?.moments, ['vehicle']);
});

test('Home: leaving and entering keep their cooldowns and the 5-minute bounce rule; a vehicle report does not touch them', () => {
    assert.equal(BOUNCE_MINUTES, 5);
    let h = decide('EXIT_HOME', T0, W, emptyHistory(), ALL).history;
    assert.equal(decide('ENTER_HOME', T0 + 3 * MIN, W, h, ALL).decision, null, 'GPS jitter at the edge');
    assert.deepEqual(decide('ENTER_HOME', T0 + 40 * MIN, W, h, ALL).decision?.moments, ['enter_home']);
    h = decide('ENTER_VEHICLE', T0 + MIN, W, h, ALL).history;
    assert.equal(decide('EXIT_HOME', T0 + 20 * MIN, W, h, ALL).decision, null, '45-minute cooldown');
    const cfg = nativeConfig({ ...initialState(), smart: { ...initialState().smart, vehicle: true } }, m => ({ title: m, body: '' }), T0);
    assert.equal(cfg.rules.find(r => r.event === 'ENTER_VEHICLE').sameJourneyMinutes, 30, 'sent to the native engines');
    assert.equal(cfg.rules.find(r => r.event === 'EXIT_HOME').sameJourneyMinutes, undefined);
});

test('The native engines mirror the journey rule and keep saved history readable', () => {
    const swift = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
    assert.match(swift, /let sameJourneyMinutes: Double\? \}/);
    assert.match(swift, /if let gap = rule\.sameJourneyMinutes \{\s*let prev = history\.seen\[event\]\s*history\.seen\[event\] = max\(now, prev \?\? now\)\s*if let prev, now >= prev, now - prev < gap \* 60000 \{ continue \}/);
    assert.match(swift, /seen = try c\.decodeIfPresent\(\[String: Double\]\.self, forKey: \.seen\) \?\? \[:\]/, 'history saved before has no seen');
    const java = read('plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/SmartEngine.java');
    assert.match(java, /if \(rule\.has\("sameJourneyMinutes"\)\) \{[\s\S]*?if \(had && now >= prev && now - prev < gap\) continue;/);
    assert.match(java, /if \(!moments\.isEmpty\(\) \|\| seenChanged\) edit\.putString\(HISTORY, history\.toString\(\)\);/);
});

test('A test notification is a preview: marked "Test", never logged as a detection, cooldowns and timed reminders untouched', () => {
    const swift = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
    const preview = swift.slice(swift.indexOf('func preview('), swift.indexOf('private func post('));
    assert.match(preview, /post\(rule\.moments, cfg, test: true\)/);
    assert.doesNotMatch(preview, /historyKey|logKey|removePendingNotificationRequests|handle\(/, 'no state is written');
    assert.match(swift, /content\.title = test \? "\\\(cfg\.testPrefix \?\? "Test"\) · \\\(title\)" : title/);
    assert.match(read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift'), /call\.resolve\(\["moments": self\.engine\.preview\(event\)\]\)/);
    const java = read('plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/SmartEngine.java');
    const jp = java.slice(java.indexOf('static synchronized List<String> preview('), java.indexOf('private static void post(Context c, JSONObject cfg, List<String> moments) {'));
    assert.match(jp, /post\(c, cfg, moments, true\)/); assert.doesNotMatch(jp, /HISTORY|LOG|edit\(\)/);
    assert.match(read('plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/SmartRemindersPlugin.java'), /List<String> moments = SmartEngine\.preview\(getContext\(\), event\);/);
    const app = read('src/app.ts');
    assert.match(app, /testPrefix: t\('testPrefix'\)/);
    assert.match(tr('testSent', 'en'), /not recorded as a detection/);
});

test('Bedtime: scheduled by the clock (a calendar trigger follows a time-zone change); morning and evening stay instants', async () => {
    const bridge = read('native/bridge.mjs');
    assert.match(bridge, /schedule: n\.moment === 'sleep' \? \{ on: wallClock\(n\.at\), allowWhileIdle: true \} : \{ at: new Date\(n\.at\), allowWhileIdle: true \}/);
    const at = new Date(2026, 10, 9, 22, 30).getTime();
    const { year, month, day, hour, minute } = (await import('../native/bridge.mjs').catch(() => null))?.wallClock?.(at) ?? Function(`return (${bridge.match(/export const wallClock = (\(at\) => \{[^\n]*\});/)[1]})`)()(at);
    assert.deepEqual([year, month, day, hour, minute], [2026, 11, 9, 22, 30]);
});

test('Status of each automatic reminder: on, off, needs setup, needs permission, paused or unavailable — never "guaranteed"', () => {
    assert.deepEqual([...AUTO_MOMENTS], ['vehicle', 'leave_home', 'enter_home', 'sleep']);
    const base = initialState(), always = { location: 'always', motion: 'granted', monitoring: ['home'], precise: true, backgroundRefresh: 'on', vehicleWatch: true };
    const by = (s, st = always, n = 'granted', native = true) => Object.fromEntries(autoStatus(s, st, n, native).map(a => [a.moment, `${a.state}:${a.reason}`]));
    assert.deepEqual(by(base), { vehicle: 'off:autoVehicleOff', leave_home: 'off:autoPlacesOff', enter_home: 'off:autoPlacesOff', sleep: 'off:autoTimedOff' });
    const on = { ...base, places: { ...base.places, home: { lat: 40.7, lng: -74, radius: 150 } }, smart: { ...base.smart, location: true, vehicle: true, timed: true, sleepTime: '22:30' } };
    assert.deepEqual(by(on), { vehicle: 'on:autoOnVehicle', leave_home: 'on:autoOnPlace', enter_home: 'on:autoOnPlace', sleep: 'on:autoOnBedtime' });
    assert.equal(by(on, { ...always, motion: 'denied' }).vehicle, 'on:autoOnSpeedOnly', 'iOS still estimates speed, and says so');
    assert.deepEqual(Object.values(by(on, { ...always, location: 'whenInUse' })).slice(0, 3), ['permission:autoNeedAlways', 'permission:autoNeedAlways', 'permission:autoNeedAlways']);
    assert.equal(by(on, { ...always, backgroundRefresh: 'off' }).leave_home, 'paused:autoBackgroundRefresh');
    assert.equal(by(on, { ...always, monitoring: [] }).enter_home, 'unavailable:autoNotWatchingHome');
    assert.equal(by(on, { ...always, vehicleWatch: false }).vehicle, 'unavailable:autoNoVehicleWatch');
    assert.ok(Object.values(by(on, always, 'denied')).every(v => v === 'permission:autoNeedNotifications'));
    assert.equal(by({ ...on, smart: { ...on.smart, sleepTime: null } }).sleep, 'setup:autoNeedBedtime');
    assert.equal(by({ ...on, places: { ...on.places, home: null } }).leave_home, 'setup:autoNeedHome');
    assert.equal(by({ ...on, smart: { ...on.smart, moments: on.smart.moments.filter(m => m !== 'vehicle') } }).vehicle, 'off:autoMomentOff');
    assert.ok(Object.values(by(on, always, 'granted', false)).every(v => v === 'unavailable:autoWebOnly'));
    const keys = new Set(allTranslationKeys());
    for (const a of autoStatus(on, always, 'granted', true)) assert.ok(keys.has(a.reason) && keys.has(`autoState_${a.state}`));
    for (const k of ['autoOnVehicle', 'autoOnPlace', 'autoOnBedtime', 'autoNote']) for (const l of ['en', 'fr', 'ar']) assert.doesNotMatch(tr(k, l), /guarantee|garanti|مضمون/i);
    assert.match(read('src/app.ts'), /const auto = `<section class="settings-section"><h2>\$\{t\('autoTitle'\)\}/);
});
