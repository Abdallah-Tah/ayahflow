// Page layout (Tanzil Madani page boundaries), highlights and notes (schema v16), the verse menu and the Mushaf chooser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_COUNT, PAGE_STARTS, pageOf, pageAyahs, SURAH_DATA, verse, juzOf, JUZ_STARTS } from '../www/js/data.js';
import { initialState, validateState, exportable, setHighlight, setNote, STATE_VERSION, NOTE_MAX } from '../www/js/engine.js';
import { pageBody, easyBody, readerTitle, readingStyles, surahHead, toEndOfJuz, startPage, clampPage, MUSHAF_EDITIONS } from '../www/js/mushaf.js';
import { translation } from '../www/js/data.js';

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
    assert.equal(STATE_VERSION, 17);
    const v15 = JSON.parse(JSON.stringify({ ...initialState(), version: 15, xp: 54, bookmarks: ['2:255'], readPosition: { surah: 18, ayah: 10 }, readingLayout: 'flow' }));
    delete v15.highlights; delete v15.notes;
    const m = validateState(v15);
    assert.equal(m.version, 17); assert.deepEqual(m.highlights, []); assert.deepEqual(m.notes, []);
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

test('Mushaf page body: verbatim text, a heading only where a surah begins, unique ids, marks shown', () => {
    let s = { ...initialState(), readPosition: { surah: 7, ayah: 23 } };
    assert.equal(startPage(s), 153);
    s = setNote(setHighlight(s, 7, 23, 'rose', 1), 7, 24, 'note', 1);
    const html = pageBody(s, 153, '7:25');
    for (const [su, a] of pageAyahs(153)) assert.ok(html.includes(esc(verse(su, a))), `${su}:${a} verbatim`);
    assert.match(html, /class="q-v hl hl-rose" id="v-7-23"/);
    assert.match(html, /id="v-7-24"[^>]*has a note/);
    assert.match(html, /class="q-v selected" id="v-7-25"/);
    assert.ok(!html.includes('q-surah'), 'no surah starts on page 153');
    const last = pageBody(initialState(), 604);
    assert.equal((last.match(/class="q-surah"/g) ?? []).length, 3);
    assert.equal((last.match(/class="q-basmala"/g) ?? []).length, 3);
    const ids = [...last.matchAll(/id="(v-[^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    const two = pageBody(initialState(), 106);
    assert.ok(two.indexOf('id="v-4-176"') < two.indexOf('class="q-surah"') && two.indexOf('class="q-surah"') < two.indexOf('id="v-5-1"'), 'An-Nisa ends, then Al-Ma’ida begins');
    assert.match(pageBody(initialState(), 1), /q-opening/);
    assert.ok(!/class="q-basmala"/.test(pageBody(initialState(), 1)), 'Al-Fatiha’s basmala is its first ayah, not a separate line');
    assert.ok(!/class="q-basmala"/.test(pageBody(initialState(), pageOf(9, 1))), 'At-Tawba has no basmala');
    assert.match(surahHead(2, 'en'), /سورة البقرة/);
});

test('Reader title: page and juz’ for pages, juz’ range for a surah, in the reader’s language', () => {
    const en = readerTitle(initialState(), 'page', 153, 7);
    assert.deepEqual(en, { title: "Al-A'raaf", sub: 'Page 153 · Juz’ 8' });
    assert.equal(readerTitle(initialState(), 'page', 604, 112).title, 'Al-Ikhlaas · Al-Falaq · An-Naas');
    assert.match(readerTitle({ ...initialState(), locale: 'ar' }, 'page', 153, 7).sub, /صفحة (153|١٥٣) · الجزء (8|٨)/);
    assert.match(readerTitle(initialState(), 'flow', 1, 7).sub, /Juz’ 8–9 · 206 ayahs/);
});

test('Easy reading: whole surah verbatim, optional Pickthall under each verse, ids for voice following', () => {
    const plain = easyBody(initialState(), 112, null, false);
    for (let a = 1; a <= 4; a++) assert.ok(plain.includes(esc(verse(112, a))) && plain.includes(`id="ayah-${a}"`));
    assert.ok(!plain.includes('e-tr'));
    const withTr = easyBody(initialState(), 112, '112:2', true);
    assert.ok(withTr.includes(esc(translation(112, 1))) && withTr.includes('Pickthall'));
    assert.match(withTr, /class="q-v selected" id="ayah-2"/);
    assert.match(easyBody(initialState(), 1, null, false, t => `<w>${t}</w>`), /<w>/, 'the app’s word spans are used');
});

test('Reading styles: three real layouts with live previews, honest features, themes; editions not in the app are secondary', () => {
    assert.deepEqual(MUSHAF_EDITIONS.filter(e => e.available).map(e => e.id), ['tanzil-madani']);
    for (const e of MUSHAF_EDITIONS) assert.ok(e.name.every(Boolean) && e.note.every(Boolean), e.id);
    const html = readingStyles({ ...initialState(), readingLayout: 'page', readingTheme: 'night' });
    assert.deepEqual([...html.matchAll(/data-layout="(\w+)"/g)].map(m => m[1]), ['page', 'flow', 'cards']);
    assert.match(html, /class="s-card on" data-action="layout" data-layout="page" aria-pressed="true"/);
    assert.match(html, /not the printed 15-line layout/);
    assert.ok(!/exact|authentic/i.test(html), 'never claims to be the printed page');
    assert.match(html, /data-theme="night" aria-pressed="true"/);
    assert.match(html, /<details class="s-others">[\s\S]*King Fahd Complex[\s\S]*Quran Foundation/);
    assert.ok(!/<img|url\(/.test(html));
    assert.ok(!/role="tablist"/.test(html), 'no tabs for scripts that are not available');
    assert.match(readingStyles({ ...initialState(), locale: 'fr' }), /Style de lecture/);
    assert.match(readingStyles({ ...initialState(), locale: 'ar' }), /طريقة القراءة/);
});

test('Migration v16 → v17: reading theme auto and middle text size; nothing else changes', () => {
    const v16 = JSON.parse(JSON.stringify({ ...initialState(), version: 16, readingLayout: 'page', highlights: [{ key: '7:23', color: 'gold', at: 1 }], notes: [{ key: '2:255', text: 'x', at: 1 }] }));
    delete v16.readingTheme; delete v16.readerSize;
    const m = validateState(v16);
    assert.equal(m.version, 17); assert.equal(m.readingTheme, 'auto'); assert.equal(m.readerSize, 2);
    assert.equal(m.readingLayout, 'page'); assert.deepEqual(m.highlights, v16.highlights); assert.deepEqual(m.notes, v16.notes);
    for (const bad of [{ readingTheme: 'sepia' }, { readerSize: 7 }, { readerSize: -1 }, { readerSize: 1.5 }])
        assert.throws(() => validateState({ ...initialState(), ...bad }), /reading settings/);
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
