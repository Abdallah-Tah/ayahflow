import test from 'node:test';
import assert from 'node:assert/strict';
import { SURAH_DATA, LESSONS, chapter, verse, audioUrl, AYAH_TOTAL, QURAN_SOURCE, juzOf } from '../www/js/data.js';
import { STATE_VERSION, recitedWordIndices, locateGuess, identicalAyahs, ayahWords, surahRecallQueue, sessionRecap, initialState, dayKey, calendarDistance, streak, rng, shuffle, comparable, keyFor, eligible, allItems, planSession, questionFor, applyAnswer, retention, dueItems, weakItems, completedAccuracy, validateState } from '../www/js/engine.js';
import { allTranslationKeys, tr } from '../www/js/i18n.js';
const START = new Date(2026, 8, 28, 12).getTime();
const item = (mode = 'next', surah = 112, ayah = 1) => ({ key: keyFor(mode, surah, ayah), mode, surah, ayah, reason: 'new' });
const advance = (state, c, ok, days, id) => applyAnswer(state, c, ok, START + days * 86400000, id);
test('Full Tanzil corpus: 114 complete chapters, 6236 nonempty ayahs, basmala kept separate', () => {
    assert.equal(SURAH_DATA.length, 114);
    assert.equal(SURAH_DATA.reduce((n, s) => n + s.count, 0), 6236);
    assert.equal(AYAH_TOTAL, 6236);
    assert.match(QURAN_SOURCE.name, /Tanzil Quran Text \(Uthmani, Version 1\.1\)/);
    SURAH_DATA.forEach((s, i) => {
        assert.equal(s.id, i + 1);
        assert.equal(s.count, s.verses.length);
        assert(s.verses.every(v => typeof v === 'string' && v.trim().length > 0 && v === v.trim()));
        assert.equal(new URL(s.source).hostname, 'tanzil.net');
    });
    assert.equal(chapter(1).bismillah, null); assert.equal(chapter(9).bismillah, null);
    assert(SURAH_DATA.filter(s => s.bismillah).length === 112);
    assert(!verse(114, 1).includes(chapter(114).bismillah)); // never merged into ayah 1
    assert.equal(verse(1, 1), chapter(2).bismillah); // Al-Fatihah's first ayah is the basmala itself
    assert.deepEqual([chapter(2).count, chapter(2).juz, chapter(78).juz, juzOf(2, 142), juzOf(2, 141)], [286, 1, 30, 2, 1]);
});
test('Chapter and verse access reject nonexistent content', () => { assert.throws(() => chapter(0)); assert.throws(() => chapter(115)); assert.throws(() => chapter(1.5)); assert.throws(() => verse(112, 0)); assert.throws(() => verse(112, 5)); assert.throws(() => verse(112, 1.5)); assert.throws(() => verse(2, 287)); });
test('Audio URLs preserve correct global ayah numbering', () => { assert.match(audioUrl(1, 1), /\/1\.mp3$/); assert.match(audioUrl(103, 1), /\/6177\.mp3$/); assert.match(audioUrl(108, 1), /\/6205\.mp3$/); assert.match(audioUrl(112, 4), /\/6225\.mp3$/); assert.match(audioUrl(114, 6), /\/6236\.mp3$/); assert.throws(() => audioUrl(112, 5)); });
test('Every Tajweed example refers to the displayed Quran text, and remains a draft', () => { assert.equal(LESSONS.length, 4); for (const l of LESSONS) {
    assert(verse(l.surah, l.ayah).includes(l.highlight), l.id);
    assert.equal(l.reviewStatus, 'editorial-draft');
    for (const lang of ['en', 'fr', 'ar']) {
        assert(l.description[lang].length > 20);
        assert(l.choices[lang][l.answer]);
    }
} });
test('Fresh progress is genuinely zero, and online recitation requires consent', () => { const s = initialState(); assert.equal(s.xp, 0); assert.equal(s.completedSessions, 0); assert.equal(s.recallSelfChecks, 0); assert.deepEqual(s.cards, {}); assert.deepEqual(s.attempts, []); assert.equal(completedAccuracy(s), null); assert.equal(s.audioConsent, false); });
test('No next question crosses the end of a surah; no previous crosses the start', () => { for (const s of SURAH_DATA) {
    assert.equal(eligible('next', s.id, s.count), false);
    assert.equal(eligible('previous', s.id, 1), false);
    assert.equal(allItems('next', [s.id]).length, s.count - 1);
    assert.equal(allItems('previous', [s.id]).length, s.count - 1);
    assert.equal(eligible('next', s.id, 1.5), false);
} });
test('All generated quiz options are canonical, unique, and have exactly one correct ID', () => { const modes = ['next', 'previous', 'listen', 'recall']; for (const mode of modes)
    for (const i of allItems(mode, SURAH_DATA.map(s => s.id)))
        for (let seed = 0; seed < 12; seed++) {
            const q = questionFor(i, seed);
            assert.equal(q.options.length, 4);
            assert.equal(q.options.filter(x => x.id === q.correctId).length, 1);
            assert.equal(new Set(q.options.map(o => comparable(o.text))).size, 4);
            assert.equal(q.answerText, verse(i.surah, q.answerAyah));
            for (const o of q.options) {
                if (mode === 'listen')
                    assert.equal(o.text, chapter(Number(o.id)).name);
                else {
                    const [s, a] = o.id.split(':').map(Number);
                    assert.equal(o.text, verse(s, a));
                }
            }
        } });
