import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verse, chapter } from '../www/js/data.js';
import { ADHKAR_ENTRIES, PRAYER_SETS, MOMENTS, GENERAL_MOMENTS, entriesFor, quranPassages, sourceUrl, decide, emptyHistory, parseMomentUrl, momentUrl, currentMoment, RULES } from '../www/js/adhkar.js';
import { initialState, validateState, completeDhikr, completedToday, exportable, STATE_VERSION, dayKey } from '../www/js/engine.js';
import { prayerTimes, dayWindows } from '../www/js/prayer.js';
const sources = JSON.parse(readFileSync(new URL('../content/adhkar/sources.json', import.meta.url), 'utf8')).hadiths;
const key = s => s.normalize('NFC').replace(/[ً-ٰٟۖ-ۭـ‎‏]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[^ء-ي ]/g, ' ').replace(/\s+/g, ' ').trim();
const H = 3600000, DAY = '2026-10-22', at = h => new Date(2026, 9, 22, Math.floor(h), Math.round((h % 1) * 60)).getTime();
const W = { day: DAY, morning: [at(5.5), at(12.5)], evening: [at(16), at(19.5)] };
const ALL = new Set(MOMENTS);

test('Every dua is a verbatim slice of its committed source hadith', () => {
    assert(ADHKAR_ENTRIES.length >= 15);
    for (const e of ADHKAR_ENTRIES) {
        const src = sources[e.source.ref];
        assert(src, `${e.id}: source ${e.source.ref} snapshot missing`);
        if (e.kind === 'quran') { assert(e.quran.length && !e.text, e.id); continue; }
        assert(src.text.includes(e.text), `${e.id}: text is not a verbatim substring of ${e.source.ref}`);
        assert(key(e.text).split(' ').length >= 2 || e.id === 'subhan-bihamdih', e.id);
        for (const a of e.also) assert(sources[a.ref], `${e.id}: supporting ${a.ref} missing`);
    }
});
test('Quran-based adhkar read real ayahs from the corpus', () => {
    const kursi = ADHKAR_ENTRIES.find(e => e.id === 'ayat-al-kursi');
    assert.equal(quranPassages(kursi)[0].ayahs[0].text, verse(2, 255));
    const quls = quranPassages(ADHKAR_ENTRIES.find(e => e.id === 'three-quls'));
    assert.deepEqual(quls.map(q => [q.surah, q.ayahs.length]), [[112, 4], [113, 5], [114, 6]]);
    const riding = ADHKAR_ENTRIES.find(e => e.id === 'riding'); assert.equal(riding.kind, 'dua'); assert.equal(riding.quranRef, '43:13-14'); verse(43, 13); verse(43, 14); assert(sources['abudawud:2602'].text.includes(riding.text));
});
test('No dhikr relies on a hadith graded weak by every grader recorded', () => {
    for (const e of ADHKAR_ENTRIES) {
        const g = e.source.grades.map(x => x.grade.toLowerCase());
        assert(!(g.length && g.every(x => x.includes('daif'))), `${e.id} is graded weak`);
    }
});
test('Sources keep collection, number and a sunnah.com in-book link; mu‘allaq narrations are labelled', () => {
    for (const e of ADHKAR_ENTRIES) { assert(e.source.collection && e.source.number, e.id); assert.match(sourceUrl(e.source), /^https:\/\/sunnah\.com\/[a-z]+\/\d+\/\d+$/); }
    assert.equal(sourceUrl(ADHKAR_ENTRIES.find(e => e.id === 'leave-home').source), 'https://sunnah.com/abudawud/43/323');
    assert.equal(ADHKAR_ENTRIES.find(e => e.id === 'ayat-al-kursi').note, 'muallaq');
});
test('Every moment with a narrated text has entries; general moments have none', () => {
    for (const m of MOMENTS) assert.equal(entriesFor(m).length > 0, !GENERAL_MOMENTS.includes(m), m);
});
test('Prayer-surah suggestions cite hadiths that mention them', () => {
    for (const p of PRAYER_SETS) { const t = key(sources[p.source.ref].text); for (const ev of p.evidence) assert(t.includes(key(ev)), `${p.id}: ${ev}`); p.surahs.forEach(s => chapter(s)); }
});
test('Leaving home in the morning window gives one grouped reminder', () => {
    const { decision } = decide('EXIT_HOME', at(7), W, emptyHistory(), ALL);
    assert.deepEqual(decision.moments, ['leave_home', 'morning']);
    assert.equal(decision.url, 'ayahflow://moment/leave_home+morning');
});
test('Crossing the home boundary repeatedly is deduplicated by the cooldown', () => {
    let h = decide('EXIT_HOME', at(7), W, emptyHistory(), ALL).history;
    assert.equal(decide('EXIT_HOME', at(7.25), W, h, ALL).decision, null);
    assert.deepEqual(decide('EXIT_HOME', at(8), W, h, ALL).decision.moments, ['leave_home']); // 60 min later; morning already sent today
    h = decide('ENTER_HOME', at(7.1), W, h, ALL).history;
    assert.equal(decide('ENTER_HOME', at(7.3), W, h, ALL).decision, null);
});
test('Morning is offered once per day, even if the user never leaves home, and not after completion', () => {
    const r = decide('MORNING', at(6), W, emptyHistory(), ALL);
    assert.deepEqual(r.decision.moments, ['morning']);
    assert.equal(decide('MORNING', at(9), W, r.history, ALL).decision, null);
    const done = { ...emptyHistory(), completedDay: { morning: DAY } };
    assert.deepEqual(decide('EXIT_HOME', at(7), W, done, ALL).decision.moments, ['leave_home']);
    assert.equal(decide('MORNING', at(6), W, done, ALL).decision, null);
});
test('Returning home in the evening window groups the evening collection', () => {
    assert.deepEqual(decide('ENTER_HOME', at(17), W, emptyHistory(), ALL).decision.moments, ['enter_home', 'evening']);
    assert.deepEqual(decide('ENTER_HOME', at(21), W, emptyHistory(), ALL).decision.moments, ['enter_home']);
});
test('Disabled moments are never reminded; a disabled trigger does not leak a grouped collection', () => {
    const only = new Set(['morning']);
    assert.equal(decide('EXIT_HOME', at(7), W, emptyHistory(), only).decision, null);
    assert.equal(decide('ENTER_VEHICLE', at(7), W, emptyHistory(), new Set()).decision, null);
});
test('A vehicle event reminds of the riding dua only: it never claims the user is driving', () => {
    const d = decide('ENTER_VEHICLE', at(22), W, emptyHistory(), ALL).decision;
    assert.deepEqual(d.moments, ['vehicle']);
    assert(RULES.every(r => !r.moments.includes('driving')));
});
test('Moment links round-trip and reject unknown or malformed input', () => {
    assert.deepEqual(parseMomentUrl(momentUrl(['leave_home', 'morning'])), ['leave_home', 'morning']);
    assert.deepEqual(parseMomentUrl('ayahflow://moment/vehicle+bogus+vehicle'), ['vehicle']);
    assert.deepEqual(parseMomentUrl('https://evil.example/moment/vehicle'), []);
    assert.deepEqual(parseMomentUrl('ayahflow://moment/<script>'), []);
});
test('Current moment follows the windows', () => {
    assert.equal(currentMoment(W, at(6), null), 'morning');
    assert.equal(currentMoment(W, at(17), null), 'evening');
    assert.equal(currentMoment(W, at(23), [at(22), at(24)]), 'sleep');
    assert.equal(currentMoment(W, at(14), null), null);
});
test('Prayer times are computed offline and ordered; windows follow the chosen span', () => {
    const t = prayerTimes(21.4225, 39.8262, new Date(2026, 9, 22, 12), 'UmmAlQura');
    assert(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha);
    const narrow = dayWindows(DAY, t, 'narrow'), broad = dayWindows(DAY, t, 'broad');
    assert.deepEqual(narrow.morning, [t.fajr, t.sunrise]); assert.deepEqual(broad.morning, [t.fajr, t.dhuhr]);
    assert.deepEqual(narrow.evening, [t.asr, t.maghrib]); assert.deepEqual(broad.evening, [t.asr, t.isha]);
    assert.deepEqual(dayWindows(DAY, null, 'broad'), { day: DAY, morning: null, evening: null });
});
test('Completions are explicit, idempotent and kept apart from reminders', () => {
    let s = initialState();
    s = completeDhikr(s, 'leave-home', 'leave_home', at(7), 'tap-1');
    assert.strictEqual(completeDhikr(s, 'leave-home', 'leave_home', at(7), 'tap-1'), s);
    assert.deepEqual([...completedToday(s, 'leave_home', at(8))], ['leave-home']);
    assert.equal(completedToday(s, 'leave_home', at(8) + 86400000).size, 0);
    assert.throws(() => completeDhikr(s, 'leave-home', 'morning', at(7), 'tap-2'));
    assert.throws(() => completeDhikr(s, 'not-real', 'morning', at(7), 'tap-3'));
    assert.equal(s.adhkarLog[0].day, dayKey(at(7)));
});
test('Version 5 saves validate places and settings; exports never contain coordinates', () => {
    assert.equal(STATE_VERSION, 6);
    const s = { ...initialState(), places: { home: { lat: 21.42, lng: 39.82, radius: 150 }, work: null, mosque: null }, detections: [{ event: 'EXIT_HOME', at: 1 }] };
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).places.home, { lat: 21.42, lng: 39.82, radius: 150 });
    assert.throws(() => validateState({ ...s, places: { ...s.places, home: { lat: 95, lng: 0, radius: 150 } } }), /places/);
    assert.throws(() => validateState({ ...s, places: { ...s.places, home: { lat: 1, lng: 1, radius: 20 } } }), /places/);
    assert.throws(() => validateState({ ...s, smart: { ...s.smart, method: 'Made-up' } }), /smart/);
    assert.throws(() => validateState({ ...s, adhkarLog: [{ id: 'x', entry: 'nope', moment: 'morning', at: 1, day: '2026-10-22' }] }), /adhkar/);
    const out = exportable(s);
    assert.deepEqual(out.places, { home: null, work: null, mosque: null }); assert.deepEqual(out.detections, []);
    assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(out))));
    const fresh = initialState();
    assert.equal(fresh.smart.location || fresh.smart.vehicle || fresh.smart.timed, false); // nothing is on until the user turns it on
});
import { nativeConfig, timedReminders, timedId, enabledMoments, mergeDetections, momentPreview, momentDone, athanSchedule, athanId, nextPrayer, prayersFrom, widgetData } from '../www/js/smart.js';
const copy = m => ({ title: m, body: momentPreview(m) ?? 'general' });
const NOW = new Date(2026, 9, 22, 5, 0).getTime();
const withHome = (smart = {}) => ({ ...initialState(), places: { home: { lat: 21.4225, lng: 39.8262, radius: 150 }, work: null, mosque: null }, smart: { ...initialState().smart, ...smart } });
test('Native config carries regions, rules, a week of windows and verbatim previews, but nothing is enabled by default', () => {
    const c = nativeConfig(withHome(), copy, NOW);
    assert.deepEqual(c.regions, [{ id: 'home', lat: 21.4225, lng: 39.8262, radius: 150 }]);
    assert.equal(c.windows.length, 8); assert(c.windows.every(w => w.morning && w.morning[0] < w.morning[1]));
    assert.equal(c.location, false); assert.equal(c.vehicle, false);
    assert(!c.enabled.includes('leave_home') && !c.enabled.includes('vehicle') && !c.enabled.includes('morning'));
    assert.equal(c.copy.leave_home.body, ADHKAR_ENTRIES.find(e => e.id === 'leave-home').text);
    assert.equal(c.timedIds.morning['2026-10-22'], timedId('morning', '2026-10-22'));
});
test('Enabling location turns on place moments only; vehicle needs its own switch', () => {
    const e = enabledMoments(withHome({ location: true }));
    assert(e.includes('leave_home') && e.includes('mosque_enter') && e.includes('morning'));
    assert(!e.includes('vehicle'));
    assert(enabledMoments(withHome({ vehicle: true })).includes('vehicle'));
});
test('Timed reminder ids are stable, distinct per moment and day, and inside the reserved range', () => {
    assert.equal(timedId('morning', '2026-10-22'), 1261022); assert.equal(timedId('sleep', '2026-12-31'), 3261231);
    const r = timedReminders(withHome({ timed: true, sleepTime: '22:30' }), copy, NOW);
    assert.equal(new Set(r.map(x => x.id)).size, r.length);
    assert(r.every(x => x.id >= 1000000 && x.id < 4000000 && x.at > NOW && x.url === `ayahflow://moment/${x.moment}`));
    assert.deepEqual([...new Set(r.map(x => x.moment))].sort(), ['evening', 'morning', 'sleep']);
    assert.equal(timedReminders(withHome({ timed: false }), copy, NOW).length, 0);
});
test('A morning already completed today is not scheduled again today', () => {
    let s = withHome({ timed: true });
    for (const e of ADHKAR_ENTRIES.filter(x => x.moments.includes('morning'))) s = completeDhikr(s, e.id, 'morning', NOW, `t-${e.id}`);
    assert(momentDone(s, 'morning', NOW));
    const ids = timedReminders(s, copy, NOW).map(x => x.id);
    assert(!ids.includes(timedId('morning', '2026-10-22'))); assert(ids.includes(timedId('morning', '2026-10-23')));
    assert.equal(nativeConfig(s, copy, NOW).completedDay.morning, '2026-10-22');
});
test('Detections merge without duplicates and stay capped', () => {
    const merged = mergeDetections([{ event: 'EXIT_HOME', at: 1 }], [{ event: 'EXIT_HOME', at: 1 }, { event: 'ENTER_VEHICLE', at: 2 }]);
    assert.deepEqual(merged, [{ event: 'EXIT_HOME', at: 1 }, { event: 'ENTER_VEHICLE', at: 2 }]);
    assert.equal(mergeDetections([], Array.from({ length: 80 }, (_, i) => ({ event: 'ENTER_HOME', at: i }))).length, 50);
});

