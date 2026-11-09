// Today's Quran plan and the saved memorisation session (schema v28): built on the review engine, never a second
// scheduler; progress only from saved records; answers idempotent per session verse; migration keeps everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, applyAnswer, dueItems, STATE_VERSION, SESSION_MAX, surahRecallQueue, dayKey } from '../www/js/engine.js';
import { dailyPlan, newHifz, hifzAdvance, hifzItem, hifzEventId, toggleDayOff, memorisedDue, difficultItems } from '../www/js/daily.js';
import { tr } from '../www/js/i18n.js';

const NOW = new Date(2026, 10, 9, 10).getTime(); // a Monday
const v27 = () => { const s = structuredClone(initialState()); s.version = 27; delete s.hifz; delete s.daysOff; s.xp = 40; s.goal = 10; s.bookmarks = ['2:255']; return s; };

test('v27 saves move to v28 with no memorisation session and no days off; nothing else changes', () => {
    assert.equal(STATE_VERSION, 29);
    const old = v27(), m = validateState(JSON.parse(JSON.stringify(old)));
    assert.equal(m.version, 29); assert.equal(m.hifz, null); assert.deepEqual(m.daysOff, []);
    assert.equal(m.xp, 40); assert.equal(m.goal, 10); assert.deepEqual(m.bookmarks, ['2:255']);
    const { version: _a, hifz: _b, daysOff: _c, ...rest } = m, { version: _d, ...before } = old;
    assert.deepEqual(rest, before, 'every v27 field is kept as it was');
});

test('A saved session round-trips; malformed sessions and days off are rejected, not reset', () => {
    const s = { ...initialState(), hifz: newHifz('a1', 67, 1, 5, 3, 2, NOW), daysOff: [5] };
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).hifz, s.hifz);
    const bad = [
        { ...s.hifz, to: 30 }, // longer than 20 ayahs
        { ...s.hifz, surah: 67, to: 31 }, // past the surah's end
        { ...s.hifz, at: 9 }, // outside the range
        { ...s.hifz, repeat: 4 }, { ...s.hifz, level: 7 }, { ...s.hifz, id: 'x y' }, { ...s.hifz, extra: 1 },
    ];
    for (const h of bad) assert.throws(() => validateState(JSON.parse(JSON.stringify({ ...s, hifz: h }))), /memorisation/);
    for (const d of [[7], [1, 1], [0, 1, 2, 3, 4, 5, 6], ['1']]) assert.throws(() => validateState(JSON.parse(JSON.stringify({ ...s, daysOff: d }))), /days off/);
});

test('Regression: a whole-surah recall session longer than 15 ayahs survives a restart', () => {
    const s = initialState(), queue = surahRecallQueue(s, 2);
    assert.equal(queue.length, 286); assert.equal(SESSION_MAX, 286);
    const saved = { ...s, session: { id: 'r', seed: 1, queue, index: 120, answered: false, lastCorrect: false, lastChoice: null, correct: 0, startedAt: NOW, kind: 'practice' } };
    assert.equal(validateState(JSON.parse(JSON.stringify(saved))).session.index, 120);
});

test('Answering a memorised ayah is self-assessed recall in the engine, once per session ayah, and moves the session on', () => {
    let s = { ...initialState(), hifz: newHifz('s1', 112, 1, 4, 3, 3, NOW) };
    const h = s.hifz, id = hifzEventId(h, 1);
    s = applyAnswer(s, hifzItem(112, 1), true, NOW, id);
    const again = applyAnswer(s, hifzItem(112, 1), true, NOW + 1, id);
    assert.equal(again, s, 'a second save of the same answer records nothing');
    assert.equal(s.cards['recall:112:1'].evidence, 'self-assessed');
    assert.equal(s.attempts.length, 1); assert.equal(s.recallSelfChecks, 1);
    let n = hifzAdvance(h, 1, NOW);
    assert.equal(n.at, 2); assert.equal(n.done, false); assert.equal(n.id, 's1');
    n = hifzAdvance(hifzAdvance(hifzAdvance(n, 2, NOW), 3, NOW), 4, NOW);
    assert.equal(n.done, true); assert.equal(n.at, 4);
    assert.deepEqual(hifzAdvance(n, 9, NOW), n, 'an ayah outside the session changes nothing');
});

test('The plan reuses the engine: due reviews, memorised ayahs outside the chosen surahs, difficult ayahs', () => {
    let s = initialState(); // chosen surahs 112–114
    assert.equal(dailyPlan(s, NOW).review.due, 0);
    s = applyAnswer(s, { key: 'next:112:1', mode: 'next', surah: 112, ayah: 1, reason: 'new' }, false, NOW - 3600e3, 'q1');
    s = applyAnswer(s, hifzItem(67, 2), false, NOW - 3600e3, 'hifz:x:2');
    const p = dailyPlan(s, NOW);
    assert.equal(p.review.due, dueItems(s, NOW).length, 'the same due count as the review engine');
    assert.deepEqual(memorisedDue(s, NOW).map(x => x.key), ['recall:67:2'], 'Al-Mulk is not a chosen surah, so it is offered separately');
    assert.deepEqual(new Set(difficultItems(s).map(x => x.key)), new Set(['next:112:1', 'recall:67:2']));
    assert.equal(p.minutes, 7);
});

