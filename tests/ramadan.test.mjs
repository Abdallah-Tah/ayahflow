// Ramadan mode (schema v21): day of Ramadan, suhoor/iftar times and reminders, odd nights, sourced narrations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState } from '../www/js/engine.js';
import { ramadanToday, daysToRamadan, RAMADAN_TEXT } from '../www/js/ramadan.js';
import { ramadanDay, calendarReminders, SUHOOR_CODE, IFTAR_CODE, SUHOOR_BEFORE, IFTAR_BEFORE } from '../www/js/calendar.js';
import { timesFor, rotationMax, RAMADAN_DAYS } from '../www/js/smart.js';
import { tr } from '../www/js/i18n.js';

process.env.TZ = 'America/New_York';
const home = { lat: 43.9145, lng: -69.9653, radius: 150, label: 'Home' };
const placed = (cal = {}) => ({ ...initialState(), places: { home, work: null, mosque: null }, calendar: { ...initialState().calendar, ...cal } });
const copy = { jumuah: { title: 'J', body: '' }, fast: () => ({ title: 'F', body: '' }), suhoor: f => ({ title: 'S', body: String(f) }), iftar: m => ({ title: 'I', body: String(m) }) };
/** 1 Ramadan 1448 by the system's Umm al-Qura calendar, found rather than typed. */
const first = (() => { for (let i = 0; i < 400; i++) { const d = new Date(2026, 9, 29 + i, 12); if (ramadanDay(d) === 1) return d; } throw new Error('no Ramadan within a year'); })();
const at = (offsetDays, h = 12, m = 0) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + offsetDays, h, m).getTime();

test('Day of Ramadan, days until it begins, nothing outside it', () => {
    assert.equal(ramadanDay(new Date(at(0))), 1); assert.equal(ramadanDay(new Date(at(-1))), null);
    assert.equal(daysToRamadan(at(-10)), 10); assert.equal(daysToRamadan(at(-40)), null); assert.equal(daysToRamadan(at(3)), null);
    assert.equal(ramadanToday(placed(), at(-1)), null);
    const r = ramadanToday(placed(), at(4));
    assert.equal(r.day, 5); const t = timesFor(placed(), new Date(at(4)));
    assert.equal(r.suhoorEnds, t.fajr); assert.equal(r.iftar, t.maghrib); assert.equal(r.lastTen, false); assert.equal(r.oddNight, null);
    assert.equal(ramadanToday(initialState(), at(4)).suhoorEnds, null, 'no place: no times');
});

test('Odd nights of the last ten: the night after the 20th, 22nd, … 28th', () => {
    assert.equal(ramadanToday(placed(), at(19)).oddNight, 21); assert.equal(ramadanToday(placed(), at(20)).oddNight, null);
    assert.equal(ramadanToday(placed(), at(20)).lastTen, true); assert.equal(ramadanToday(placed(), at(25)).oddNight, 27);
    assert.equal(ramadanToday(placed(), at(18)).lastTen, false);
});

test('Suhoor and iftar reminders only in Ramadan, three days ahead, ids clear of others, budget taken', () => {
    assert.deepEqual(calendarReminders(placed({ suhoor: true, iftar: true }), copy, at(-10)).filter(r => r.kind === 'suhoor' || r.kind === 'iftar'), []);
    const list = calendarReminders(placed({ suhoor: true, iftar: true }), copy, at(2, 3, 0));
    const s = list.filter(r => r.kind === 'suhoor'), i = list.filter(r => r.kind === 'iftar');
    assert.equal(s.length, RAMADAN_DAYS); assert.equal(i.length, RAMADAN_DAYS);
    const t = timesFor(placed(), new Date(at(2)));
    assert.equal(s[0].at, t.fajr - SUHOOR_BEFORE * 60000); assert.equal(i[0].at, t.maghrib - IFTAR_BEFORE * 60000);
    assert.ok(s.every(r => Math.floor(r.id / 1e6) === SUHOOR_CODE) && i.every(r => Math.floor(r.id / 1e6) === IFTAR_CODE));
    assert.equal(new Set(list.map(r => r.id)).size, list.length);
    assert.equal(calendarReminders(placed({ suhoor: true }), copy, at(2, 3, 0)).filter(r => r.kind === 'iftar').length, 0);
    assert.equal(rotationMax(placed({ suhoor: true, iftar: true })), rotationMax(placed()) - 2 * RAMADAN_DAYS);
});

test('Migration v20 → v21 adds both switches off; narrations verbatim from their cited hadiths', () => {
    const v20 = JSON.parse(JSON.stringify({ ...initialState(), version: 20, calendar: { jumuah: true, fasting: true } }));
    const m = validateState(v20);
    assert.deepEqual(m.calendar, { jumuah: true, fasting: true, suhoor: false, iftar: false });
    assert.throws(() => validateState({ ...initialState(), calendar: { jumuah: false, fasting: false } }), /calendar/);
    const src = JSON.parse(readFileSync(new URL('../content/ramadan/ramadan.json', import.meta.url), 'utf8')).items;
    for (const it of src) assert.ok(it.full.includes(it.text), it.id);
    assert.deepEqual(RAMADAN_TEXT.map(x => x.source.ref), ['bukhari:2017', 'tirmidhi:3513']);
    assert.ok(RAMADAN_TEXT[1].source.grades.some(g => g.by === 'Al-Albani' && g.grade === 'Sahih'));
    assert.ok(!('full' in RAMADAN_TEXT[0]), 'the full hadith is not bundled');
    for (const k of ['ramadanDay', 'ramadanSoon', 'ramadanNoPlace', 'suhoorEnds', 'iftarAt', 'ramadanOddNight', 'ramadanLastTen', 'ramadanQadrDua', 'ramadanKhatm', 'ramadanRemind', 'suhoorToggle', 'suhoorNote', 'iftarToggle', 'iftarNote', 'suhoorTitle', 'suhoorBody', 'iftarTitle', 'iftarBody'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k, `${k} ${l}`);
});