const label = (p, at) => ({ title: p, body: String(at) });
test('Athan is off by default and needs a saved place', () => {
    assert.equal(initialState().athan.enabled, false);
    assert.equal(athanSchedule(withHome(), label, NOW).length, 0);
    const noPlace = { ...initialState(), athan: { ...initialState().athan, enabled: true } };
    assert.equal(athanSchedule(noPlace, label, NOW).length, 0);
    assert.equal(nextPrayer(noPlace, NOW), null);
});
test('Athan schedule: five prayers a day for a week, in the future, chosen prayers only, stable ids', () => {
    const s = { ...withHome(), athan: { enabled: true, prayers: { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: true }, sound: 'athan' } };
    const a = athanSchedule(s, label, NOW);
    assert(a.length >= 27 && a.length <= 28, a.length);
    assert(a.every(x => x.at > NOW && x.prayer !== 'asr' && x.sound === 'athan'));
    assert.equal(new Set(a.map(x => x.id)).size, a.length);
    assert.equal(athanId('fajr', '2026-10-22'), 4261022); assert.equal(athanId('isha', '2026-10-22'), 8261022);
    assert(a.every(x => x.id >= 4000000 && x.id < 9000000)); // never collides with adhkar reminder ids (1-3 million)
    const timed = timedReminders({ ...s, smart: { ...s.smart, timed: true, sleepTime: '22:00' } }, copy, NOW);
    assert(a.length + timed.length <= 64, 'iOS keeps at most 64 pending notifications');
});
test('Next prayer is the first one after now, rolling to tomorrow', () => {
    const s = withHome();
    const today = prayersFrom(s, NOW, 1);
    assert.deepEqual(today.map(p => p.prayer), ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
    assert.equal(nextPrayer(s, today[1].at - 1).prayer, 'dhuhr');
    const late = nextPrayer(s, today[4].at + 60000);
    assert.equal(late.prayer, 'fajr'); assert(late.at > today[4].at);
});
test('Widget data carries a week of prayers and windows, without coordinates', () => {
    const w = widgetData(withHome(), k => k, NOW);
    assert.equal(w.prayers.length, 35); assert.equal(w.windows.length, 7);
    assert(!JSON.stringify(w).includes('39.8262') && !JSON.stringify(w).includes('21.4225'));
    assert.equal(widgetData(initialState(), k => k, NOW).prayers.length, 0);
});