test('Today\'s progress counts only saved records; days off are respected; at least one day stays on', () => {
    let s = initialState();
    let p = dailyPlan(s, NOW);
    assert.equal(p.review.answeredToday, 0); assert.equal(p.memorise.recitedToday, 0); assert.equal(p.read.opened, false); assert.equal(p.rest, false);
    s = applyAnswer(s, hifzItem(112, 1), true, NOW, 'hifz:s:1');
    s = applyAnswer(s, { key: 'recall:113:1', mode: 'recall', surah: 113, ayah: 1, reason: 'new' }, true, NOW, 'sess:0');
    s = { ...s, worship: { ...s.worship, quran: { [dayKey(NOW)]: [18] } } };
    p = dailyPlan(s, NOW);
    assert.equal(p.memorise.recitedToday, 1); assert.equal(p.review.answeredToday, 1); assert.equal(p.read.opened, true);
    s = toggleDayOff(s, new Date(NOW).getDay());
    assert.equal(dailyPlan(s, NOW).rest, true);
    for (let d = 0; d < 7; d++) s = toggleDayOff(s, d);
    assert.ok(s.daysOff.length <= 6, 'never every day off');
    assert.equal(toggleDayOff(s, 9), s);
});

test('Wiring: Home leads with the plan; memorisation saves through the engine; reminder skips days off; three languages', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /\$\{watchCard\(\)\}\$\{welcomeCard\(\)\}\$\{planCard\(\)\}/);
    const plan = app.slice(app.indexOf('function planCard'), app.indexOf('function homeView'));
    assert.doesNotMatch(plan, /streak|xp|accuracy|%/i, 'no streaks, scores or percentages in the plan');
    assert.doesNotMatch(readFileSync(new URL('../src/daily.ts', import.meta.url), 'utf8'), /setTimeout|fetch\(|planSession\(/, 'the plan schedules nothing itself');
    assert.match(app, /setReminder\(state\.reminder, \.\.\.practiceReminder\(next\.daysOff\)\)/);
    const bridge = readFileSync(new URL('../native/bridge.mjs', import.meta.url), 'utf8');
    assert.match(bridge, /weekday: d \+ 1/); assert.match(bridge, /PRAYER_IDS|PRACTICE_IDS\.map/);
    assert.doesNotMatch(bridge, /Your next review is ready/, 'the reminder no longer claims a review is waiting');
    for (const k of ['planTitle', 'planMinutes', 'planRead', 'planPages', 'planOpened', 'planDone', 'planMemorise', 'planAyahsToday', 'planReview', 'planReviewResume', 'planReviewSub', 'planDue', 'planReviewNone', 'planReviewClear', 'planMemorisedDue', 'planToday', 'planAnswered', 'planNothingYet', 'planRest', 'daysOff', 'daysOffNote', 'practiceReminderBody'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});

test('Interface order: Home leads with Quran, then prayer, then remembrance; the Quran tab puts learning first', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const home = app.slice(app.indexOf('function homeView'), app.indexOf('/** Status choices for one prayer'));
    const order = ['welcomeCard()', 'planCard()', 'nextPrayerWidget()', 'trackerWidget()', 'nowCard()', 'quickDhikrWidget()', 'ayahWidget()', 'qiblaTile()', 'dailyPulse()'].map(x => home.indexOf(x));
    assert.ok(order.every(i => i > 0), 'every Home section is still there');
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'in this order');
    const quran = app.slice(app.indexOf('function quranView'), app.indexOf('\n', app.indexOf('function quranView')));
    assert.match(quran, /read-last.*\$\{hifzEntry\(\)\}\$\{practiceEntry\(\)\}\$\{khatmEntry\(\)\}\$\{reviewEntry\(\)\}.*surah-search.*\$\{quranMore\(\)\}/);
    for (const v of ['verses', 'recitations', 'tajweed', 'recite']) assert.match(app.slice(app.indexOf('function quranMore')), new RegExp(`data-view="${v}"`), `${v} still reachable from the Quran tab`);
    const welcome = app.slice(app.indexOf('const WELCOME_KEY'), app.indexOf('/** Today\'s Quran'));
    assert.match(welcome, /try \{ return localStorage/, 'the dismissal never throws');
    assert.doesNotMatch(welcome, /commit\(/, 'the welcome card changes no saved data');
    for (const k of ['welcomeTitle', 'welcomeSub', 'welcomeRead', 'welcomeReadSub', 'welcomePrayer', 'welcomePrayerSub', 'welcomeDone', 'learnAndRecord'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k, `${k} ${l}`);
});
