// Optional Islamic-occasion reminders: off by default, migrated off, the evening before, inside the budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION } from '../www/js/engine.js';
import { calendarReminders, islamicOccasions, OCCASION_CODE } from '../www/js/calendar.js';
import { OCCASION_MAX, rotationMax, ROTATION_MAX } from '../www/js/smart.js';
process.env.TZ = 'Asia/Riyadh';
const copy = { jumuah: { title: 'J', body: '' }, fast: () => ({ title: 'F', body: '' }), occasion: k => ({ title: k, body: 'b' }) };
const withOcc = (o) => { const s = initialState(); s.calendar = { ...s.calendar, occasions: { ...s.calendar.occasions, ...o } }; return s; };

test('v22 saves move to v23 with every occasion reminder off; bad values are rejected', () => {
    assert.equal(STATE_VERSION, 24);
    const v22 = JSON.parse(JSON.stringify(initialState())); v22.version = 22; delete v22.calendar.occasions; v22.calendar.jumuah = true; v22.xp = 9;
    const m = validateState(v22);
    assert.deepEqual(m.calendar, { jumuah: true, fasting: false, suhoor: false, iftar: false, occasions: { arafah: false, ashura: false, dhulHijjah: false, eidEve: false } });
    assert.equal(m.xp, 9);
    assert.throws(() => validateState({ ...initialState(), calendar: { ...initialState().calendar, occasions: { arafah: 'yes', ashura: false, dhulHijjah: false, eidEve: false } } }), /calendar/);
    assert.throws(() => validateState({ ...initialState(), calendar: { ...initialState().calendar, occasions: { arafah: false } } }), /calendar/);
});

test('The evening before each switched-on occasion, the three soonest, ids of code 29', () => {
    const now = new Date(2027, 4, 1, 9).getTime(); // before Dhul Hijjah 1448
    assert.deepEqual(calendarReminders(initialState(), copy, now), []);
    const all = calendarReminders(withOcc({ arafah: true, ashura: true, dhulHijjah: true, eidEve: true }), copy, now);
    assert.deepEqual(all.map(r => r.title), ['dhul-hijjah-ten', 'arafah', 'eid-adha']);
    assert.equal(all.length, OCCASION_MAX);
    const occ = Object.fromEntries(islamicOccasions(now, 60).map(o => [o.kind, o]));
    for (const r of all) {
        assert.equal(Math.floor(r.id / 1e6), OCCASION_CODE);
        const eve = new Date(occ[r.title].at); eve.setDate(eve.getDate() - 1);
        assert.equal(new Date(r.at).toDateString(), eve.toDateString(), `${r.title}: the evening before`);
        assert.equal(new Date(r.at).getHours(), 20);
    }
    assert.equal(all.find(r => r.title === 'eid-adha').url, 'ayahflow://eid');
    assert.deepEqual(calendarReminders(withOcc({ arafah: true }), copy, now).map(r => r.title), ['arafah']);
});

test('Switched on, they take their place from the rotation budget; native ids are cancelled with the calendar', () => {
    assert.equal(rotationMax(withOcc({ eidEve: true })), ROTATION_MAX - OCCASION_MAX);
    assert.match(readFileSync(new URL('../native/bridge.mjs', import.meta.url), 'utf8'), /id >= 27000000 && id < 30000000/);
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /function occasionCopy[\s\S]*?occSighting/, 'every reminder carries the sighting caveat');
});
