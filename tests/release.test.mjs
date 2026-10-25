// Release gate: prayer times across time zones, DST and methods; the prayer day around midnight; tracking that only
// changes on the user's action; and saved worship data surviving a restart. Time zones are switched per test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, validateState, setSalah, salahStatus, setTasbih, tasbihOn, setCount, countOn, toggleFavorite, markRecent, setTarget, dayKey, PRAYERS, PRAYER_METHODS } from '../www/js/engine.js';
import { timesFor, nextPrayer, prayerDayView, prayersFrom, widgetData } from '../www/js/smart.js';
import { salahDay, daySummary, salahReminders, salahInsights, salahStreak } from '../www/js/worship.js';
import { tr } from '../www/js/i18n.js';

const zone = (tz) => { process.env.TZ = tz; };
const place = (lat, lng, method, hanafi = false) => { const s = initialState(); s.places.home = { lat, lng, radius: 150 }; s.smart.method = method; s.smart.hanafi = hanafi; return s; };
const NYC = () => place(40.7128, -74.006, 'NorthAmerica');
const LONDON = () => place(51.5074, -0.1278, 'MuslimWorldLeague');
const wall = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
const copy = (p, kind) => ({ title: tr(kind === 'tasbih' ? 'nudgeTasbihTitle' : 'checkInTitle').replace('{prayer}', p), body: tr(kind === 'tasbih' ? 'nudgeTasbihBody' : 'checkInBody') });

test('Prayer times: five prayers in order on their own local day, for every calculation method', () => {
    zone('Europe/London');
    for (const method of PRAYER_METHODS) for (const day of [new Date(2026, 0, 15), new Date(2026, 5, 21), new Date(2026, 9, 25)]) {
        const t = timesFor(place(51.5074, -0.1278, method), day);
        assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, `${method} ${dayKey(day.getTime())}`);
        for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib']) assert.equal(dayKey(t[p]), dayKey(day.getTime()), `${method} ${p} falls on its own day`);
        // At high latitudes in summer Isha can fall after midnight; it still comes before the next day's Fajr.
        const next = new Date(day); next.setDate(next.getDate() + 1);
        assert.ok(t.isha < timesFor(place(51.5074, -0.1278, method), next).fajr, `${method} Isha before the next Fajr`);
    }
});

test('Asr: the Hanafi setting gives a later Asr and leaves the other prayers unchanged', () => {
    zone('Asia/Karachi');
    const day = new Date(2026, 9, 25), shafi = timesFor(place(24.8607, 67.0011, 'Karachi'), day), hanafi = timesFor(place(24.8607, 67.0011, 'Karachi', true), day);
    assert.ok(hanafi.asr - shafi.asr > 30 * 60000, 'Hanafi Asr (shadow ×2) is well after the standard Asr');
    for (const p of ['fajr', 'sunrise', 'dhuhr', 'maghrib', 'isha']) assert.equal(hanafi[p], shafi[p], p);
});

test('DST: across both 2026 US transitions, prayer times move with the sun and the clock change, nothing else', () => {
    zone('America/New_York');
    for (const [a, b] of [[new Date(2026, 2, 7), new Date(2026, 2, 8)], [new Date(2026, 2, 8), new Date(2026, 2, 9)], [new Date(2026, 9, 31), new Date(2026, 10, 1)], [new Date(2026, 10, 1), new Date(2026, 10, 2)]]) {
        const ta = timesFor(NYC(), a), tb = timesFor(NYC(), b);
        for (const p of PRAYERS) {
            const shift = new Date(ta[p]).getTimezoneOffset() - new Date(tb[p]).getTimezoneOffset();
            assert.ok(Math.abs(wall(tb[p]) - wall(ta[p]) - shift) <= 5, `${p} ${dayKey(a.getTime())}→${dayKey(b.getTime())}: ${wall(ta[p])} vs ${wall(tb[p])}, clock change ${shift} min`);
            assert.equal(dayKey(tb[p]), dayKey(b.getTime()));
        }
    }
    // The 23- and 25-hour days still give exactly five prayers each, in order, with nothing skipped or doubled.
    const list = prayersFrom(NYC(), new Date(2026, 2, 7, 1).getTime(), 3).concat(prayersFrom(NYC(), new Date(2026, 9, 31, 1).getTime(), 3));
    assert.equal(list.length, 30);
    for (let i = 1; i < 15; i++) assert.ok(list[i].at > list[i - 1].at);
});

test('Location and time zone changes: times follow the saved place; the next prayer is always in the future', () => {
    zone('Europe/London');
    const now = new Date(2026, 9, 25, 14).getTime();
    const london = timesFor(LONDON(), new Date(now)), moved = { ...LONDON(), places: { ...LONDON().places, home: { lat: 48.8566, lng: 2.3522, radius: 150 } } };
    assert.notEqual(timesFor(moved, new Date(now)).fajr, london.fajr, 'a new place gives new times');
    for (const tz of ['Europe/London', 'Asia/Riyadh', 'America/New_York', 'Pacific/Auckland']) {
        zone(tz);
        for (const s of [LONDON(), NYC(), place(21.4225, 39.8262, 'UmmAlQura')]) for (let h = 0; h < 48; h += 1) {
            const at = now + h * 3600000, next = nextPrayer(s, at);
            assert.ok(next && next.at > at && next.at - at < 24 * 3600000, `${tz} +${h}h`);
            const view = prayerDayView(s, at);
            assert.ok(view && PRAYERS.some(p => view.times[p] === view.next.at));
        }
    }
});

