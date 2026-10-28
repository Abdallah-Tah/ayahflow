// Qibla direction, Jumu'ah and voluntary-fast reminders, and the self-assessed highlight review (schema v18).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, setHighlight, setNote, reviewHighlight, highlightReviewQueue, STATE_VERSION } from '../www/js/engine.js';
import { qiblaBearing, kaabaDistanceKm, qiblaTurn } from '../www/js/qibla.js';
import { hijriDate, fastingReasons, fastingExcluded, upcomingFasts, calendarReminders, JUMUAH_CODE, FAST_CODE } from '../www/js/calendar.js';
import { rotationMax, ROTATION_MAX, FAST_MAX, beforeId, athanId, istighfarId } from '../www/js/smart.js';
import { tr } from '../www/js/i18n.js';

process.env.TZ = 'America/New_York';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const copy = { jumuah: { title: 'J', body: 'b' }, fast: (r) => ({ title: r.join(','), body: 'b' }) };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('Qibla: published bearings for known cities, distance, and which way to turn', () => {
    near(qiblaBearing(40.7128, -74.006), 58.5, 0.5, 'New York');
    near(qiblaBearing(51.5074, -0.1278), 119.0, 0.5, 'London');
    near(qiblaBearing(-6.2088, 106.8456), 295.1, 0.5, 'Jakarta');
    near(qiblaBearing(-33.8688, 151.2093), 277.5, 0.5, 'Sydney');
    near(kaabaDistanceKm(40.7128, -74.006), 10300, 60, 'New York distance');
    assert.equal(qiblaTurn(50, 58), 8); assert.equal(qiblaTurn(350, 10), 20); assert.equal(qiblaTurn(10, 350), -20); assert.equal(qiblaTurn(0, 180), 180);
});

test('Hijri dates (Umm al-Qura) and voluntary-fast days, never on Eid, Tashreeq or in Ramadan', () => {
    assert.deepEqual(hijriDate(new Date(2026, 9, 27)), { day: 16, month: 5, year: 1448 });
    assert.deepEqual(fastingReasons(new Date(2026, 9, 26)), ['monday', 'white'], '15 Jumada al-Ula is also a Monday');
    assert.deepEqual(fastingReasons(new Date(2026, 10, 2)), ['monday']);
    assert.deepEqual(fastingReasons(new Date(2026, 9, 29)), ['thursday']);
    assert.deepEqual(fastingReasons(new Date(2026, 9, 25)), ['white'], '14 Jumada al-Ula, a Sunday');
    assert.deepEqual(fastingReasons(new Date(2026, 9, 28)), []);
    for (const h of [{ day: 5, month: 9 }, { day: 1, month: 10 }, { day: 10, month: 12 }, { day: 13, month: 12 }]) assert.equal(fastingExcluded({ ...h, year: 1448 }), true);
    assert.equal(fastingExcluded({ day: 14, month: 12, year: 1448 }), false);
    // Every day of a year: nothing suggested in Ramadan or on the excluded days.
    for (let i = 0; i < 366; i++) {
        const d = new Date(2026, 0, 1 + i), h = hijriDate(d);
        if (fastingExcluded(h)) assert.deepEqual(fastingReasons(d), [], d.toDateString());
    }
    const soon = upcomingFasts(new Date(2026, 9, 27, 9).getTime(), 7);
    assert.ok(soon.every(f => f.day > '2026-10-27'), 'starts tomorrow');
});

test('Calendar reminders: off by default, ids clear of every other reminder, inside the 64-notification budget', () => {
    const s = initialState();
    assert.deepEqual(s.calendar, { jumuah: false, fasting: false });
    assert.deepEqual(calendarReminders(s, copy, new Date(2026, 9, 27, 9).getTime()), []);
    const on = { ...s, calendar: { jumuah: true, fasting: true } };
    const list = calendarReminders(on, copy, new Date(2026, 9, 27, 9).getTime());
    const fri = list.find(r => r.kind === 'jumuah');
    assert.equal(fri.day, '2026-10-30'); assert.equal(new Date(fri.at).getHours(), 10); assert.equal(fri.url, 'ayahflow://ayah/18:1');
    assert.equal(fri.id, JUMUAH_CODE * 1000000 + 261030);
    const fasts = list.filter(r => r.kind === 'fast');
    assert.ok(fasts.length <= FAST_MAX && fasts.length > 0);
    assert.equal(fasts[0].day, '2026-10-29'); assert.equal(fasts[0].id, FAST_CODE * 1000000 + 261029);
    assert.equal(new Date(fasts[0].at).getDate(), 28, 'the evening before'); assert.equal(new Date(fasts[0].at).getHours(), 20);
    const others = new Set([beforeId('fajr', '2026-10-30'), athanId('isha', '2026-10-30'), istighfarId('evening', '2026-10-30')]);
    assert.ok(list.every(r => r.id >= 24000000 && r.id < 26000000 && !others.has(r.id)));
    assert.equal(rotationMax(on), ROTATION_MAX - (s.athan.before.enabled ? 10 : 0) - 1 - FAST_MAX, 'rotation gives up the room');
    const sleepy = { ...on, smart: { ...on.smart, sleepTime: '20:00' } };
    const early = calendarReminders(sleepy, copy, new Date(2026, 9, 27, 9).getTime()).find(r => r.kind === 'fast');
    assert.equal(new Date(early.at).getHours(), 19, 'before an earlier sleep time');
    // Already past: nothing sent late.
    assert.equal(calendarReminders(on, copy, new Date(2026, 9, 30, 11).getTime()).find(r => r.day === '2026-10-30'), undefined);
});