test('Repeated Al-Kafirun text is not presented as two different answer options', () => { assert.equal(comparable(verse(109, 3)), comparable(verse(109, 5))); for (let seed = 0; seed < 100; seed++) {
    const q = questionFor(item('next', 109, 2), seed);
    assert.equal(q.options.filter(x => comparable(x.text) === comparable(q.answerText)).length, 1);
} });
test('Comparison normalization never changes displayed source content', () => { const text = verse(112, 1); assert.notEqual(comparable(text), text); const q = questionFor(item(), 99); assert.equal(q.text, text); assert.equal(verse(112, 1), text); });
test('Same seed yields the same option ordering and daily plan', () => { assert.deepEqual(questionFor(item(), 42), questionFor(item(), 42)); assert.deepEqual(planSession(initialState(), 'mixed', START, 42), planSession(initialState(), 'mixed', START, 42)); });
test('Daily plans contain unique questions only from the chosen range', () => { for (let seed = 0; seed < 100; seed++) {
    const s = { ...initialState(), selectedSurahs: [108], goal: 10 };
    const q = planSession(s, 'mixed', START, seed);
    assert.equal(q.length, 7);
    assert.equal(new Set(q.map(x => x.key)).size, q.length);
    assert(q.every(x => x.surah === 108));
} });
test('Time guides produce 5, 10 or 15 cards when the pool allows it', () => { for (const [goal, count] of [[3, 5], [7, 10], [10, 15]])
    assert.equal(planSession({ ...initialState(), goal }, 'mixed', START, 1).length, count); });
test('Due and repeatedly missed cards are reviewed before new material', () => { let s = initialState(); const a = item(), b = item('next', 113, 1); s = advance(s, a, false, 0, 'a'); s = advance(s, a, false, .1, 'b'); s = advance(s, b, false, .2, 'c'); const plan = planSession(s, 'mixed', START + 86400000, 2); assert.equal(plan[0].key, a.key); assert.equal(plan[0].reason, 'due'); assert.equal(plan[1].key, b.key); assert(plan.slice(2).some(x => x.reason === 'new')); });
test('Early optional practice is labelled practice rather than falsely due', () => { let s = initialState(); s.selectedSurahs = [108]; for (const i of allItems('next', [108]))
    s = advance(s, i, true, 0, i.key); const p = planSession(s, 'next', START + 60000, 1); assert(p.every(x => x.reason === 'practice')); });
