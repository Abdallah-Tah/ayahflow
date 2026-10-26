// Page layout (Tanzil Madani page boundaries), highlights and notes (schema v16), the verse menu and the Mushaf chooser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_COUNT, PAGE_STARTS, pageOf, pageAyahs, SURAH_DATA, verse, juzOf, JUZ_STARTS } from '../www/js/data.js';
import { initialState, validateState, exportable, setHighlight, setNote, STATE_VERSION, NOTE_MAX } from '../www/js/engine.js';
import { pageView, mushafChooser, toEndOfJuz, startPage, clampPage, MUSHAF_EDITIONS } from '../www/js/mushaf.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('604 pages cover every ayah once, in order, and agree with pageOf', () => {
    assert.equal(PAGE_COUNT, 604);
    const seen = [];
    for (let p = 1; p <= PAGE_COUNT; p++) for (const [s, a] of pageAyahs(p)) { assert.equal(pageOf(s, a), p, `${s}:${a}`); seen.push(`${s}:${a}`); }
    const all = SURAH_DATA.flatMap(s => s.verses.map((_, i) => `${s.id}:${i + 1}`));
    assert.deepEqual(seen, all);
    assert.deepEqual(pageAyahs(1).map(x => x.join(':')), ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
    assert.deepEqual(PAGE_STARTS[1], [2, 1]);
    assert.equal(pageOf(7, 23), 153, 'Al-A‘raf 23 is on page 153, as in the printed Madani Mushaf');
    assert.deepEqual([...new Set(pageAyahs(604).map(([s]) => s))], [112, 113, 114]);
    assert.throws(() => pageAyahs(0)); assert.throws(() => pageAyahs(605));
    assert.equal(clampPage(0), 1); assert.equal(clampPage(999), 604); assert.equal(clampPage(NaN), 1);
    assert.match(read('scripts/import-quran.mjs'), /pages\.length !== 604/);
});

test('Play to the end of the juz’ stops before the next juz’ and never runs past An-Nas', () => {
    const list = toEndOfJuz(7, 23);
    assert.deepEqual(list[0], [7, 23]); assert.deepEqual(list.at(-1), [7, 87]); assert.deepEqual(JUZ_STARTS[8], [7, 88]);
    assert.ok(list.every(([s, a]) => juzOf(s, a) === 8));
    assert.deepEqual(toEndOfJuz(114, 1).at(-1), [114, 6]);
    assert.throws(() => toEndOfJuz(1, 8));
});

test('Migration v15 → v16 keeps everything and adds empty highlights and notes; the page layout is valid only from v16', () => {
    assert.equal(STATE_VERSION, 16);
    const v15 = JSON.parse(JSON.stringify({ ...initialState(), version: 15, xp: 54, bookmarks: ['2:255'], readPosition: { surah: 18, ayah: 10 }, readingLayout: 'flow' }));
    delete v15.highlights; delete v15.notes;
    const m = validateState(v15);
    assert.equal(m.version, 16); assert.deepEqual(m.highlights, []); assert.deepEqual(m.notes, []);
    assert.equal(m.xp, 54); assert.deepEqual(m.bookmarks, ['2:255']); assert.deepEqual(m.readPosition, { surah: 18, ayah: 10 }); assert.equal(m.readingLayout, 'flow');
    assert.throws(() => validateState({ ...v15, readingLayout: 'page' }), /theme|layout|Invalid/);
    assert.equal(validateState(JSON.parse(JSON.stringify({ ...initialState(), readingLayout: 'page' }))).readingLayout, 'page');
    for (const bad of [[{ key: '1:8', color: 'gold', at: 1 }], [{ key: '1:1', color: 'red', at: 1 }], [{ key: '1:1', color: 'gold', at: 1 }, { key: '1:1', color: 'blue', at: 2 }], [{ key: '1:1', color: 'gold' }]])
        assert.throws(() => validateState({ ...initialState(), highlights: bad }), /highlights/);
    for (const bad of [[{ key: '1:1', text: '', at: 1 }], [{ key: '1:1', text: 'x'.repeat(NOTE_MAX + 1), at: 1 }], [{ key: '115:1', text: 'x', at: 1 }]])
        assert.throws(() => validateState({ ...initialState(), notes: bad }), /notes/);
});