test('Midnight: before Fajr the prayer day is still yesterday (Isha after midnight goes on its own day); without a place, the calendar day', () => {
    zone('Europe/London');
    const s = LONDON(), t = timesFor(s, new Date(2026, 9, 25));
    assert.equal(salahDay(s, new Date(2026, 9, 25, 0, 30).getTime()), '2026-10-24');
    assert.equal(salahDay(s, t.fajr - 60000), '2026-10-24');
    assert.equal(salahDay(s, t.fajr), '2026-10-25');
    assert.equal(salahDay(s, new Date(2026, 9, 25, 23, 50).getTime()), '2026-10-25');
    assert.equal(salahDay(initialState(), new Date(2026, 9, 25, 0, 30).getTime()), '2026-10-25');
    const after = prayerDayView(s, t.isha + 60000);
    assert.equal(after.tomorrow, true, 'after Isha the next-prayer card shows tomorrow');
    assert.equal(dayKey(after.next.at), '2026-10-26');
});

test('Tracking changes only on the user\'s action: days pass, reminders are planned, nothing becomes missed or completed', () => {
    zone('Europe/London');
    let s = LONDON();
    const now = new Date(2026, 9, 25, 22).getTime();
    s = { ...s, worship: { ...s.worship, prefs: { ...s.worship.prefs, checkIn: true, tasbihNudge: true } } };
    const before = JSON.stringify(s.worship);
    for (let d = 0; d < 40; d++) salahReminders(s, copy, now - d * 86400000);
    salahInsights(s, now); salahStreak(s, now);
    assert.equal(JSON.stringify(s.worship), before, 'planning reminders and computing progress never write a status');
    for (let d = 0; d < 40; d++) { const day = dayKey(now - d * 86400000), x = daySummary(s, day); assert.deepEqual([x.done, x.missed, x.madeUp, x.open], [0, 0, 0, 5], day); }
    for (const loc of ['en', 'fr', 'ar']) for (const key of ['checkInBody', 'checkInTitle', 'nudgeTasbihBody']) assert.doesNotMatch(tr(key, loc), /missed|manqu|فات|فائت/i, `${loc} ${key} never says a prayer was missed`);
    s = setSalah(s, '2026-10-24', 'isha', 'missed', now);
    s = setSalah(s, '2026-10-24', 'isha', 'madeUp', now + 1000);
    s = setSalah(s, '2026-10-24', 'isha', 'done', now + 2000);
    assert.equal(salahStatus(s, '2026-10-24', 'isha'), 'done', 'a status can be corrected in any direction');
});

test('Restart: salah, tasbih, counts, favourites, recents and targets survive a save and reload unchanged', () => {
    zone('Europe/London');
    const now = new Date(2026, 9, 25, 15).getTime(), day = dayKey(now);
    let s = LONDON();
    s = setSalah(s, day, 'fajr', 'done', now - 8 * 3600000);
    s = setSalah(s, '2026-10-24', 'asr', 'missed', now);
    s = setSalah(s, '2026-10-24', 'asr', 'madeUp', now + 1);
    s = setTasbih(s, day, 'dhuhr', 'tasbih-prayer', 57);
    s = setCount(s, 'istighfar', 42, now);
    s = toggleFavorite(s, 'hawqala'); s = markRecent(s, 'kalimatan'); s = setTarget(s, 'hawqala', 250);
    const reloaded = validateState(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(reloaded, s);
    assert.equal(tasbihOn(reloaded, day, 'dhuhr', 'tasbih-prayer'), 57);
    assert.equal(countOn(reloaded, 'istighfar', day), 42);
    assert.equal(salahStatus(reloaded, '2026-10-24', 'asr'), 'madeUp');
});

test('High latitude: an Isha after midnight is still the next prayer, belongs to its own day, and reaches the widget', () => {
    zone('Europe/London');
    const s = LONDON(), isha = timesFor(s, new Date(2026, 5, 21)).isha;
    assert.equal(dayKey(isha), '2026-06-22', 'London, Muslim World League, June: Isha falls after midnight');
    const now = new Date(2026, 5, 22, 0, 10).getTime();
    assert.deepEqual(nextPrayer(s, now), { prayer: 'isha', at: isha, day: '2026-06-21' });
    assert.equal(prayerDayView(s, now).day, '2026-06-21');
    assert.equal(salahDay(s, now), '2026-06-21');
    const w = widgetData(s, (k) => k, now);
    assert.deepEqual(w.prayers[0], { key: 'isha', label: 'p_isha', at: isha, day: '2026-06-21' });
    assert.equal(w.prayers.filter(p => p.day === '2026-06-22').length, 5);
    // Near the solstice this method's high-latitude rule puts Isha and the next Fajr in the same minute.
    assert.ok(w.prayers.every((p, i) => i === 0 || p.at > w.prayers[i - 1].at - 2 * 60000));
    // Normal latitudes: nothing from yesterday once its Isha has passed.
    zone('Asia/Riyadh');
    const mk = place(21.4225, 39.8262, 'UmmAlQura');
    assert.equal(widgetData(mk, (k) => k, new Date(2026, 9, 25, 0, 30).getTime()).prayers[0].day, '2026-10-25');
});

test('Numbers in templates: a count and its total are formatted alike (no fixed Arabic-Indic digit beside a placeholder)', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');
    assert.deepEqual(src.match(/'[^']*\{[a-z]+\}[^']*[٠-٩][^']*'|'[^']*[٠-٩][^']*\{[a-z]+\}[^']*'/g), null);
    for (const loc of ['en', 'fr', 'ar']) assert.match(tr('ofFive', loc), /\{n\}.*\{total\}/);
    assert.equal(tr('ofFive', 'fr').replace('{n}', '1').replace('{total}', '5'), '1 sur 5 prières confirmées');
});