test('Answer processing is immutable and idempotent for a repeated event', () => { const s = initialState(), c = item(); const next = advance(s, c, true, 0, 'event'); assert.equal(s.xp, 0); assert.deepEqual(s.cards, {}); assert.equal(next.xp, 10); assert.strictEqual(advance(next, c, false, 1, 'event'), next); });
test('A correct review schedules one day; a failure schedules ten minutes', () => { const good = advance(initialState(), item(), true, 0, 'a'); assert.equal(good.cards[item().key].dueAt, START + 86400000); const bad = advance(good, item(), false, .1, 'b'); assert.equal(bad.cards[item().key].dueAt, START + .1 * 86400000 + 600000); assert.equal(bad.cards[item().key].intervalDays, 0); assert.deepEqual(bad.cards[item().key].successDays, []); });
test('Same-day repeats cannot inflate the spaced-review interval or retention dates', () => { let s = advance(initialState(), item(), true, 0, 'a'); s = advance(s, item(), true, .01, 'b'); s = advance(s, item(), true, .02, 'c'); const c = s.cards[item().key]; assert.equal(c.intervalDays, 1); assert.equal(c.successDays.length, 1); assert.equal(retention(c), 'learning'); });
test('Distinct successful dates increase the interval with a ninety-day ceiling', () => { let s = initialState(); for (let d = 0; d < 15; d++)
    s = advance(s, item(), true, d, `event-${d}`); assert.equal(s.cards[item().key].intervalDays, 90); });
test('Retained requires at least three successful days spanning seven days', () => { let s = initialState(); s = advance(s, item(), true, 0, 'a'); s = advance(s, item(), true, 3, 'b'); s = advance(s, item(), true, 6, 'c'); assert.equal(retention(s.cards[item().key]), 'learning'); s = advance(s, item(), true, 7, 'd'); assert.equal(retention(s.cards[item().key]), 'retained'); s = advance(s, item(), false, 8, 'e'); assert.equal(retention(s.cards[item().key]), 'learning'); });
test('Self-assessed recall is stored separately and excluded from quiz accuracy', () => { let s = advance(initialState(), item('recall'), true, 0, 'a'); assert.equal(completedAccuracy(s), null); assert.equal(s.cards[item('recall').key].evidence, 'self-assessed'); assert.equal(s.recallSelfChecks, 1); s = advance(s, item(), false, 0, 'b'); s = advance(s, item('previous', 112, 2), true, 0, 'c'); assert.equal(completedAccuracy(s), 50); assert.equal(s.cards[item().key].evidence, 'quiz'); });
test('Due counts ignore chapters outside the current practice range', () => { let s = advance(initialState(), item('next', 108, 1), false, 0, 'a'); assert.equal(dueItems(s, START + 86400000).length, 0); s.selectedSurahs.push(108); assert.equal(dueItems(s, START + 86400000).length, 1); });
test('A backwards clock and a mismatched card key cannot corrupt review history', () => { const s = advance(initialState(), item(), true, 1, 'a'); assert.throws(() => advance(s, item(), true, 0, 'b'), /Clock/); assert.throws(() => applyAnswer(s, { ...item(), key: 'invalid' }, true, START + 2 * 86400000, 'c'), /Invalid review/); });
test('Calendar distance follows dates across DST rather than elapsed hours', () => { assert.equal(calendarDistance('2026-03-09', '2026-03-08'), 1); assert.equal(calendarDistance('2026-11-02', '2026-11-01'), 1); });
test('Streak counts today or yesterday, and stops at a missing date', () => { const days = { [dayKey(START)]: 1, [dayKey(START - 86400000)]: 1, [dayKey(START - 2 * 86400000)]: 1 }; assert.equal(streak(days, START), 3); delete days[dayKey(START)]; assert.equal(streak(days, START), 2); delete days[dayKey(START - 86400000)]; assert.equal(streak(days, START), 0); assert.equal(streak({}, START), 0); });
test('A valid save can round-trip without sharing mutable references', () => { const s = advance(initialState(), item(), true, 0, 'a'); const restored = validateState(JSON.parse(JSON.stringify(s))); assert.deepEqual(restored, s); restored.selectedSurahs.push(1); assert.notDeepEqual(restored.selectedSurahs, s.selectedSurahs); });
test('Backup validation rejects corrupted content and unknown schema versions', () => { assert.throws(() => validateState(null)); assert.throws(() => validateState({ ...initialState(), version: STATE_VERSION + 1 })); assert.throws(() => validateState({ ...initialState(), version: 0 })); assert.throws(() => validateState({ ...initialState(), selectedSurahs: [] })); assert.throws(() => validateState({ ...initialState(), selectedSurahs: [115] })); assert.throws(() => validateState({ ...initialState(), xp: -1 })); assert.throws(() => validateState({ ...initialState(), bookmarks: ['112:999'] })); assert.throws(() => validateState({ ...initialState(), reminder: '25:00' })); });
test('An interrupted valid session survives serialization with feedback intact', () => { const s = initialState(); s.session = { id: 'test', seed: 4, queue: planSession(s, 'mixed', START, 4), index: 0, answered: true, lastCorrect: false, lastChoice: '112:2', correct: 0, startedAt: START, kind: 'daily' }; assert.deepEqual(validateState(s).session, s.session); assert.throws(() => validateState({ ...s, session: { ...s.session, index: 99 } })); });
test('All user-facing dictionary entries have English, French and Arabic translations', () => { for (const key of allTranslationKeys())
    for (const locale of ['en', 'fr', 'ar']) {
        assert.equal(typeof tr(key, locale), 'string');
        assert(tr(key, locale).length > 0);
    } });
