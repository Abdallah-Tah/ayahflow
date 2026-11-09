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

test('Prayer widget: Ramadan chip in the header, next occasion on the date row, a Coming up page; data shared', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /const ramadan = ramadanSpan\(\);/);
    assert.match(app, /upcoming, ramadan \}\);/);
    assert.match(app, /short: u\.kind === 'jumuah' \? t\('wsJumuah'\) : u\.kind === 'fast' \? t\('wsFast'\) : occ \? t\(`ws_\$\{occ\}`\)/);
    for (const k of ['wRamadanDay', 'wEidIn', 'wSighting', 'wSightingLong', 'wIftar', 'wDay1', 'wDay2', 'wDayFew', 'wDayMany', 'wOf2930', 'wOddNight', 'wRamadanBegins', 'upcomingPage']) assert.match(app, new RegExp(`${k}: t\\(`), k);
    const swift = readFileSync(new URL('../ios/App/AyahFlowWidget/AyahFlowWidget.swift', import.meta.url), 'utf8');
    assert.match(swift, /let ramadan: RamadanSpan\?/, 'optional, so older shared data still decodes');
    assert.match(swift, /let short: String\?; var lunar: Bool\? = nil \}/, 'optional fields, so older shared data still decodes');
    assert.match(swift, /case prayer, dhikr, moments, ayah, upcoming\n/, 'pages appended only, so saved page numbers keep their meaning');
    assert.match(swift, /static let order: \[WidgetPage\] = \[\.prayer, \.upcoming, \.dhikr, \.moments, \.ayah\]/);
    assert.match(swift, /func ramadanText\(short: Bool\) -> String\?/, 'the chip has a long and a short form');
    assert.match(swift, /if case let \.during\(d, e\) = info\.phase \{ during = \(d, e\) \}[\s\S]*?ForEach\(1\.\.\.30/, 'the 30-day strip only during Ramadan');
    assert.match(swift, /wSightingLong/);
    assert.match(swift, /StaticConfiguration\(kind: "AyahFlowUpcoming"[\s\S]*?configurationDisplayName\("Jumu'ah and fasts"\)/, 'the separate widget keeps its earlier look');
});
