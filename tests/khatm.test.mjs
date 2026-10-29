// Quran completion plan (schema v20): even split of the 604 pages, today's portion, honest progress, migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, PAGE_TOTAL, KHATM_DAYS } from '../www/js/engine.js';
import { PAGE_COUNT } from '../www/js/data.js';
import { khatmToday, startKhatm, endKhatm, setKhatmPage, turnedPage, dueBy } from '../www/js/khatm.js';
import { tr } from '../www/js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Page total matches the Mushaf data', () => assert.equal(PAGE_TOTAL, PAGE_COUNT));

test('Every page is due exactly once, in order, and the last day ends on the last page', () => {
    for (const days of KHATM_DAYS) for (const from of [1, 250, 604]) {
        const k = startKhatm(initialState(), days, from, '2026-10-29').khatm;
        let prev = from - 1;
        for (let i = 0; i < days; i++) { const end = dueBy(k, i); assert.ok(end >= prev, `${days}/${from} day ${i}`); prev = end; }
        assert.equal(dueBy(k, days - 1), PAGE_TOTAL);
    }
    const k = startKhatm(initialState(), 30, 1, '2026-10-29').khatm;
    const sizes = Array.from({ length: 30 }, (_, i) => dueBy(k, i) - dueBy(k, i - 1));
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, 'an even share: about 20 pages a day');
});

test('Today\'s portion, behind and ahead, end date, and everything left after the last day', () => {
    let s = startKhatm(initialState(), 30, 1, '2026-10-29');
    let k = khatmToday(s.khatm, '2026-10-29');
    assert.deepEqual([k.day, k.from, k.to, k.reached, k.nextPage, k.behind, k.endDay], [1, 1, 20, 0, 1, 0, '2026-11-27']);
    k = khatmToday(s.khatm, '2026-11-01');
    assert.deepEqual([k.day, k.from, k.to, k.behind], [4, 61, 81, 60], 'three days missed: 60 pages behind');
    s = setKhatmPage(s, 100);
    k = khatmToday(s.khatm, '2026-11-01');
    assert.equal(k.ahead, 19); assert.equal(k.behind, 0); assert.equal(k.done, 100);
    k = khatmToday(s.khatm, '2026-12-05');
    assert.ok(k.overdue); assert.equal(k.from, 101); assert.equal(k.to, PAGE_TOTAL); assert.equal(k.day, 30);
    assert.equal(khatmToday(setKhatmPage(s, 604).khatm, '2026-11-20').finished, true);
    // Starting mid-Quran counts only the pages left.
    const mid = khatmToday(startKhatm(initialState(), 10, 305, '2026-10-29').khatm, '2026-10-29');
    assert.equal(mid.total, 300); assert.equal(mid.from, 305); assert.equal(mid.to, 334);
});

test('Only a forward turn from the next unread page moves the plan; jumps never do', () => {
    const s = startKhatm(initialState(), 30, 1, '2026-10-29');
    assert.equal(turnedPage(s, 1, 2).khatm.page, 1, 'finished page 1');
    assert.equal(turnedPage(s, 0, 1), s, 'opening the reader is not a finished page');
    assert.equal(turnedPage(s, 293, 294), s, 'reading Al-Kahf on Friday does not move the plan');
    assert.equal(turnedPage(s, 2, 1), s, 'turning back does not');
    assert.equal(turnedPage(s, 1, 40), s, 'jumping ahead does not');
    assert.equal(turnedPage({ ...s, khatm: null }, 1, 2).khatm, null);
    assert.equal(setKhatmPage(s, 9999).khatm.page, PAGE_TOTAL); assert.equal(setKhatmPage(s, -5).khatm.page, 0);
    assert.equal(endKhatm(s).khatm, null);
    assert.throws(() => startKhatm(initialState(), 12, 1), /Invalid plan/); assert.throws(() => startKhatm(initialState(), 30, 605), /Invalid plan/);
});

test('Migration v19 → v20 adds no plan; a saved plan round-trips; bad plans are rejected', () => {
    assert.equal(STATE_VERSION, 21);
    const v19 = JSON.parse(JSON.stringify({ ...initialState(), version: 19, xp: 5 })); delete v19.khatm; v19.calendar = { jumuah: false, fasting: false };
    const m = validateState(v19);
    assert.equal(m.version, 21); assert.equal(m.khatm, null); assert.equal(m.xp, 5); assert.deepEqual(m.fajrAlarm, initialState().fajrAlarm);
    const s = setKhatmPage(startKhatm(initialState(), 40, 10, '2026-10-29'), 50);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).khatm, { start: '2026-10-29', days: 40, from: 10, page: 50 });
    const ok = s.khatm;
    for (const bad of [{ days: 12 }, { from: 0 }, { page: 700 }, { page: 5 }, { start: 'today' }, { extra: 1 }])
        assert.throws(() => validateState({ ...s, khatm: { ...ok, ...bad } }), /Quran plan/, JSON.stringify(bad));
    assert.throws(() => validateState({ ...s, khatm: undefined }), /Quran plan/);
});

test('Wiring: page turns go through the plan, Home and Quran entries, wording in three languages', () => {
    const app = read('src/app.ts');
    assert.match(app, /await commit\(\{ \.\.\.turnedPage\(state, before, page\), readPosition: \{ surah: s, ayah: a \} \}\);/);
    assert.match(app, /\$\{ramadanCard\(\)\}\$\{khatmCard\(\)\}/); assert.match(app, /\$\{khatmEntry\(\)\}\$\{reviewEntry\(\)\}/);
    for (const k of ['khatmTitle', 'khatmPlanIt', 'khatmSub', 'khatmFinishIn', 'khatmNDays', 'khatmNDaysFew', 'khatmStartAt', 'khatmFromStart', 'khatmFromHere', 'khatmPreview', 'khatmStart', 'khatmStarted', 'khatmHonest', 'khatmDayOf', 'khatmEnds', 'khatmToday', 'khatmTodayPages', 'khatmFromTo', 'khatmReached', 'khatmPageN', 'khatmNotYet', 'khatmReachedOf', 'khatmOnTrack', 'khatmTodayDone', 'khatmBehind', 'khatmAhead', 'khatmContinue', 'khatmCorrect', 'khatmCorrectNote', 'khatmBadPage', 'khatmEnd', 'khatmEndPrompt', 'khatmFinished', 'khatmFinishedNote', 'khatmNew'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});