test('Shuffling is deterministic and does not mutate its input', () => { const a = [1, 2, 3, 4, 5]; assert.deepEqual(shuffle(a, rng(7)), shuffle(a, rng(7))); assert.deepEqual(a, [1, 2, 3, 4, 5]); });

const legacy = (version) => { const s = advance(initialState(), item(), true, 0, 'legacy'); s.version = version; if (version < 6) delete s.athan; if (version < 5) { delete s.places; delete s.smart; delete s.adhkarLog; delete s.detections; } if (version < 4) delete s.voiceFollowConsent; if (version < 3) { delete s.arabicSize; delete s.readingLayout; } if (version < 2) delete s.theme; return JSON.parse(JSON.stringify(s)); };
test('Version 1 and 2 saves migrate to the current schema without losing progress', () => {
    assert.equal(STATE_VERSION, 8);
    const v1 = validateState(legacy(1));
    assert.equal(v1.version, 8); assert.equal(v1.athan.enabled, false); assert.equal(v1.voiceFollowConsent, false); assert.equal(v1.theme, 'system'); assert.equal(v1.arabicSize, 'm'); assert.equal(v1.readingLayout, 'cards');
    assert.equal(v1.xp, 10); assert.equal(v1.attempts.length, 1); assert(v1.cards[item().key]);
    const v2 = legacy(2); v2.theme = 'light';
    const m2 = validateState(v2);
    assert.equal(m2.theme, 'light'); assert.equal(m2.arabicSize, 'm'); assert.deepEqual(m2.cards, v1.cards);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(m2))), m2);
});
test('Migration rejects missing or unknown settings rather than guessing', () => {
    const v2 = legacy(2); delete v2.theme; assert.throws(() => validateState(v2), /theme/);
    assert.throws(() => validateState({ ...initialState(), arabicSize: 'huge' }), /reading settings/);
    assert.throws(() => validateState({ ...initialState(), readingLayout: 'scroll' }), /reading settings/);
    const v3 = { ...initialState() }; delete v3.arabicSize; assert.throws(() => validateState(v3));
});
test('Locate accepts the exact place and reports distance only within the chosen surah', () => {
    const q = item('locate', 114, 4);
    assert.deepEqual(locateGuess(q, 114, 4), { correct: true, distance: 0 });
    assert.deepEqual(locateGuess(q, 114, 6), { correct: false, distance: 2 });
    assert.deepEqual(locateGuess(q, 113, 4), { correct: false, distance: null });
    assert.throws(() => locateGuess(q, 114, 7));
    assert.throws(() => locateGuess(item('next', 114, 4), 114, 4));
});
test('Locate treats identical wording (Al-Kafirun 3 and 5) as the same answer', () => {
    assert.deepEqual(identicalAyahs(109, 3), ['109:3', '109:5']);
    assert.equal(locateGuess(item('locate', 109, 3), 109, 5).correct, true);
    assert.equal(locateGuess(item('locate', 109, 5), 109, 3).correct, true);
    assert.deepEqual(locateGuess(item('locate', 109, 3), 109, 4), { correct: false, distance: 1 });
    for (const s of SURAH_DATA) for (let a = 1; a <= s.count; a++) assert(identicalAyahs(s.id, a).includes(`${s.id}:${a}`));
});
test('Locate questions cover every ayah, including first and last, with no invented options', () => {
    for (const s of SURAH_DATA) {
        assert.equal(allItems('locate', [s.id]).length, s.count);
        const q = questionFor(item('locate', s.id, s.count), 3);
        assert.deepEqual(q.options, []); assert.equal(q.text, verse(s.id, s.count)); assert.equal(q.correctId, `${s.id}:${s.count}`);
    }
});
test('Word reveal segments rebuild every source ayah exactly', () => { for (const s of SURAH_DATA) s.verses.forEach(v => { const w = ayahWords(v); assert(w.length > 0); assert.equal(w.join(' '), v); }); });
test('Whole-surah recall stays inside one surah, in order, as self-assessment', () => {
    let s = advance(initialState(), item('recall', 1, 2), true, 0, 'r');
    const q = surahRecallQueue(s, 1, START + 60000);
    assert.deepEqual(q.map(x => x.ayah), [1, 2, 3, 4, 5, 6, 7]);
    assert(q.every(x => x.surah === 1 && x.mode === 'recall'));
    assert.equal(q[1].reason, 'practice'); assert.equal(q[0].reason, 'new');
    assert.equal(surahRecallQueue(s, 1, START + 2 * 86400000)[1].reason, 'due');
    s.session = { id: 'whole', seed: 1, queue: q, index: 0, answered: false, lastCorrect: false, lastChoice: null, correct: 0, startedAt: START, kind: 'practice' };
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).session.queue, q);
});
test('Session recap reads only that session\'s saved evidence, in order', () => {
    let s = initialState();
    s = advance(s, item('next', 112, 1), true, 0, 'A:0');
    s = advance(s, item('locate', 113, 2), false, 0, 'A:1');
    s = advance(s, item('recall', 114, 1), true, 0, 'B:0');
    s = advance(s, item('previous', 112, 2), false, 0, 'AB:0');
    assert.deepEqual(sessionRecap(s, 'A'), [{ key: 'next:112:1', mode: 'next', surah: 112, ayah: 1, correct: true }, { key: 'locate:113:2', mode: 'locate', surah: 113, ayah: 2, correct: false }]);
    assert.equal(sessionRecap(s, 'missing').length, 0);
    assert.equal(s.cards['locate:113:2'].evidence, 'quiz');
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).cards, s.cards);
});

