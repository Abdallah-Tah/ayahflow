// "Jumu'ah and fasts" widget: the days it shows, and its wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upcomingDays, ramadanDay } from '../www/js/calendar.js';

process.env.TZ = 'America/New_York';
const copy = { jumuah: 'J', jumuahSub: 'Kahf', fast: 'F', why: r => r.join('+'), ramadan: 'R', ramadanSub: 'UQ' };

test('Fridays, fast days (with why) and the first of Ramadan, from today, in order', () => {
    const list = upcomingDays(copy, new Date(2026, 9, 29, 15).getTime());
    assert.deepEqual(list.slice(0, 3).map(u => [u.day, u.kind, u.sub]), [['2026-10-29', 'fast', 'thursday'], ['2026-10-30', 'jumuah', 'Kahf'], ['2026-11-02', 'fast', 'monday']]);
    assert.ok(list.length <= 6 && list.every((u, i) => i === 0 || u.at >= list[i - 1].at));
    assert.equal(new Date(list[0].at).getHours(), 0, 'start of the local day');
    let first; for (let i = 0; i < 400 && !first; i++) { const d = new Date(2026, 9, 29 + i, 12); if (ramadanDay(d) === 1) first = d; }
    const r = upcomingDays(copy, first.getTime() - 3 * 86400000);
    assert.ok(r.some(u => u.kind === 'ramadan' && new Date(u.at).getDate() === first.getDate()));
    assert.ok(!r.some(u => u.kind === 'fast' && ramadanDay(new Date(u.at + 12 * 3600000)) !== null), 'no voluntary fast in Ramadan');
});

test('Wiring: shared with the widget data; widget decodes it and is in the bundle', () => {
    assert.match(readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8'), /await setWidgetData\(\{ \.\.\.widgetData\([\s\S]*?, upcoming, ramadan \}\);/);
    const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
    assert.match(swift, /let upcoming: \[Upcoming\]\?/, 'optional, so older shared data still decodes');
    assert.match(swift, /NextPrayerWidget\(\)\n        UpcomingWidget\(\)/);
});

test('Coming up: the Ramadan span counts to 1 Ramadan, then through it until Eid al-Fitr', async () => {
    const { ramadanSpan, upcomingOccasions, hijriDate } = await import('../www/js/calendar.js');
    const before = ramadanSpan(new Date(2026, 10, 1, 9).getTime());
    const h = (ms) => hijriDate(new Date(ms + 12 * 3600000));
    assert.deepEqual([h(before.start).month, h(before.start).day], [9, 1]);
    assert.deepEqual([h(before.eid).month, h(before.eid).day], [10, 1]);
    assert.ok([29, 30].includes(Math.round((before.eid - before.start) / 86400000)));
    assert.equal(new Date(before.start).getHours(), 0, 'local midnight');
    // During Ramadan it is the same span; on Eid it moves on to the next year's.
    assert.deepEqual(ramadanSpan(before.start + 10 * 86400000 + 9 * 3600000), before);
    assert.ok(ramadanSpan(before.eid + 9 * 3600000).start > before.eid);
    const occ = upcomingOccasions(k => k, 'UQ', before.start - 86400000 * 2, 60);
    assert.ok(occ.every(o => o.kind === 'occasion' && o.sub === 'UQ'));
    assert.ok(!occ.some(o => o.title === 'ramadan-start'), 'the countdown is the widget hero, not a list row');
    assert.ok(occ.some(o => o.title === 'eid-fitr'));
});

test('Coming up wiring: the span and labels are shared, the Swift view counts days itself', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /const ramadan = ramadanSpan\(\);/);
    assert.match(app, /upcoming, ramadan \}\);/);
    for (const k of ['wRamadanUntil', 'wEidIn', 'wSighting', 'wIftar', 'wSuhoor', 'wDay1', 'wDay2', 'wDayFew', 'wDayMany', 'wOf2930']) assert.match(app, new RegExp(`${k}: t\\('${k}'\\)`), k);
    const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
    assert.match(swift, /let ramadan: RamadanSpan\?/, 'optional, so older shared data still decodes');
    assert.match(swift, /enum RamadanPhase/);
    assert.match(swift, /case \(\.systemSmall, \.some\(let p\)\)/);
    assert.match(swift, /case \(_, \.some\(\.during\(let d, let eidIn\)\)\):[\s\S]*?strip\(d\)/, 'the 30-day strip only during Ramadan');
    assert.match(swift, /wSighting/, 'every Ramadan state shows the sighting caveat');
    assert.match(swift, /StaticConfiguration\(kind: "AyahFlowUpcoming"/, 'same kind, so placed widgets stay');
    assert.match(app, /ayahflow:\\\/\\\/occasions/);
});
