// Release gate: the Ayah of the Moment across daylight saving changes, the widget's own copy of the rotation, and the
// athan plan at high latitudes (yesterday's Isha after midnight, close to or after today's Fajr). Time zones are set per test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, PRAYER_METHODS, dayKey } from '../www/js/engine.js';
import { timesFor, nextPrayer, prayerDayView, prayersFrom, athanSchedule, widgetData } from '../www/js/smart.js';
import { slotOf, slotRange, ayahOfMoment, upcomingMoments, momentPool, standardOffset, SLOT_MINUTES } from '../www/js/worship.js';
import { verse, chapter } from '../www/js/data.js';

const zone = (tz) => { process.env.TZ = tz; };
const HALF = SLOT_MINUTES * 60000;
const place = (lat, lng, method) => { const s = initialState(); s.places.home = { lat, lng, radius: 150 }; s.smart.method = method; s.athan.enabled = true; return s; };
const label = () => ({ title: '', body: '' });

test('DST: around both 2026 New York changes the moment changes every 30 elapsed minutes, in order, on :00 and :30', () => {
    zone('America/New_York');
    for (const [from, length] of [[new Date(2026, 2, 7, 20), 23], [new Date(2026, 9, 31, 20), 25]]) {
        const list = upcomingMoments(from.getTime(), 48);
        for (let i = 1; i < list.length; i++) {
            assert.equal(list[i].at - list[i - 1].at, HALF, `${new Date(list[i].at)}: exactly 30 minutes after the last`);
            assert.notEqual(list[i].ref, list[i - 1].ref, 'a different ayah each slot');
        }
        for (const m of list) assert.ok([0, 30].includes(new Date(m.at).getMinutes()) && new Date(m.at).getSeconds() === 0, `${new Date(m.at)} starts on :00 or :30`);
        // The 23- and 25-hour days have 46 and 50 slots: none invented in the missing hour, none repeated in the doubled one.
        const day = new Date(from); day.setDate(day.getDate() + 1); day.setHours(0, 0, 0, 0);
        const next = new Date(day); next.setDate(next.getDate() + 1);
        assert.equal((next - day) / 3600000, length);
        assert.equal(slotOf(next.getTime()) - slotOf(day.getTime()), length * 2);
    }
    // Spring: 01:30 EST is followed by 03:00 EDT (02:xx does not exist); autumn: 01:00 and 01:30 come twice, each a new slot.
    const spring = upcomingMoments(new Date(2026, 2, 8, 1, 30).getTime(), 2).map(m => new Date(m.at));
    assert.deepEqual(spring.map(d => [d.getHours(), d.getMinutes()]), [[1, 30], [3, 0]]);
    const fall = upcomingMoments(new Date(2026, 10, 1, 0, 30).getTime(), 6).map(m => new Date(m.at));
    assert.deepEqual(fall.map(d => [d.getHours(), d.getMinutes()]), [[0, 30], [1, 0], [1, 30], [1, 0], [1, 30], [2, 0]]);
    assert.deepEqual(fall.map(d => d.getTimezoneOffset()), [240, 240, 240, 300, 300, 300]);
});

test('Slots: one number per instant, minute by minute, in zones with 30- and 45-minute offsets and half-hour DST', () => {
    for (const tz of ['America/New_York', 'Europe/London', 'Australia/Lord_Howe', 'Asia/Kathmandu', 'Asia/Kolkata', 'Pacific/Auckland', 'UTC']) {
        zone(tz);
        for (const start of [new Date(2026, 2, 6), new Date(2026, 3, 3), new Date(2026, 8, 25), new Date(2026, 9, 30), new Date(2026, 11, 31, 12)]) {
            let last = slotOf(start.getTime());
            for (let m = 1; m < 4 * 24 * 60; m++) {
                const at = start.getTime() + m * 60000, s = slotOf(at), [a, b] = slotRange(s);
                assert.ok(s === last || s === last + 1, `${tz} ${new Date(at)}: slots never jump or go back`);
                assert.ok(a <= at && at < b && b - a === HALF, `${tz} ${new Date(at)} lies in its slot`);
                if (s !== last) assert.equal(at, a, `${tz}: a new slot starts exactly on the boundary`);
                assert.equal(new Date(a).getMinutes() % 30, 0, `${tz} ${new Date(a)} starts on the half hour`);
                last = s;
            }
        }
    }
    zone('America/New_York');
    assert.equal(standardOffset(new Date(2026, 6, 1).getTime()), -5 * 3600000, 'standard time all year, also in summer');
});

