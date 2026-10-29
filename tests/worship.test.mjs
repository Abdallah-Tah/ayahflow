// The saved place is Makkah: run in its time zone so local days and prayer days agree (each test file has its own process).
process.env.TZ = 'Asia/Riyadh';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verse, chapter, translation, SURAH_DATA, RUKU_STARTS } from '../www/js/data.js';
import { LIBRARY, COUNTERS, TASBIH_VARIANTS, counterPosition } from '../www/js/adhkar.js';
import { initialState, validateState, setSalah, salahStatus, setTasbih, tasbihOn, setCount, countOn, lifetimeCount, toggleFavorite, markRecent, setTarget, noteQuranOpen, addCounter, removeCounter, MAX_COUNTS, STATE_VERSION, dayKey } from '../www/js/engine.js';
import { slotOf, slotRange, ayahOfMoment, momentPool, upcomingMoments, MOMENT_MIN_LETTERS, MOMENT_MAX_LETTERS, RECITATIONS, recitation, daySummary, salahStreak, salahWeek, salahInsights, salahReminders, salahReminderId, SALAH_MAX, tasbihDone } from '../www/js/worship.js';
import { widgetData, timesFor } from '../www/js/smart.js';
import { plainKey } from '../scripts/build-adhkar.mjs';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
const DAY = '2026-10-25', NOW = at(25, 14);
const placed = () => { const s = initialState(); s.places.home = { lat: 21.4225, lng: 39.8262, radius: 150 }; s.smart.method = 'UmmAlQura'; return s; };

test('Salah: one tap confirms, the same tap twice changes nothing, and nothing is ever marked missed by the app', () => {
    let s = initialState();
    assert.deepEqual(daySummary(s, DAY), { done: 0, missed: 0, madeUp: 0, open: 5, statuses: { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null } });
    s = setSalah(s, DAY, 'fajr', 'done', at(25, 6));
    assert.equal(salahStatus(s, DAY, 'fajr'), 'done');
    assert.equal(setSalah(s, DAY, 'fajr', 'done', at(25, 7)), s, 'idempotent');
    assert.equal(s.worship.salah[0].at, at(25, 6), 'the confirmation time is stored');
    assert.equal(daySummary(s, DAY).open, 4, 'unconfirmed prayers stay open, not missed');
    assert.equal(daySummary(s, DAY).missed, 0);
});

test('Salah: corrections, missed → made up, and clearing a made-up prayer returns it to missed', () => {
    let s = setSalah(initialState(), DAY, 'asr', 'done', at(25, 16));
    s = setSalah(s, DAY, 'asr', null, at(25, 16, 1));
    assert.equal(salahStatus(s, DAY, 'asr'), null, 'an accidental confirmation can be removed');
    assert.throws(() => setSalah(s, DAY, 'asr', 'madeUp', NOW), /missed/, 'only a missed prayer can be made up');
    s = setSalah(s, '2026-10-24', 'isha', 'missed', at(25, 9));
    s = setSalah(s, '2026-10-24', 'isha', 'madeUp', at(25, 10));
    const r = s.worship.salah.find(x => x.prayer === 'isha');
    assert.equal(r.status, 'madeUp'); assert.equal(r.at, at(25, 9)); assert.equal(r.madeUpAt, at(25, 10));
    s = setSalah(s, '2026-10-24', 'isha', null, at(25, 11));
    assert.equal(salahStatus(s, '2026-10-24', 'isha'), 'missed');
    assert.throws(() => setSalah(s, '2026-10-26', 'fajr', 'done', NOW), /Invalid/, 'future days cannot be recorded');
    assert.throws(() => setSalah(s, DAY, 'witr', 'done', NOW), /Invalid/);
});

test('Salah: streak, week and insights count only what the user confirmed', () => {
    let s = initialState();
    for (const d of ['2026-10-23', '2026-10-24']) for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) s = setSalah(s, d, p, 'done', at(24, 23));
    assert.equal(salahStreak(s, NOW), 2, 'today still open: the streak counts up to yesterday');
    s = setSalah(s, '2026-10-23', 'isha', 'missed', at(24, 23));
    assert.equal(salahStreak(s, NOW), 1);
    s = setSalah(s, '2026-10-23', 'isha', 'madeUp', at(24, 23, 30));
    assert.equal(salahStreak(s, NOW), 2, 'a made-up prayer keeps the day whole');
    const week = salahWeek(s, NOW);
    assert.equal(week.length, 7); assert.equal(week.at(-1).day, DAY); assert.equal(week.at(-2).kept, 5);
    const ins = salahInsights(s, NOW);
    assert.equal(ins.confirmed, 10); assert.equal(ins.possible, 150); assert.equal(ins.recordedDays, 2);
});

