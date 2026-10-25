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
    assert.equal(STATE_VERSION, 13);
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
import { nativeConfig, timedReminders, timedId, enabledMoments, mergeDetections, momentPreview, momentDone, athanSchedule, athanId, nextPrayer, prayerDayView, prayersFrom, widgetData } from '../www/js/smart.js';
const copy = m => ({ title: m, body: momentPreview(m) ?? 'general' });
const NOW = new Date(2026, 9, 22, 5, 0).getTime();
const withHome = (smart = {}) => ({ ...initialState(), places: { home: { lat: 21.4225, lng: 39.8262, radius: 150 }, work: null, mosque: null }, smart: { ...initialState().smart, ...smart } });
test('Native config carries regions, rules, a week of windows and verbatim previews, but nothing is enabled by default', () => {
    const c = nativeConfig(withHome(), copy, NOW);
    assert.deepEqual(c.regions, [{ id: 'home', lat: 21.4225, lng: 39.8262, radius: 150 }]);
    assert.equal(c.windows.length, 8); assert(c.windows.every(w => w.morning && w.morning[0] < w.morning[1]));
    assert.equal(c.location, false); assert.equal(c.vehicle, false);
    assert(!c.enabled.includes('leave_home') && !c.enabled.includes('vehicle') && !c.enabled.includes('morning'));
    assert.equal(c.copy.leave_home.body, `${ADHKAR_ENTRIES.find(e => e.id === 'leave-home').text}\nSunan Abi Dawud 5095`);
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
test('Athan schedule: five prayers a day for the planned days, in the future, chosen prayers only, stable ids', () => {
    const s = { ...withHome(), athan: { ...initialState().athan, enabled: true, prayers: { fajr: true, dhuhr: true, asr: false, maghrib: true, isha: true }, fajrReciter: 'madinah' } };
    const a = athanSchedule(s, label, NOW);
    assert(a.length >= 15 && a.length <= 16, a.length); // 4 planned days, Asr off
    assert(a.every(x => x.at > NOW && x.prayer !== 'asr'));
    assert(a.every(x => x.reciter === (x.prayer === 'fajr' ? 'madinah' : 'beautiful')));
    assert(athanSchedule({ ...s, athan: { ...s.athan, sound: 'chime' } }, label, NOW).every(x => x.reciter === null));
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
test('Today card: the big time and the timeline come from the same day (tomorrow after Isha)', () => {
    const s = withHome();
    const today = prayersFrom(s, NOW, 1);
    const day = prayerDayView(s, today[1].at - 1);
    assert.equal(day.tomorrow, false); assert.equal(day.next.at, day.times.dhuhr);
    const late = prayerDayView(s, today[4].at + 60000);
    assert.equal(late.tomorrow, true); assert.equal(late.next.prayer, 'fajr');
    assert.equal(late.next.at, late.times.fajr, 'big time must equal the timeline Fajr');
    assert.notEqual(late.times.fajr, today[0].at); // tomorrow's schedule, not today's
    assert(Object.values(late.times).every(at => at > today[4].at));
    assert.equal(prayerDayView(initialState(), NOW), null);
});
test('Widget data carries a week of prayers and windows, without coordinates', () => {
    const w = widgetData(withHome(), k => k, NOW);
    assert.equal(w.prayers.length, 35); assert.equal(w.windows.length, 7);
    assert(!JSON.stringify(w).includes('39.8262') && !JSON.stringify(w).includes('21.4225'));
    assert.equal(widgetData(initialState(), k => k, NOW).prayers.length, 0);
});

test('v7 reciters: bundled ids or a custom file; exports drop the custom file and fall back to a bundled reciter', () => {
    assert.equal(STATE_VERSION, 13);
    const base = initialState();
    assert.equal(base.athan.reciter, 'beautiful'); assert.equal(base.athan.custom, null);
    assert.throws(() => validateState({ ...base, athan: { ...base.athan, reciter: 'unknown' } }), /reciter/);
    assert.throws(() => validateState({ ...base, athan: { ...base.athan, reciter: 'custom' } }), /reciter/); // custom needs a file
    const withCustom = { ...base, athan: { ...base.athan, reciter: 'custom', custom: { name: 'My athan.mp3', ext: 'mp3', version: 3 } } };
    assert.equal(validateState(JSON.parse(JSON.stringify(withCustom))).athan.custom.version, 3);
    const out = exportable(withCustom);
    assert.equal(out.athan.custom, null); assert.equal(out.athan.reciter, 'beautiful');
    assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(out))));
});

test('v8 online athans: chosen only once downloaded; the Fajr athan only for Fajr; exports drop device files', async () => {
    const { ONLINE_RECORDINGS } = await import('../www/js/athan.js');
    assert(ONLINE_RECORDINGS.length >= 6);
    for (const r of ONLINE_RECORDINGS) { assert.match(r.url, /^https:\/\/cdn\.aladhan\.com\/audio\/adhans\/[a-z0-9-]+\.mp3$/); assert.match(r.sha256, /^[0-9a-f]{64}$/); assert(r.bytes > 0 && r.bytes < 12000000); }
    const base = initialState();
    assert.deepEqual(base.athan.downloads, []);
    assert.throws(() => validateState({ ...base, athan: { ...base.athan, reciter: 'online-alafasy-dubai' } }), /downloads/);
    const ok = { ...base, athan: { ...base.athan, downloads: ['alafasy-dubai', 'nafees-fajr'], reciter: 'online-alafasy-dubai', fajrReciter: 'online-nafees-fajr' } };
    assert.equal(validateState(JSON.parse(JSON.stringify(ok))).athan.reciter, 'online-alafasy-dubai');
    assert.throws(() => validateState({ ...ok, athan: { ...ok.athan, reciter: 'online-nafees-fajr' } }), /downloads/);
    assert.throws(() => validateState({ ...ok, athan: { ...ok.athan, downloads: ['made-up'] } }), /downloads/);
    const out = exportable(ok);
    assert.deepEqual(out.athan.downloads, []); assert.equal(out.athan.reciter, 'beautiful'); assert.equal(out.athan.fajrReciter, 'beautiful');
    assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(out))));
    const v7 = JSON.parse(JSON.stringify(base)); v7.version = 7; delete v7.athan.downloads;
    assert.deepEqual(validateState(v7).athan.downloads, []);
});
test('Bundled athan alerts are 44.1 kHz 16-bit PCM CAF files, 28 s, so iOS can play them', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const files = readdirSync(new URL('../public/sounds/', import.meta.url)).filter(f => f.endsWith('-alert.caf'));
    assert.equal(files.length, 5);
    for (const f of files) {
        const b = readFileSync(new URL('../public/sounds/' + f, import.meta.url));
        assert.equal(b.toString('ascii', 0, 4), 'caff', f);
        const desc = b.indexOf('desc');
        assert.equal(b.readDoubleBE(desc + 12), 44100, f);
        assert.equal(b.toString('ascii', desc + 20, desc + 24), 'lpcm', f);
        const data = b.indexOf('data'), seconds = (Number(b.readBigInt64BE(data + 4)) - 4) / 2 / 44100;
        assert(Math.abs(seconds - 28) < 0.1, `${f}: ${seconds}s`);
    }
});

