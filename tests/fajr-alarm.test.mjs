// Fajr wake-up alarm (schema v19): plan, migration, notification budget and native wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, defaultFajrAlarm } from '../www/js/engine.js';
import { fajrAlarmPlan, fallbackPlan, alarmUuid, alarmDayOf, ALARM_DAYS, ALARM_CODE, ALARM_SUNRISE_MARGIN } from '../www/js/alarm.js';
import { timesFor, rotationMax, ROTATION_MAX, ALARM_FALLBACK_DAYS, beforeId, athanId } from '../www/js/smart.js';
import { JUMUAH_CODE, FAST_CODE } from '../www/js/calendar.js';
import { tr } from '../www/js/i18n.js';

process.env.TZ = 'America/New_York';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const home = { lat: 43.9145, lng: -69.9653, radius: 150, label: 'Home' };
const withPlace = (alarm) => ({ ...initialState(), places: { home, work: null, mosque: null }, fajrAlarm: { ...defaultFajrAlarm(), ...alarm } });

test('Off by default, and nothing is planned without a saved place', () => {
    assert.deepEqual(initialState().fajrAlarm, { enabled: false, offset: 0, snoozes: 2, snoozeMinutes: 5, check: true });
    assert.deepEqual(fajrAlarmPlan(withPlace({})), []);
    assert.deepEqual(fajrAlarmPlan({ ...initialState(), fajrAlarm: { ...defaultFajrAlarm(), enabled: true } }), []);
});

test('A week of alarms at Fajr + offset, today skipped once past, ids stable per day', () => {
    const s = withPlace({ enabled: true, offset: -10 });
    const now = new Date(2026, 9, 29, 3, 0).getTime();
    const plan = fajrAlarmPlan(s, now);
    assert.equal(plan.length, ALARM_DAYS);
    assert.equal(plan[0].day, '2026-10-29', 'today, still ahead');
    const t = timesFor(s, new Date(2026, 9, 29));
    assert.equal(plan[0].at, t.fajr - 10 * 60000);
    assert.equal(plan[0].uuid, 'FA0A0000-0000-4000-8000-000000261029'); assert.equal(alarmDayOf(plan[0].uuid), '2026-10-29');
    assert.equal(plan[0].id, ALARM_CODE * 1000000 + 261029);
    assert.ok(plan.every((p, i) => i === 0 || p.at > plan[i - 1].at));
    assert.equal(new Set(plan.map(p => p.uuid)).size, ALARM_DAYS);
    const later = fajrAlarmPlan(s, new Date(2026, 9, 29, 9, 0).getTime());
    assert.equal(later[0].day, '2026-10-30', 'past today: starts tomorrow'); assert.equal(later.length, ALARM_DAYS);
    assert.equal(fajrAlarmPlan(s, now)[1].uuid, later[0].uuid, 'planning again keeps the same id for the same day');
    assert.match(alarmUuid('2026-12-31'), /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-8[0-9A-F]{3}-[0-9A-F]{12}$/);
});

test('Never later than 15 minutes before sunrise, whatever the offset', () => {
    const s = withPlace({ enabled: true, offset: 30 });
    const plan = fajrAlarmPlan(s, new Date(2026, 9, 29, 0, 0).getTime());
    for (const p of plan) assert.ok(p.at <= p.sunrise - ALARM_SUNRISE_MARGIN * 60000 && p.at >= p.fajr, p.day);
    // Near-polar summer: a short Fajr-to-sunrise gap still keeps the margin.
    const north = { ...s, places: { home: { ...home, lat: 59.33, lng: 18.07 }, work: null, mosque: null } };
    for (const p of fajrAlarmPlan(north, new Date(2026, 5, 1, 0, 0).getTime())) assert.ok(p.at <= p.sunrise - ALARM_SUNRISE_MARGIN * 60000, p.day);
});