test('Migration v12 → v13 keeps every saved field and adds empty worship data; bad worship data is rejected', () => {
    const v12 = { ...initialState(), version: 12, xp: 40, bookmarks: ['1:1'], counts: [{ id: 'istighfar', day: DAY, n: 7 }] };
    delete v12.worship;
    const m = validateState(JSON.parse(JSON.stringify(v12)));
    assert.equal(STATE_VERSION, 21); assert.equal(m.version, 21);
    assert.equal(m.xp, 40); assert.deepEqual(m.bookmarks, ['1:1']); assert.equal(countOn(m, 'istighfar', DAY), 7);
    assert.deepEqual(m.worship.salah, []); assert.equal(m.worship.prefs.haptics, true); assert.equal(m.worship.prefs.checkIn, false, 'reminders stay off until chosen');
    const ok = setSalah(m, DAY, 'fajr', 'done', NOW);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(ok))).worship.salah, ok.worship.salah, 'round trip');
    const bad = (f) => { const x = JSON.parse(JSON.stringify(ok)); f(x); assert.throws(() => validateState(x), /worship/); };
    bad(x => { x.worship.salah[0].status = 'late'; });
    bad(x => { x.worship.salah.push({ ...x.worship.salah[0] }); });
    bad(x => { x.worship.favorites = ['not-a-counter']; });
    bad(x => { x.worship.targets = { istighfar: 0 }; });
    bad(x => { x.worship.prefs.checkInAfter = 5; });
});

test('Guided tasbih: saved per day, prayer and variant, never mixed; auto-advance follows the steps', () => {
    let s = setTasbih(initialState(), DAY, 'fajr', 'tasbih-prayer', 34);
    s = setTasbih(s, DAY, 'dhuhr', 'tasbih-prayer', 100);
    s = setTasbih(s, DAY, 'fajr', 'tasbih-prayer-10', 5);
    assert.equal(tasbihOn(s, DAY, 'fajr', 'tasbih-prayer'), 34);
    assert.equal(tasbihOn(s, DAY, 'fajr', 'tasbih-prayer-10'), 5);
    assert.equal(tasbihOn(s, DAY, 'asr', 'tasbih-prayer'), 0);
    assert.equal(tasbihDone(s, DAY, 'dhuhr'), true); assert.equal(tasbihDone(s, DAY, 'fajr'), false);
    const c = COUNTERS.find(x => x.id === 'tasbih-prayer');
    assert.deepEqual(counterPosition(c, 33), { step: 1, inStep: 0, rounds: 0, inRound: 33 }, 'after 33 the next phrase begins');
    assert.deepEqual(counterPosition(c, 99), { step: 3, inStep: 0, rounds: 0, inRound: 99 }, 'the tahlil completes the hundred');
    assert.deepEqual(TASBIH_VARIANTS, ['tasbih-prayer', 'tasbih-prayer-34', 'tasbih-prayer-10']);
    assert.deepEqual(COUNTERS.find(x => x.id === 'tasbih-prayer-34').steps.map(x => x.count), [33, 33, 34]);
    assert.throws(() => setTasbih(s, DAY, 'fajr', 'istighfar', 1), /Invalid/);
});

test('Dhikr counts: daily and lifetime totals are separate, old days fold into the archive, nothing is lost', () => {
    let s = initialState();
    for (let i = 0; i < MAX_COUNTS + 5; i++) { const d = new Date(2010, 0, 1 + i); s = setCount(s, 'four-words', 10, d.getTime()); }
    assert.equal(s.counts.length, MAX_COUNTS);
    assert.equal(s.worship.archive['four-words'], 50);
    assert.equal(lifetimeCount(s, 'four-words'), (MAX_COUNTS + 5) * 10);
    const last = new Date(2010, 0, MAX_COUNTS + 5).getTime();
    assert.equal(countOn(s, 'four-words', dayKey(last)), 10, 'today stays separate from the lifetime total');
});

test('Favourites, recents and personal targets; the user’s own wording is never changed', () => {
    let s = toggleFavorite(initialState(), 'hawqala');
    assert.deepEqual(s.worship.favorites, ['hawqala']);
    s = toggleFavorite(s, 'hawqala'); assert.deepEqual(s.worship.favorites, []);
    s = markRecent(markRecent(s, 'kalimatan'), 'hawqala'); assert.deepEqual(s.worship.recent, ['hawqala', 'kalimatan']);
    s = setTarget(s, 'la-ilaha-illallah', 300); assert.equal(s.worship.targets['la-ilaha-illallah'], 300);
    s = setTarget(s, 'la-ilaha-illallah', null); assert.equal(s.worship.targets['la-ilaha-illallah'], undefined);
    const text = 'يا حيّ يا قيّوم برحمتك أستغيث';
    s = addCounter(s, { id: 'my-abc', title: 'Mine', text, target: 33 });
    assert.equal(s.myCounters[0].text, text);
    assert.throws(() => setTarget(s, 'my-abc', 50), /Invalid/, 'own counters keep their own target field');
    s = removeCounter(toggleFavorite(s, 'my-abc'), 'my-abc');
    assert.deepEqual(s.worship.favorites, [], 'removing a counter removes its favourite');
});

