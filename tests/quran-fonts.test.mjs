// Quran font choice: a saved setting (v22), fonts that ship with their licences, honest notes, and the same text in all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initialState, validateState, STATE_VERSION, QURAN_FONT_IDS } from '../www/js/engine.js';
import { QURAN_FONTS, quranFontChooser, readingStyles } from '../www/js/mushaf.js';
import { verse } from '../www/js/data.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const css = read('public/style.css').toString(), notices = read('docs/THIRD-PARTY-NOTICES.md').toString();
const FILES = { madina: 'AyahFlowQuran-Regular.ttf', amiri: 'AyahFlowQuranAmiri-Regular.ttf', 'me-quran': 'me_quran.ttf' };

test('v21 saves move to v22 with the font they already showed; nothing else changes', () => {
    assert.equal(STATE_VERSION, 23);
    assert.equal(initialState().quranFont, 'madina');
    const v21 = JSON.parse(JSON.stringify(initialState())); v21.version = 21; delete v21.quranFont; delete v21.calendar.occasions; v21.xp = 33; v21.arabicSize = 'l';
    const m = validateState(v21);
    assert.equal(m.version, 23); assert.equal(m.quranFont, 'madina'); assert.equal(m.xp, 33); assert.equal(m.arabicSize, 'l');
    for (const id of QURAN_FONT_IDS) assert.equal(validateState({ ...initialState(), quranFont: id }).quranFont, id);
    assert.throws(() => validateState({ ...initialState(), quranFont: 'uthman-taha' }), /Quran font/);
});

test('Every font offered ships, with its hash in the notices and in the URL, and a licence file', () => {
    const offered = QURAN_FONTS.filter(f => f.family).map(f => f.id);
    assert.deepEqual(offered, [...QURAN_FONT_IDS]);
    for (const id of offered) {
        const b = read(`public/fonts/${FILES[id]}`), f = QURAN_FONTS.find(x => x.id === id);
        assert(notices.includes(sha(b)), `${id}: hash in docs/THIRD-PARTY-NOTICES.md`);
        assert(css.includes(`@font-face{font-family:'${f.family}';src:url('./fonts/${FILES[id]}?v=${sha(b).slice(0, 12)}')`), `${id}: face with its hash`);
    }
    assert(existsSync(new URL('../public/fonts/OFL-AyahFlowQuran.txt', import.meta.url)) && existsSync(new URL('../public/fonts/LICENSE-me_quran.txt', import.meta.url)));
    assert.match(read('public/fonts/LICENSE-me_quran.txt').toString(), /Free for non commercial use/);
    // me_quran ships unmodified: the file is the downloaded one.
    assert.equal(sha(read('public/fonts/me_quran.ttf')), '83d56cab9933f9e3ac1361ac0e926324a1cc70f37c3bcc5b22f62f270160b4a0');
    // Only the chosen face is used: the root attribute picks one family for --arabic.
    assert.match(css, /--arabic:var\(--quran-face\),/);
    assert.match(css, /html\[data-quran-font=amiri\]\{--quran-face:'AyahFlow Quran Amiri'\}html\[data-quran-font=me-quran\]\{--quran-face:'me_quran'\}/);
    // The widgets keep the default font, whose du'a fit was measured.
    assert.equal(sha(read('ios/App/AyahFlowWidget/AyahFlowQuran-Regular.ttf')), sha(read('public/fonts/AyahFlowQuran-Regular.ttf')));
});

test('The chooser previews 7:38 as written in each font, marks the chosen one, and gives every unavailable font its reason', () => {
    const html = quranFontChooser({ ...initialState(), quranFont: 'amiri' });
    const words = verse(7, 38).split(' ').slice(0, 6).join(' ');
    assert.equal(html.split(words).length - 1, 3, 'one preview per available font, the verse unchanged');
    assert.match(html, /data-font="amiri" aria-pressed="true"/);
    for (const f of QURAN_FONTS.filter(x => !x.family)) assert(html.includes(f.note[0].replace(/’/g, '’')) && /^Not available: /.test(f.note[0]), f.id);
    assert.match(QURAN_FONTS.find(f => f.id === 'me-quran').note[0], /round circle/);
    for (const f of QURAN_FONTS) for (const n of f.note) assert(n.length > 20, f.id);
    assert(readingStyles(initialState()).includes('data-action="quran-font"'), 'also in the reader\'s reading-style chooser');
});