test('Detections keep a short reason from the phone (no coordinates) and validate it', () => {
    const merged = mergeDetections([], [{ event: 'WAKE', at: 5, detail: '54 km/h · automotive motion' }, { event: 'TRIP_END', at: 6, detail: 'x'.repeat(400) }]);
    assert.equal(merged[0].detail, '54 km/h · automotive motion'); assert.equal(merged[1].detail.length, 160);
    const s = { ...initialState(), detections: merged };
    assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
    assert.throws(() => validateState({ ...s, detections: [{ event: 'WAKE', at: 1, detail: 7 }] }), /detections/);
});

test('Counter phrases are verbatim slices; their counts are stated in the cited narration', async () => {
    const { COUNTERS, counterPosition } = await import('../www/js/adhkar.js');
    assert.deepEqual(COUNTERS.map(c => [c.id, c.total]), [['istighfar', 100], ['istighfar-tawbah', 70], ['tasbih-prayer', 100], ['tasbih-prayer-34', 100], ['tasbih-prayer-10', 30]]);
    for (const c of COUNTERS) {
        for (const s of c.steps) assert(sources[s.source.ref].text.includes(s.text), `${c.id}: "${s.text}" not verbatim in ${s.source.ref}`);
        for (const ev of c.evidence) assert(key(sources[c.source.ref].text).includes(key(ev)), `${c.id}: count evidence missing`);
        assert.match(sourceUrl(c.source), /^https:\/\/sunnah\.com\/[a-z]+\/\d+\/\d+$/);
    }
    assert.equal(COUNTERS.find(c => c.id === 'istighfar-tawbah').atLeast, true); // "more than seventy"
    const tasbih = COUNTERS.find(c => c.id === 'tasbih-prayer');
    assert.deepEqual(tasbih.steps.map(s => s.count), [33, 33, 33, 1]);
    assert.deepEqual(counterPosition(tasbih, 0), { step: 0, inStep: 0, rounds: 0, inRound: 0 });
    assert.deepEqual(counterPosition(tasbih, 33), { step: 1, inStep: 0, rounds: 0, inRound: 33 });
    assert.deepEqual(counterPosition(tasbih, 99), { step: 3, inStep: 0, rounds: 0, inRound: 99 });
    assert.deepEqual(counterPosition(tasbih, 100), { step: 0, inStep: 0, rounds: 1, inRound: 0 });
    assert.deepEqual(counterPosition(COUNTERS[0], 137), { step: 0, inStep: 37, rounds: 1, inRound: 37 });
});
test('v9 counts are set (not added) per counter and day, validated, migrated and exported; steps are never stored', async () => {
    const { setCount, countOn, defaultHealth } = await import('../www/js/engine.js');
    let s = initialState();
    assert.deepEqual(s.counts, []); assert.deepEqual(s.health, { steps: false, stepGoal: 8000 });
    s = setCount(s, 'istighfar', 40, at(9));
    assert.strictEqual(setCount(s, 'istighfar', 40, at(10)), s); // saving the same tap twice changes nothing
    s = setCount(s, 'istighfar', 41, at(10));
    assert.equal(s.counts.length, 1); assert.equal(countOn(s, 'istighfar', DAY), 41);
    s = setCount(s, 'istighfar', 5, at(9) + 86400000);
    assert.equal(countOn(s, 'istighfar', DAY), 41); assert.equal(s.counts.length, 2);
    assert.throws(() => setCount(s, 'made-up', 1, at(9)), /count/);
    assert.throws(() => setCount(s, 'istighfar', -1, at(9)), /count/);
    assert.throws(() => setCount(s, 'istighfar', 1.5, at(9)), /count/);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).counts, s.counts);
    assert.throws(() => validateState({ ...s, counts: [...s.counts, { ...s.counts[0] }] }), /counts/); // duplicate day
    assert.throws(() => validateState({ ...s, counts: [{ id: 'istighfar', day: 'today', n: 1 }] }), /counts/);
    assert.throws(() => validateState({ ...s, health: { steps: true, stepGoal: 10 } }), /step/);
    assert.throws(() => validateState({ ...s, health: { steps: 'yes', stepGoal: 8000 } }), /step/);
    assert.equal(Object.keys(s.health).join(), 'steps,stepGoal'); // a setting and a goal, no step data
    const v8 = JSON.parse(JSON.stringify(initialState())); v8.version = 8; delete v8.counts; delete v8.health;
    v8.xp = 30;
    const m = validateState(v8);
    assert.equal(m.version, 13); assert.deepEqual(m.counts, []); assert.deepEqual(m.health, defaultHealth()); assert.equal(m.xp, 30);
    assert.deepEqual(exportable(s).counts, s.counts);
});