test('Voice-following consent is never granted by migration and must be a boolean', () => {
    const v3 = legacy(3); v3.arabicSize = 'l';
    const m = validateState(v3);
    assert.equal(m.version, 8); assert.equal(m.voiceFollowConsent, false); assert.equal(m.arabicSize, 'l'); assert.deepEqual(m.cards, validateState(legacy(1)).cards);
    assert.equal(validateState({ ...initialState(), voiceFollowConsent: true }).voiceFollowConsent, true);
    assert.throws(() => validateState({ ...initialState(), voiceFollowConsent: 'yes' }), /voice/);
    assert.equal(initialState().voiceFollowConsent, false);
});
test('Recited-word mapping skips stand-alone pause marks and nothing else', () => {
    const t = verse(110, 3), words = ayahWords(t);
    assert.equal(words.length, 8); assert.equal(words[4], 'ۚ');
    assert.deepEqual(recitedWordIndices(t), [0, 1, 2, 3, 5, 6, 7]);
    for (const s of SURAH_DATA) s.verses.forEach((v, i) => {
        const kept = new Set(recitedWordIndices(v));
        ayahWords(v).forEach((w, k) => assert.equal(kept.has(k), /[\u0621-\u064A\u066E-\u06D3\u06FA-\u06FF]/.test(w), `${s.id}:${i + 1} token ${k}`));
    });
});
test('Recited words line up one-to-one with the bundled recogniser corpus (when fetched)', async (t) => {
    const { readFile } = await import('node:fs/promises');
    let corpus;
    try { corpus = JSON.parse(await readFile(new URL('../vendor/tilawa/zipformer_quran.json', import.meta.url), 'utf8')); }
    catch { t.skip('voice model not fetched (npm run voice:fetch)'); return; }
    for (const s of SURAH_DATA) {
        const cs = corpus.surahs.find(x => x.n === s.id);
        assert.equal(cs.ayahs.length, s.count, `surah ${s.id} ayah count`);
        s.verses.forEach((v, i) => {
            const ours = recitedWordIndices(v).map(k => ayahWords(v)[k]), theirs = cs.ayahs[i].w.map(w => w[2]);
            assert.equal(ours.length, theirs.length, `${s.id}:${i + 1} word count`);
            ours.forEach((w, k) => assert.equal(comparable(w), comparable(theirs[k]), `${s.id}:${i + 1} word ${k}`));
        });
    }
});