test('Highlights and notes: set, change, clear, idempotent, exported, and gone after delete', () => {
    let s = initialState();
    s = setHighlight(s, 7, 23, 'gold', 1);
    assert.deepEqual(s.highlights, [{ key: '7:23', color: 'gold', at: 1 }]);
    assert.equal(setHighlight(s, 7, 23, 'gold', 2), s, 'same colour again changes nothing');
    s = setHighlight(s, 7, 23, 'blue', 3);
    assert.deepEqual(s.highlights, [{ key: '7:23', color: 'blue', at: 3 }]);
    assert.deepEqual(setHighlight(s, 7, 23, null, 4).highlights, []);
    assert.throws(() => setHighlight(s, 1, 8, 'gold', 1)); assert.throws(() => setHighlight(s, 1, 1, 'red', 1));
    s = setNote(s, 2, 255, '  Learn this one  ', 5);
    assert.deepEqual(s.notes, [{ key: '2:255', text: 'Learn this one', at: 5 }]);
    assert.equal(setNote(s, 2, 255, 'Learn this one', 6), s);
    assert.deepEqual(setNote(s, 2, 255, '   ', 7).notes, [], 'blank deletes');
    assert.throws(() => setNote(s, 2, 255, 'x'.repeat(NOTE_MAX + 1), 8));
    const out = exportable(s);
    assert.deepEqual(out.highlights, s.highlights); assert.deepEqual(out.notes, s.notes);
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(out))).notes, s.notes, 'an export imports back');
    assert.deepEqual(initialState().highlights, []); assert.deepEqual(initialState().notes, []);
});

test('Page view: verbatim text, banners where a surah starts, unique ids, marks shown, Mushaf page order', () => {
    let s = { ...initialState(), readPosition: { surah: 7, ayah: 23 } };
    assert.equal(startPage(s), 153);
    s = setNote(setHighlight(s, 7, 23, 'rose', 1), 7, 24, 'note', 1);
    const html = pageView(s, 153, '7:25');
    for (const [su, a] of pageAyahs(153)) assert.ok(html.includes(esc(verse(su, a))), `${su}:${a} verbatim`);
    assert.match(html, /class="page-ayah hl hl-rose" id="v-7-23"/);
    assert.match(html, /id="v-7-24"[^>]*has a note/);
    assert.match(html, /class="page-ayah selected" id="v-7-25"/);
    assert.ok(!html.includes('page-banner'), 'no surah starts on page 153');
    const last = pageView(initialState(), 604);
    assert.equal((last.match(/page-banner/g) ?? []).length, 3);
    const ids = [...last.matchAll(/id="(v-[^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.match(pageView(initialState(), 1), /data-page="2" aria-label="Next page"[\s\S]*disabled[^>]*>/);
    assert.ok(pageView(initialState(), 1).indexOf('Next page') < pageView(initialState(), 1).indexOf('Previous page'), 'next page on the left');
    assert.match(pageView({ ...initialState(), locale: 'ar' }, 153), /صفحة (153|١٥٣) · الجزء (8|٨)/);
});

test('Mushaf chooser: only the shipped edition is offered; the rest say why, with no borrowed images', () => {
    assert.deepEqual(MUSHAF_EDITIONS.filter(e => e.available).map(e => e.id), ['tanzil-madani']);
    for (const e of MUSHAF_EDITIONS) assert.ok(e.name.every(Boolean) && e.note.every(Boolean), e.id);
    const u = mushafChooser('en', 'uthmani');
    assert.match(u, /In use/); assert.match(u, /Not available: their page fonts and line layout belong to the King Fahd Complex/);
    assert.ok(!/<img|url\(/.test(u));
    assert.match(mushafChooser('fr', 'tajweed'), /Indisponible : aucune coloration/);
    assert.match(mushafChooser('ar', 'indopak'), /غير متاح/);
});

test('App wiring: the verse menu has every action and audio needs consent', () => {
    const app = read('src/app.ts');
    const menu = app.slice(app.indexOf('function openVerseMenu('), app.indexOf('function readerView('));
    for (const a of ['play-juz', 'repeat', 'highlight', 'colour', 'note', 'translation', 'copy', 'share', 'bookmark'])
        assert.ok(menu.includes(`'${a}'`), a);
    assert.match(menu, /if \(!state\.audioConsent\) \{ toast\(t\('audioDisabled'\)\); return; \}/);
    assert.match(menu, /tafsirUnavailable/);
    assert.match(read('src/audio.ts'), /onEnded\?\.\(\)/);
});