test('Reminder notifications carry the dhikr text itself, verbatim, with its count and source', () => {
    for (const m of MOMENTS) {
        const body = momentPreview(m);
        if (GENERAL_MOMENTS.includes(m)) { assert.equal(body, null); continue; }
        const e = entriesFor(m)[0], [text, meta] = body.split('\n');
        if (e.text) assert(e.text.startsWith(text.replace(/ …$/, '')), m);
        else assert(text.startsWith(verse(e.quran[0].surah, e.quran[0].from)), m);
        assert(text.length <= 602, m);
        assert.match(meta, e.text ? new RegExp(`${e.source.number}$`) : /^(×\d+ · )?Quran \d+:\d+/);
        if (e.repeat > 1) assert(meta.startsWith(`×${e.repeat} · `), m);
    }
    assert.equal(momentPreview('leave_home').split('\n')[1], 'Sunan Abi Dawud 5095');
});

test('v10 own counters: added once, counted like built-ins, removed with their counts, validated and migrated', async () => {
    const { addCounter, removeCounter, setCount, countOn } = await import('../www/js/engine.js');
    const mine = { id: 'my-abc1', title: 'Evening istighfar', text: '  أستغفر الله العظيم  ', target: 300 };
    let s = addCounter(initialState(), mine);
    assert.deepEqual(s.myCounters, [{ ...mine, text: 'أستغفر الله العظيم' }]); // stored as typed, only trimmed
    assert.strictEqual(addCounter(s, mine), s); // saving the form twice adds it once
    s = setCount(s, 'my-abc1', 12, at(9));
    assert.equal(countOn(s, 'my-abc1', DAY), 12);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).myCounters, s.myCounters);
    assert.throws(() => addCounter(s, { ...mine, id: 'my-x2', text: '   ' }), /counter/);
    assert.throws(() => addCounter(s, { ...mine, id: 'my-x3', target: 0 }), /counter/);
    assert.throws(() => addCounter(s, { ...mine, id: 'Bad Id' }), /counter/);
    assert.throws(() => validateState({ ...s, myCounters: [...s.myCounters, s.myCounters[0]] }), /custom/);
    assert.throws(() => validateState({ ...s, counts: [{ id: 'my-gone', day: DAY, n: 1 }] }), /counts/); // counts need a known counter
    const removed = removeCounter(s, 'my-abc1');
    assert.deepEqual(removed.myCounters, []); assert.deepEqual(removed.counts, []);
    assert.strictEqual(removeCounter(removed, 'istighfar'), removed); // built-ins cannot be removed
    assert.deepEqual(exportable(s).myCounters, s.myCounters);
    const v9 = JSON.parse(JSON.stringify(initialState())); v9.version = 9; delete v9.myCounters;
    assert.deepEqual(validateState(v9).myCounters, []);
});