test('Fallback notifications: two mornings, ids clear of every other reminder, room taken from rotation', () => {
    const s = withPlace({ enabled: true });
    const fb = fallbackPlan(fajrAlarmPlan(s, new Date(2026, 9, 29, 9).getTime()));
    assert.equal(fb.length, ALARM_FALLBACK_DAYS);
    assert.ok(fb.every(p => p.id >= 26000000 && p.id < 27000000 && Math.floor(p.id / 1e6) !== JUMUAH_CODE && Math.floor(p.id / 1e6) !== FAST_CODE));
    assert.ok(fb.every(p => p.id !== beforeId('fajr', p.day) && p.id !== athanId('fajr', p.day)));
    assert.equal(rotationMax(s), rotationMax(withPlace({})) - ALARM_FALLBACK_DAYS);
    assert.ok(rotationMax(withPlace({})) <= ROTATION_MAX);
});

test('Migration v18 → v19 keeps everything and adds the alarm, off; bad settings are rejected', () => {
    assert.equal(STATE_VERSION, 20);
    const v18 = JSON.parse(JSON.stringify({ ...initialState(), version: 18, xp: 12, calendar: { jumuah: true, fasting: false } }));
    delete v18.fajrAlarm;
    const m = validateState(v18);
    assert.equal(m.version, 20); assert.equal(m.xp, 12); assert.deepEqual(m.calendar, { jumuah: true, fasting: false });
    assert.deepEqual(m.fajrAlarm, defaultFajrAlarm());
    const ok = initialState();
    for (const bad of [{ offset: 7 }, { snoozes: 9 }, { snoozeMinutes: 9 }, { enabled: 'yes' }, { check: 1 }, { extra: true }])
        assert.throws(() => validateState({ ...ok, fajrAlarm: { ...ok.fajrAlarm, ...bad } }), /Fajr alarm/, JSON.stringify(bad));
    assert.throws(() => validateState({ ...ok, fajrAlarm: undefined }), /Fajr alarm/);
});

test('Native wiring: AlarmKit in the app target, limited snooze, wake check, permission text; three languages', () => {
    const swift = read('ios/App/App/FajrAlarm.swift');
    assert.match(swift, /import AlarmKit/);
    assert.match(swift, /guard used <= plan\.snoozes else \{ return \}/, 'snoozes are limited per morning');
    assert.match(swift, /secondaryIntent: snoozeLeft > 0 \? SnoozeFajrAlarm/, 'no snooze button once none are left');
    assert.match(swift, /extras\[id\.uuidString\]\?\["kind"\] != "check"/, 'the wake check rings once, not forever');
    assert.match(swift, /alarm\.state != \.alerting/, 'a ringing alarm is never cancelled by a sync');
    assert.match(read('ios/App/App/AppDelegate.swift'), /if #available\(iOS 26\.0, \*\) \{ FajrAlarmHook\.scheduler = FajrAlarms\.shared \}/);
    assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /FajrAlarm\.swift in Sources/);
    assert.match(read('ios/App/App/Info.plist'), /<key>NSAlarmKitUsageDescription<\/key>/);
    assert.match(read('scripts/native-configure.mjs'), /NSAlarmKitUsageDescription/);
    const bridge = read('native/bridge.mjs');
    assert.match(bridge, /const ALARM = \(id\) => id >= 26000000 && id < 27000000;/);
    assert.match(bridge, /if \(\(await bridge\.smart\.alarmStatus\(\)\)\.available\) \{ await Smart\.alarmSchedule/);
    const app = read('src/app.ts');
    assert.match(app, /await syncFajrAlarm\(\)\.catch/, 'synced with the other reminders, without needing notification permission');
    assert.match(app, /if \(\/\^ayahflow:\\\/\\\/wake\\\/\?\$\/\.test\(url\)\) \{ void navigate\('wake'\)/);
    for (const k of ['alarmSection', 'alarmToggle', 'alarmToggleNote', 'alarmWhen', 'alarmAtFajr', 'alarmBefore', 'alarmAfter', 'alarmSnoozes', 'alarmNoSnooze', 'alarmSnoozeLength', 'minutesShort', 'alarmCheck', 'alarmCheckNote', 'alarmNext', 'alarmClamped', 'alarmDenied', 'alarmFallback', 'alarmOn', 'alarmSyncFailed', 'alarmTitle', 'alarmCheckTitle', 'alarmStop', 'alarmSnooze', 'alarmBody', 'wakeTitle', 'wakeSub', 'wakeHold', 'wakeHoldNote', 'wakeDone'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});
