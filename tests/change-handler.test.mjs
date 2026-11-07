// Every control the change listener handles must get past its filter at the top (Jumu'ah, fast, suhoor, iftar and
// occasion reminders, the Fajr alarm, the memorisation range and the Eid card line were once filtered out).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');

test('No handled id is filtered out of the change listener', () => {
    const start = app.indexOf("root.addEventListener('change', async (e) => {"), end = app.indexOf("document.querySelector<HTMLInputElement>('#import-file')", start);
    const listener = app.slice(start, end), head = listener.slice(0, listener.indexOf('return; try {'));
    const allowed = new Set([...head.split('].includes')[0].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
    const prefixes = [...head.matchAll(/startsWith\('([a-z-]+)'\)/g)].map(m => m[1]);
    const body = listener.slice(head.length);
    const handled = new Set([...body.matchAll(/el\.id === '([a-z0-9-]+)'/g)].map(m => m[1]));
    const passes = (id) => allowed.has(id) || prefixes.some(p => id.startsWith(p));
    assert.ok(handled.size >= 15, `${handled.size} handled ids`);
    assert.deepEqual([...handled].filter(id => !passes(id)), []);
    for (const p of body.matchAll(/el\.id\.startsWith\('([a-z-]+)'\)/g)) assert.ok(passes(`${p[1]}x`) || allowed.has(p[1]) || [...allowed].some(a => a.startsWith(p[1])), `prefix ${p[1]}`);
    for (const id of ['jumuah-remind', 'fajr-alarm-on', 'hifz-surah', 'occ-remind-arafah', 'card-note']) assert.ok(passes(id), id);
});