test('Istighfar reminders: off by default; 3 a day for today and tomorrow; none after sleep or once today’s target is met', async () => {
    const { istighfarReminders, istighfarId } = await import('../www/js/smart.js');
    const copy = n => ({ title: 'Istighfar', body: n === null ? 'goal' : `${n} of 100` });
    const morning = new Date(2026, 9, 22, 8, 0).getTime();
    assert.deepEqual(istighfarReminders(initialState(), 0, 100, copy, morning), []); // nothing until switched on
    const on = { ...initialState(), istighfarReminder: true };
    const r = istighfarReminders(on, 40, 100, copy, morning);
    assert.equal(r.length, 6); // no saved place: 11:00, 14:30, 19:30 today and tomorrow
    assert.deepEqual(r.slice(0, 3).map(x => new Date(x.at).getHours()), [11, 14, 19]);
    assert.equal(r[0].body, '40 of 100'); assert.equal(r[3].body, 'goal');
    assert.equal(r[0].url, 'ayahflow://counter/istighfar');
    assert.equal(r[0].id, istighfarId('lateMorning', '2026-10-22')); assert(r.every(x => x.id >= 9000000 && x.id < 12000000));
    assert.equal(new Set(r.map(x => x.id)).size, 6);
    assert.equal(istighfarReminders(on, 100, 100, copy, morning).length, 3); // target met: only tomorrow's
    assert.equal(istighfarReminders(on, 0, 100, copy, new Date(2026, 9, 22, 15, 0).getTime()).length, 4); // past slots skipped
    assert.equal(istighfarReminders({ ...on, smart: { ...on.smart, sleepTime: '19:00' } }, 0, 100, copy, morning).length, 4); // none after sleep
    const v10 = JSON.parse(JSON.stringify(initialState())); v10.version = 10; delete v10.istighfarReminder;
    assert.equal(validateState(v10).istighfarReminder, false);
    assert.throws(() => validateState({ ...on, istighfarReminder: 'yes' }), /istighfar/);
});

