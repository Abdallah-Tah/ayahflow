// Hijri date correction: ±1 day moves every Hijri date (holidays, Ramadan, reminders); 0 is Umm al-Qura as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, HIJRI_OFFSETS } from '../www/js/engine.js';
import { hijriDate, setHijriOffset, islamicOccasions, ramadanSpan, ramadanDay } from '../www/js/calendar.js';
process.env.TZ = 'Asia/Riyadh';
const NOW = new Date(2026, 10, 1, 9).getTime();

test('v24 saves move to v25 with no correction; only -1, 0 and +1 are accepted', () => {
    assert.equal(STATE_VERSION, 26); assert.deepEqual([...HIJRI_OFFSETS], [-1, 0, 1]);
    const v24 = JSON.parse(JSON.stringify(initialState())); v24.version = 24; delete v24.hijriOffset; v24.xp = 7;
    const m = validateState(v24); assert.equal(m.hijriOffset, 0); assert.equal(m.xp, 7);
    for (const o of HIJRI_OFFSETS) assert.equal(validateState({ ...initialState(), hijriOffset: o }).hijriOffset, o);
    assert.throws(() => validateState({ ...initialState(), hijriOffset: 2 }), /Hijri/);
});

test('The correction moves the Hijri date, the occasions and Ramadan by exactly one day', () => {
    try {
        setHijriOffset(0);
        const base = hijriDate(new Date(NOW)), eid0 = islamicOccasions(NOW).find(o => o.kind === 'eid-fitr').at, r0 = ramadanSpan(NOW);
        setHijriOffset(1);
        const plus = hijriDate(new Date(NOW));
        assert.equal(plus.day === 1 ? 30 >= base.day : plus.day - base.day, plus.day === 1 ? true : 1);
        assert.equal(eid0 - islamicOccasions(NOW).find(o => o.kind === 'eid-fitr').at, 86400000, '+1: Eid a day earlier in the Gregorian calendar');
        assert.equal(r0.start - ramadanSpan(NOW).start, 86400000);
        setHijriOffset(-1);
        assert.equal(islamicOccasions(NOW).find(o => o.kind === 'eid-fitr').at - eid0, 86400000, '-1: Eid a day later');
        assert.equal(ramadanDay(new Date(r0.start + 12 * 3600000)), null, '-1: the Umm al-Qura first day is still Sha\'ban');
        setHijriOffset(5); assert.deepEqual(hijriDate(new Date(NOW)), base, 'anything else means no correction');
    } finally { setHijriOffset(0); }
});

test('Wiring: applied before every render, reminders re-planned, the widget shows the corrected date', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /function applyTheme\(\): void \{ setHijriOffset\(state\.hijriOffset\);/);
    assert.match(app, /case 'hijri-offset':[\s\S]*?syncCalendar\(\)[\s\S]*?pushWidget\(\)/);
    assert.match(app, /format\(hijriBase\(date\)\)/);
    assert.match(app, /hijriOffset: String\(state\.hijriOffset\)/);
    const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
    assert.match(swift, /entry\.labels\["hijriOffset"\]/); assert.match(swift, /formatted\(hijriDay, entry\.locale, hijri: true\)/);
});
