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
    assert.match(readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8'), /await setWidgetData\(\{ \.\.\.widgetData\([\s\S]*?, upcoming \}\);/);
    const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
    assert.match(swift, /let upcoming: \[Upcoming\]\?/, 'optional, so older shared data still decodes');
    assert.match(swift, /NextPrayerWidget\(\)\n        UpcomingWidget\(\)/);
});