test('Library: every text is a verbatim slice of its cited hadith; sunnah counts are stated in the source', () => {
    const sources = JSON.parse(readFileSync('content/adhkar/sources.json', 'utf8')).hadiths;
    assert.equal(LIBRARY.length, 16);
    for (const l of LIBRARY) {
        const h = sources[l.source.ref].text;
        if (l.wording === 'common') { assert.ok(l.virtue && h.includes(l.virtue), `${l.id} virtue`); continue; }
        assert.ok(h.includes(l.text), `${l.id} text is an exact substring of ${l.source.ref}`);
        if (l.targetKind === 'sunnah') assert.ok(l.evidence.length && l.evidence.every(e => plainKey(h).includes(plainKey(e))), `${l.id} evidence`);
    }
    const common = LIBRARY.filter(l => l.wording === 'common');
    assert.deepEqual(common.map(l => [l.id, l.text]), [['salawat-nabi', 'اللهم صلِّ وسلِّم على نبينا محمد']], 'only the salawat formula is given as common wording');
    const byId = Object.fromEntries(LIBRARY.map(l => [l.id, l]));
    assert.equal(byId['salawat-ibrahimiyya'].source.ref, 'bukhari:3370');
    const ib = plainKey(byId['salawat-ibrahimiyya'].text); // comparison keys only (mark order differs between sources)
    assert.ok(ib.endsWith(plainKey('انك حميد مجيد')) && ib.includes(plainKey('اللهم بارك على محمد')) && ib.split(plainKey('حميد مجيد')).length === 3, 'both halves of the Ibrahimiyya');
    assert.deepEqual([byId['tahlil-100'].targetKind, byId['tahlil-100'].target, byId['subhanallah-wabihamdihi'].targetKind], ['sunnah', 100, 'sunnah']);
    for (const id of ['salawat-nabi', 'la-ilaha-illallah', 'kalimatan', 'four-words', 'hawqala', 'istighfar-tawbah-100']) assert.equal(byId[id].targetKind, 'personal', `${id} has no stated count`);
    assert.equal(byId['four-words'].source.inBook.book, 48); assert.equal(byId['four-words'].source.inBook.hadith, 42); // Muslim 2695
    assert.deepEqual([byId['dua-yunus'].quranRef, byId['hasbunallah'].quranRef, byId['rabbana-atina'].quranRef], ['21:87', '3:173', '2:201']);
    assert.ok(plainKey(verse(21, 87)).includes(plainKey('انت سبحنك')) /* Uthmani spelling: dagger alef */, 'the Quran reference exists');
});

test('Ayah of the Moment: a new ayah each local half hour, stable within it, whole ayahs from the corpus, no repeats', () => {
    assert.equal(slotOf(at(25, 12, 0)), slotOf(at(25, 12, 29)));
    assert.equal(slotOf(at(25, 12, 30)), slotOf(at(25, 12, 29)) + 1);
    assert.equal(slotOf(at(26, 0, 0)), slotOf(at(25, 23, 59)) + 1, 'midnight starts the next slot');
    const [start, end] = slotRange(slotOf(at(25, 12, 40)));
    assert.equal(start, at(25, 12, 30)); assert.equal(end, at(25, 13, 0));
    assert.deepEqual(ayahOfMoment(slotOf(at(25, 12, 1))), ayahOfMoment(slotOf(at(25, 12, 28))));
    const seen = new Set();
    for (let i = 0; i < 517; i++) { const a = ayahOfMoment(1000 + i); seen.add(`${a.surah}:${a.ayah}`); }
    assert.equal(seen.size, 517, 'no ayah repeats until the pool is used up (517 half hours, about ten days)');
    const letters = (s) => s.replace(/[^ء-يٱ]/g, '').length;
    for (const [s, a] of momentPool()) { const n = letters(verse(s, a)); assert.ok(n >= MOMENT_MIN_LETTERS && n <= MOMENT_MAX_LETTERS); }
    assert.equal(momentPool().length, 517);
    const starts = new Set(RUKU_STARTS.map(([s, a]) => `${s}:${a}`));
    assert.equal(RUKU_STARTS.length, 556);
    for (const [s, a] of momentPool()) assert.ok(starts.has(`${s}:${a}`), 'every ayah of the moment opens a ruku\' section');
    assert.ok(starts.has('2:1') && starts.has('2:8') && starts.has('114:1'));
    const next = upcomingMoments(at(25, 12, 10), 48);
    assert.equal(next.length, 48); assert.equal(next[0].at, at(25, 12, 0)); assert.equal(next[1].at, at(25, 12, 30));
    for (const m of next) assert.equal(m.text, verse(m.surah, m.ayah), 'widget text is the corpus string');
});