test('Migration v17 → v18 keeps everything, adds the calendar switches off and no reviews; bad data is rejected', () => {
    assert.equal(STATE_VERSION, 18);
    const v17 = JSON.parse(JSON.stringify({ ...setHighlight(initialState(), 2, 255, 'green', 1), version: 17, xp: 40 }));
    delete v17.calendar; delete v17.highlightReviews;
    const m = validateState(v17);
    assert.equal(m.version, 18); assert.equal(m.xp, 40); assert.deepEqual(m.calendar, { jumuah: false, fasting: false }); assert.deepEqual(m.highlightReviews, []);
    assert.equal(m.highlights[0].key, '2:255');
    const ok = initialState();
    assert.throws(() => validateState({ ...ok, calendar: { jumuah: 'yes', fasting: false } }), /calendar/);
    assert.throws(() => validateState({ ...ok, highlightReviews: [{ key: '2:255', day: '2026-10-27', result: 'perfect' }] }), /highlight reviews/);
    assert.throws(() => validateState({ ...ok, highlightReviews: [{ key: '2:255', day: '2026-10-27', result: 'revisit' }, { key: '2:255', day: '2026-10-27', result: 'revisit' }] }), /highlight reviews/);
});

test('Highlight review: one answer per verse and day, never scored, revisit comes back first', () => {
    let s = initialState();
    for (const [a, c] of [[255, 'gold'], [286, 'green'], [201, 'blue'], [152, 'rose']]) s = setHighlight(s, 2, a, c, a);
    s = setNote(s, 2, 286, 'Ending of Al-Baqarah', 1);
    const q1 = highlightReviewQueue(s, '2026-10-27');
    assert.equal(q1.length, 3); assert.ok(q1.every(x => x.today === null));
    const a = reviewHighlight(s, 2, 152, 'revisit', '2026-10-27'), b = reviewHighlight(a, 2, 152, 'revisit', '2026-10-27');
    assert.equal(b, a, 'the same answer again changes nothing');
    const c = reviewHighlight(a, 2, 152, 'remembered', '2026-10-27');
    assert.equal(c.highlightReviews.length, 1); assert.equal(c.highlightReviews[0].result, 'remembered');
    assert.equal(c.xp, s.xp); assert.deepEqual(c.attempts, s.attempts); assert.equal(c.recallSelfChecks, s.recallSelfChecks);
    // Next day: never-reviewed first, then "revisit", then the longest since "remembered".
    let d = reviewHighlight(s, 2, 255, 'remembered', '2026-10-25');
    d = reviewHighlight(d, 2, 286, 'revisit', '2026-10-26');
    d = reviewHighlight(d, 2, 201, 'remembered', '2026-10-26');
    assert.deepEqual(highlightReviewQueue(d, '2026-10-27').map(x => x.key), ['2:152', '2:286', '2:255']);
    const today = reviewHighlight(d, 2, 201, 'revisit', '2026-10-27');
    const q = highlightReviewQueue(today, '2026-10-27');
    assert.deepEqual(q.map(x => x.key), ['2:152', '2:286', '2:255', '2:201'], 'answered today stays listed with its answer; the order does not move');
    assert.equal(q[3].today, 'revisit');
    const first = reviewHighlight(d, 2, 286, 'remembered', '2026-10-27');
    assert.deepEqual(highlightReviewQueue(first, '2026-10-27').map(x => x.key), ['2:152', '2:286', '2:255']);
    assert.deepEqual(highlightReviewQueue(initialState(), '2026-10-27'), []);
});

test('Wiring: Qibla tab, compass only while shown, calendar sync, review screen; wording in three languages', () => {
    const app = read('src/app.ts');
    assert.match(app, /\['today', 'history', 'times', 'qibla'\] as const/);
    assert.match(app, /const want = view === 'prayer' && prayerTab === 'qibla' && !document\.hidden/);
    assert.match(app, /await syncRotation\(\);\n            await syncCalendar\(\);/);
    assert.match(app, /review: reviewView/);
    const bridge = read('native/bridge.mjs');
    assert.match(bridge, /const CALENDAR = \(id\) => id >= 24000000 && id < 26000000;/);
    const swift = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift');
    assert.match(swift, /CAPPluginMethod\(name: "startHeading"/); assert.match(swift, /func stop\(\) \{ manager\.stopUpdatingHeading\(\) \}/);
    for (const k of ['ptab_qibla', 'qiblaSub', 'qiblaNote', 'qiblaFacing', 'qiblaRight', 'qiblaLeft', 'qiblaCalibrate', 'calendarSection', 'jumuahToggle', 'jumuahBody', 'fastingToggle', 'fastingNote', 'fastTitle', 'fastWhite', 'fastingHijriNote', 'reviewTitle', 'reviewSub', 'reviewHonest', 'reviewRemembered', 'reviewRevisit'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});