test('Rotation phrases are verbatim slices of their cited narrations, including the tahlil of Tirmidhi 3430', async () => {
    const { ROTATION, ROTATION_GROUPS } = await import('../www/js/adhkar.js');
    assert.equal(ROTATION.length, 12);
    for (const r of ROTATION) { assert(sources[r.source.ref].text.includes(r.text), `${r.id} not verbatim in ${r.source.ref}`); assert.match(sourceUrl(r.source), /^https:\/\/sunnah\.com\//); }
    assert.deepEqual(ROTATION.filter(r => r.source.ref === 'tirmidhi:3430').map(r => key(r.text)), ['لا اله الا الله والله اكبر', 'لا اله الا الله وحده', 'لا اله الا الله وحده لا شريك له', 'لا اله الا الله له الملك وله الحمد', 'لا اله الا الله ولا حول ولا قوة الا بالله']);
    assert.deepEqual(ROTATION_GROUPS.flatMap(g => g.ids).sort(), ROTATION.map(r => r.id).sort()); // every phrase is shown once
});
test('Rotation reminders: off by default, inside waking hours, in turn, capped so all reminders fit iOS’s 64', async () => {
    const { rotationReminders, ROTATION_MAX, PLAN_DAYS, SALAH_MAX, istighfarReminders } = await import('../www/js/smart.js');
    const { ROTATION } = await import('../www/js/adhkar.js');
    const phrases = ROTATION.slice(0, 3).map(r => ({ id: r.id, text: r.text, note: 'src' }));
    const at8 = new Date(2026, 9, 22, 7, 0).getTime();
    assert.equal(initialState().rotation.enabled, false);
    assert.deepEqual(rotationReminders(initialState(), phrases, 'Dhikr', at8), []);
    const on = { ...initialState(), rotation: { ...initialState().rotation, enabled: true, every: 120, from: '08:00', to: '20:00' } };
    const r = rotationReminders(on, phrases, 'Dhikr', at8);
    assert.equal(r.length, 14); // 08:00–20:00 every 2 h = 7 a day, today and tomorrow
    assert.deepEqual(r.slice(0, 7).map(x => new Date(x.at).getHours()), [8, 10, 12, 14, 16, 18, 20]);
    assert.deepEqual(r.slice(0, 4).map(x => x.phrase), [phrases[0].id, phrases[1].id, phrases[2].id, phrases[0].id]);
    assert.equal(r[0].body, `${phrases[0].text}\nsrc`); assert.equal(r[0].url, 'ayahflow://rotation');
    assert(r.every(x => x.id >= 12000000 && x.id < 13000000)); assert.equal(new Set(r.map(x => x.id)).size, r.length);
    // Re-planning later keeps each slot's phrase.
    const later = rotationReminders(on, phrases, 'Dhikr', new Date(2026, 9, 22, 11, 0).getTime());
    assert.equal(later.find(x => new Date(x.at).getHours() === 12).phrase, r.find(x => new Date(x.at).getHours() === 12).phrase);
    const busy = rotationReminders({ ...on, rotation: { ...on.rotation, every: 30, from: '06:00', to: '23:30' } }, phrases, 'Dhikr', at8);
    assert.equal(busy.length, ROTATION_MAX);
    assert.equal(PLAN_DAYS * 5 + PLAN_DAYS * 3 + 6 + SALAH_MAX + ROTATION_MAX, 64); // athan + adhkar + istighfar + prayer check-ins + rotation
    assert.throws(() => validateState({ ...on, rotation: { ...on.rotation, every: 5 } }), /rotation/);
    assert.throws(() => validateState({ ...on, rotation: { ...on.rotation, from: '21:00', to: '08:00' } }), /rotation/);
    assert.throws(() => validateState({ ...on, rotation: { ...on.rotation, phrases: ['made-up'] } }), /rotation/);
    const v11 = JSON.parse(JSON.stringify(initialState())); v11.version = 11; delete v11.rotation;
    assert.deepEqual(validateState(v11).rotation.phrases, ROTATION.map(x => x.id));
    void istighfarReminders;
});
test('Removing an own counter also removes it from the rotation', async () => {
    const { addCounter, removeCounter } = await import('../www/js/engine.js');
    let s = addCounter(initialState(), { id: 'my-z1', title: '', text: 'x', target: 10 });
    s = { ...s, rotation: { ...s.rotation, phrases: [...s.rotation.phrases, 'my-z1'] } };
    assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(s))));
    assert(!removeCounter(s, 'my-z1').rotation.phrases.includes('my-z1'));
});