test('Short recitations: complete passages that exist, with the corpus text, ending where the sentence ends', () => {
    const ids = RECITATIONS.map(r => r.id);
    for (const want of [[67, 1, 5], [55, 1, 13], [23, 1, 11], [59, 21, 24], [76, 1, 6]]) assert.ok(RECITATIONS.some(r => r.surah === want[0] && r.from === want[1] && r.to === want[2]), want.join(':'));
    assert.equal(new Set(ids).size, ids.length);
    for (const r of RECITATIONS) {
        assert.ok(r.from >= 1 && r.to <= chapter(r.surah).count && r.from <= r.to);
        assert.deepEqual(recitation(r.id).ayahs.map(a => a.text), Array.from({ length: r.to - r.from + 1 }, (_, i) => verse(r.surah, r.from + i)));
    }
    assert.ok(plainKey(verse(23, 6)).startsWith(plainKey('الا على')), '23:6 continues 23:5, so the passage runs to 23:11');
});

test('Check-in reminders: once per unconfirmed prayer, after its time, never for confirmed ones, within the budget', () => {
    const copy = (p, kind) => ({ title: `${kind} ${p}`, body: '' });
    let s = placed();
    assert.deepEqual(salahReminders(s, copy, NOW), [], 'off by default');
    s.worship.prefs.checkIn = true;
    const fajr = timesFor(s, new Date(NOW)).fajr;
    const list = salahReminders(s, copy, fajr - 60000);
    assert.ok(list.length > 0 && list.length <= SALAH_MAX);
    assert.ok(list.every(r => r.kind === 'checkIn' && r.id >= 13000000 && r.id < 18000000));
    assert.equal(new Set(list.map(r => r.id)).size, list.length);
    assert.equal(list[0].id, salahReminderId('fajr', dayKey(fajr)));
    assert.ok(list[0].at > fajr && list.every((r, i) => !i || r.at >= list[i - 1].at));
    const fday = dayKey(fajr);
    s = setSalah(s, fday, 'fajr', 'done', fajr + 60000);
    assert.ok(!salahReminders(s, copy, fajr + 61000).some(r => r.id === salahReminderId('fajr', fday)), 'no check-in after confirming');
    s.worship.prefs.tasbihNudge = true;
    const nudge = salahReminders(s, copy, fajr + 61000).find(r => r.id === salahReminderId('fajr', fday));
    assert.equal(nudge?.kind, 'tasbih'); assert.equal(nudge.url, 'ayahflow://tasbih/fajr');
    assert.deepEqual(salahReminders(initialState(), copy, NOW), [], 'no place, no times, no reminders');
});

test('Translation: Pickthall for all 6236 ayahs, verbatim from the pinned Tanzil file', () => {
    assert.equal(SURAH_DATA.reduce((n, s) => n + s.count, 0), 6236);
    assert.equal(translation(1, 2), 'Praise be to Allah, Lord of the Worlds,');
    assert.equal(translation(114, 6), readFileSync('content/translations/en.pickthall.txt', 'utf8').split('\n').find(l => l.startsWith('114|6|')).slice(6));
    assert.throws(() => translation(1, 8));
});

test('Quran activity: a surah opened counts once per day', () => {
    let s = noteQuranOpen(initialState(), 67, NOW);
    assert.equal(noteQuranOpen(s, 67, NOW + 1000), s);
    s = noteQuranOpen(s, 55, NOW);
    assert.deepEqual(s.worship.quran[DAY], [67, 55]);
});

test('Widget data carries confirmed prayers and the next ayahs of the moment', () => {
    const s = setSalah(placed(), DAY, 'fajr', 'done', NOW);
    const w = widgetData(s, k => k, NOW, {}, null, { salah: [{ day: DAY, kept: ['fajr'] }], moments: upcomingMoments(NOW, 4) });
    assert.deepEqual(w.worship.salah, [{ day: DAY, kept: ['fajr'] }]);
    assert.equal(w.worship.moments.length, 4);
    assert.equal(w.labels.momentTab, 'ayahMoment');
});

test('UI: five tabs, Tajweed kept outside the main navigation with its draft label', () => {
    const app = readFileSync('src/app.ts', 'utf8');
    assert.ok(app.includes("[['today', 'home', 'home'], ['adhkar', 'tasbih', 'adhkar'], ['quran', 'book', 'quran'], ['prayer', 'mosque', 'prayers'], ['progress', 'chart', 'progress']]"));
    assert.ok(app.includes("data-view=\"tajweed\"") && app.includes("t('tajweedDraftShort')"));
    assert.ok(!app.includes("t('heroLine')"), 'the oversized home heading is gone');
});