test('Widget pool: AyahMoments.json is the app\'s pool, in order, with the corpus text unchanged', () => {
    const file = JSON.parse(readFileSync(new URL('../ios/App/AyahFlowWidget/AyahMoments.json', import.meta.url), 'utf8'));
    assert.equal(file.v, 1);
    assert.equal(file.slotMinutes, SLOT_MINUTES);
    assert.deepEqual(file.ayahs, momentPool().map(([s, a]) => [s, a, verse(s, a), chapter(s).name, chapter(s).ar]));
    // The widget's index for a slot is the app's: slot modulo the pool length.
    for (const slot of [0, 1, 516, 517, 9000, -3]) { const [s, a] = file.ayahs[((slot % file.ayahs.length) + file.ayahs.length) % file.ayahs.length]; assert.deepEqual(ayahOfMoment(slot), { surah: s, ayah: a }); }
});

test('Athan: an Isha just after midnight and the next one just before get different ids, so neither alert replaces the other', () => {
    zone('Europe/London');
    const s = place(51.5074, -0.1278, 'NorthAmerica'), now = new Date(2026, 6, 8, 1).getTime();
    const ishas = athanSchedule(s, label, now).filter(a => a.prayer === 'isha');
    const late = ishas.find(a => dayKey(a.at) === '2026-07-11' && new Date(a.at).getHours() === 0), early = ishas.find(a => dayKey(a.at) === '2026-07-11' && new Date(a.at).getHours() === 23);
    assert.ok(late && early, 'two Ishas fall on 11 July: the 10th\'s after midnight and the 11th\'s before it');
    assert.notEqual(late.id, early.id);
    for (const [tz, lat, lng] of [['Europe/London', 51.5074, -0.1278], ['Europe/Oslo', 59.91, 10.75], ['America/Edmonton', 53.55, -113.49]]) {
        zone(tz);
        for (const method of ['MuslimWorldLeague', 'NorthAmerica', 'Egyptian']) for (let d = 0; d < 365; d += 1) {
            const at = new Date(2026, 0, 1 + d, 12).getTime(), list = athanSchedule(place(lat, lng, method), label, at);
            assert.equal(new Set(list.map(a => a.id)).size, list.length, `${tz} ${method} ${dayKey(at)}: unique ids`);
            assert.ok(list.every((a, i) => i === 0 || a.at >= list[i - 1].at), `${tz} ${method} ${dayKey(at)}: in time order`);
        }
    }
});

test('High latitude: yesterday\'s Isha at or after today\'s Fajr stays in the plan, in time order, and nothing is doubled', () => {
    zone('Europe/Oslo');
    let found = 0;
    for (let d = 140; d < 220; d++) {
        const day = new Date(2026, 0, d), prev = new Date(2026, 0, d - 1), s = place(59.91, 10.75, 'MuslimWorldLeague');
        const isha = timesFor(s, prev).isha, fajr = timesFor(s, day).fajr;
        if (isha < fajr) continue;
        found++;
        const now = Math.min(isha, fajr) - 5 * 60000, list = prayersFrom(s, now, 2);
        assert.ok(list.every((p, i) => i === 0 || p.at >= list[i - 1].at), `${dayKey(day.getTime())}: in time order`);
        assert.equal(list.filter(p => p.prayer === 'isha' && p.day === dayKey(prev.getTime())).length, 1, 'yesterday\'s Isha once');
        assert.equal(list.filter(p => p.prayer === 'fajr' && p.day === dayKey(day.getTime())).length, 1, 'today\'s Fajr once');
        const next = nextPrayer(s, now);
        assert.equal(next.at, Math.min(isha, fajr), 'the next prayer is the earliest one to come');
        assert.equal(prayerDayView(s, now).day, next.day, 'the card shows the day of that prayer');
        const alerts = athanSchedule(s, label, now);
        assert.ok(alerts.some(a => a.prayer === 'isha' && a.at === isha) && alerts.some(a => a.prayer === 'fajr' && a.at === fajr), 'both athans are planned');
        assert.equal(new Set(alerts.map(a => a.id)).size, alerts.length);
        const w = widgetData(s, (k) => k, now);
        assert.ok(w.prayers.every((p, i) => i === 0 || p.at >= w.prayers[i - 1].at), 'the widget gets them in time order');
        assert.equal(s.smart.method, 'MuslimWorldLeague', 'the chosen method is left as it is');
    }
    assert.ok(found > 20, `Oslo, Muslim World League, summer 2026: ${found} nights where Isha reaches the next Fajr`);
});

test('Prayer order: across every method and a year at 60°N, the next prayer is always the earliest still to come', () => {
    zone('Europe/Stockholm');
    for (const method of PRAYER_METHODS) {
        const s = place(59.33, 18.07, method);
        for (let h = 0; h < 365 * 24; h += 11) {
            const now = new Date(2026, 0, 1).getTime() + h * 3600000, list = prayersFrom(s, now, 2), next = nextPrayer(s, now);
            assert.equal(next.at, Math.min(...list.filter(p => p.at > now).map(p => p.at)), `${method} ${new Date(now)}`);
        }
    }
});
