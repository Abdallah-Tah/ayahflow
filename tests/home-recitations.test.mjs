// Home keeps the short passages from longer surahs for Salah next to today's verse (restored 2026-11-11 at the owner's
// request after 96b0459 moved them to the bottom of the Quran tab).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECITATIONS, recitation } from '../www/js/worship.js';

const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');

test('Home shows the Salah recitations and the daily verse right under the Ayah of the Moment', () => {
    const home = app.slice(app.indexOf('function homeView'), app.indexOf('/** Status choices for one prayer'));
    assert.match(home, /\$\{ayahWidget\(\)\}\$\{homeRecitations\(\)\}/);
    const tiles = app.slice(app.indexOf('function homeRecitations'), app.indexOf('function homeView'));
    assert.match(tiles, /data-view="recitations"/); assert.match(tiles, /t\('shortRecitations'\)/);
    assert.match(tiles, /data-view="verses"/);
    assert.match(app, /recitations: recitationsView/);
});

test('The passages are real, complete ranges from the source text', () => {
    assert.ok(RECITATIONS.length > 0);
    for (const r of RECITATIONS) {
        const ayahs = recitation(r.id).ayahs;
        assert.equal(ayahs.length, r.to - r.from + 1, r.id);
        assert.ok(ayahs.every(a => a.text.length > 0), r.id);
    }
});