test('Method suggestion follows the saved place, offline, and is only a hint', async () => {
    const { suggestedMethod, timesFor } = await import('../www/js/smart.js');
    const at = (lat, lng) => suggestedMethod({ lat, lng })?.method ?? null;
    assert.equal(at(43.91, -69.96), 'NorthAmerica'); // Brunswick, Maine
    assert.equal(at(45.42, -75.69), 'NorthAmerica'); // Ottawa
    assert.equal(at(21.42, 39.83), 'UmmAlQura'); // Makkah
    assert.equal(at(25.2, 55.27), 'Dubai'); assert.equal(at(25.29, 51.53), 'Qatar'); assert.equal(at(29.37, 47.98), 'Kuwait');
    assert.equal(at(30.04, 31.24), 'Egyptian'); assert.equal(at(41.01, 28.98), 'Turkey'); assert.equal(at(35.69, 51.39), 'Tehran');
    assert.equal(at(24.86, 67.0), 'Karachi'); assert.equal(at(1.29, 103.85), 'Singapore'); assert.equal(at(51.51, -0.13), 'MuslimWorldLeague');
    assert.equal(at(-33.87, 151.21), null); assert.equal(suggestedMethod(null), null); // no guess where there is no common choice
    // The reported screen: Umm al-Qura + Hanafi in Maine gives Fajr 5:25, Asr 3:58, Isha = Maghrib + 90 min.
    const s = { ...initialState(), places: { home: { lat: 43.9145, lng: -69.9653, radius: 150 }, work: null, mosque: null } };
    const day = new Date(2026, 9, 23, 12);
    const uq = timesFor({ ...s, smart: { ...s.smart, method: 'UmmAlQura', hanafi: true } }, day), na = timesFor({ ...s, smart: { ...s.smart, method: 'NorthAmerica', hanafi: false } }, day);
    assert.equal(Math.round((uq.isha - uq.maghrib) / 60000), 90);
    assert(na.fajr - uq.fajr > 15 * 60000); assert(uq.asr - na.asr > 35 * 60000);
});

test('Du’a of the day: real references that address رَبَّنَا / رَبِّ, verbatim text, the same for a given day', async () => {
    const { QURANIC_DUAS } = await import('../www/js/duas.js');
    const { ayahOfDay, dailyAyahs, ayahRef, widgetData } = await import('../www/js/smart.js');
    for (const [s, from, to] of QURANIC_DUAS) {
        assert(to >= from && to - from <= 3, `${s}:${from}`);
        const k = Array.from({ length: to - from + 1 }, (_, i) => key(verse(s, from + i))).join(' ');
        assert(/ربنا|(^|\s)رب\s/.test(k), `${s}:${from} does not address ربنا / رب`);
    }
    assert.equal(new Set(QURANIC_DUAS.map(d => d.join(':'))).size, QURANIC_DUAS.length);
    assert.deepEqual(ayahOfDay('2026-10-23'), ayahOfDay('2026-10-23'));
    const week = dailyAyahs(new Date(2026, 9, 23).getTime(), 14);
    assert.equal(week.length, 14); assert.equal(week[0].day, '2026-10-23');
    assert(new Set(week.map(w => w.ref)).size > 5); // it changes from day to day
    for (const w of week) assert.equal(w.text, Array.from({ length: w.to - w.ayah + 1 }, (_, i) => verse(w.surah, w.ayah + i)).join(' '));
    assert.equal(ayahRef({ surah: 20, ayah: 25, to: 28 }), '20:25–28'); assert.equal(ayahRef({ surah: 2, ayah: 201, to: 201 }), '2:201');
    assert.equal(widgetData(initialState(), k2 => k2, Date.now()).ayahs.length, 14); // shown even without a saved place
    // Lock Screen: the whole du'a must fit, so long ones are never picked (and never cut).
    const { DUA_MAX_LETTERS } = await import('../www/js/smart.js');
    const year = dailyAyahs(new Date(2026, 0, 1).getTime(), 366);
    for (const w of year) assert(w.text.replace(/[^\u0621-\u064A\u0671]/g, '').length <= DUA_MAX_LETTERS, w.ref);
    assert(!year.some(w => w.ref === '2:286')); assert(new Set(year.map(w => w.ref)).size > 40);
});
