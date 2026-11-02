// Islamic occasions on Umm al-Qura dates: every one found in a year, in Hijri order, with the sighting caveat shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { islamicOccasions, occasionOn, calendarSpan, hijriDate } from '../www/js/calendar.js';
import { tr } from '../www/js/i18n.js';
process.env.TZ = 'Asia/Riyadh';
const NOW = Date.parse('2026-11-01T09:00:00+03:00');

test('A year ahead lists each occasion once, on its Hijri day', () => {
    const list = islamicOccasions(NOW);
    assert.deepEqual(list.map(o => o.kind), ['ramadan-start', 'last-ten', 'ramadan-end', 'eid-fitr', 'dhul-hijjah-ten', 'arafah', 'eid-adha', 'tashreeq', 'new-year', 'tasua', 'ashura']);
    const at = Object.fromEntries(list.map(o => [o.kind, o]));
    assert.deepEqual([at['ramadan-start'].hijri.month, at['ramadan-start'].hijri.day], [9, 1]);
    assert.deepEqual([at['eid-fitr'].hijri.month, at['eid-fitr'].hijri.day], [10, 1]);
    assert.deepEqual([at.arafah.hijri.month, at.arafah.hijri.day], [12, 9]);
    assert.deepEqual([at['eid-adha'].hijri.month, at['eid-adha'].hijri.day], [12, 10]);
    assert.deepEqual([at.ashura.hijri.month, at.ashura.hijri.day], [1, 10]);
    // The last day of Ramadan is the day before Eid al-Fitr, whether Ramadan has 29 or 30 days.
    assert.equal(at['eid-fitr'].at - at['ramadan-end'].at, 86400000);
    assert.deepEqual(calendarSpan(at.tashreeq).map(d => hijriDate(new Date(`${d}T12:00`)).day), [11, 12, 13]);
    assert.equal(at['dhul-hijjah-ten'].days, 10);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].at >= list[i - 1].at, 'soonest first');
});

test('An occasion that has begun stays listed until its last day', () => {
    const tashreeq = islamicOccasions(NOW).find(o => o.kind === 'tashreeq');
    const second = new Date(tashreeq.at); second.setDate(second.getDate() + 1); second.setHours(9);
    assert.equal(occasionOn(second)?.kind, 'tashreeq');
    const eid = islamicOccasions(NOW).find(o => o.kind === 'eid-adha');
    assert.equal(occasionOn(new Date(eid.at + 9 * 3600000), ['eid-fitr', 'eid-adha'])?.kind, 'eid-adha');
    assert.equal(occasionOn(new Date(NOW), ['eid-fitr', 'eid-adha']), null);
});

test('The Mawlid is not listed, and the view says why; every date carries the sighting caveat', () => {
    assert.ok(!islamicOccasions(NOW).some(o => o.hijri.month === 3));
    for (const l of ['en', 'fr', 'ar']) { assert.notEqual(tr('mawlidNote', l), 'mawlidNote'); assert.notEqual(tr('occSighting', l), 'occSighting'); }
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /function occasionsView[\s\S]*?occasionsNote[\s\S]*?mawlidNote/);
    assert.match(app, /function occasionCard[\s\S]*?occSighting/);
});
