// Quran integrity of the rendered Mushaf pages: every verse on all 604 pages, read back from the page markup with only
// the markup removed, is the Tanzil text exactly (no normalisation). Also the page structure (headings, basmala, running
// header, medallions) and the word grouping that keeps marks with their words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAGE_COUNT, pageAyahs, pageOf, verse, chapter, juzOf, hizbOf, SURAH_DATA, AYAH_TOTAL } from '../www/js/data.js';
import { initialState, setHighlight, setNote } from '../www/js/engine.js';
import { pageBody, pageWords, pageRunHead, pageRunFoot, easyBody } from '../www/js/mushaf.js';

const unescape = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
const arabicDigits = new Intl.NumberFormat('ar-u-nu-arab');
/** Every verse on a rendered page, in order: its reference, its text with the markup stripped, and its medallion digits. */
function versesOf(html) {
    return [...html.matchAll(/<span class="q-v[^"]*" id="v-(\d+)-(\d+)"[^>]*>([\s\S]*?)<span class="ayah-end"[^>]*>([\s\S]*?)<\/span><\/span><\/span>/g)]
        .map(m => ({ s: Number(m[1]), a: Number(m[2]), text: unescape(m[3].replace(/<[^>]+>/g, '')).replace(/ $/, ''), marker: m[4].replace(/<[^>]+>/g, '') }));
}
const state = initialState();

test('All 604 pages: every verse once, in Mushaf order, and its text exactly the Tanzil string', () => {
    assert.equal(PAGE_COUNT, 604);
    const seen = [];
    for (let p = 1; p <= PAGE_COUNT; p++) {
        const html = pageBody(state, p), got = versesOf(html);
        assert.deepEqual(got.map(v => `${v.s}:${v.a}`), pageAyahs(p).map(x => x.join(':')), `page ${p}: the verses of its Madani page, in order`);
        for (const v of got) {
            assert.equal(v.text, verse(v.s, v.a), `${v.s}:${v.a} on page ${p} is the corpus text, unchanged`);
            assert.equal(v.marker, arabicDigits.format(v.a), `${v.s}:${v.a}: the medallion carries its own number`);
            seen.push(`${v.s}:${v.a}`);
        }
    }
    assert.equal(seen.length, AYAH_TOTAL); assert.equal(AYAH_TOTAL, 6236); assert.equal(new Set(seen).size, 6236);
    assert.deepEqual(seen, SURAH_DATA.flatMap(s => s.verses.map((_, i) => `${s.id}:${i + 1}`)));
});

test('Highlights, notes and the selected verse change only the wrapper, never the verse text', () => {
    const s = setNote(setHighlight(state, 7, 89, 'gold', 1), 7, 92, 'note', 1);
    const plain = versesOf(pageBody(state, 162)), marked = versesOf(pageBody(s, 162, '7:90'));
    assert.deepEqual(marked.map(v => v.text), plain.map(v => v.text));
    assert.match(pageBody(s, 162), /class="q-v hl hl-gold" id="v-7-89"/);
});

test('Every letter and mark of the corpus reaches the page: the same code points, the same counts', () => {
    const count = (texts) => { const m = new Map(); for (const t of texts) for (const c of t) m.set(c, (m.get(c) ?? 0) + 1); return m; };
    const rendered = [], source = [];
    for (let p = 1; p <= PAGE_COUNT; p++) for (const v of versesOf(pageBody(state, p))) { rendered.push(v.text); source.push(verse(v.s, v.a)); }
    assert.deepEqual([...count(rendered)].sort(), [...count(source)].sort());
    // Marks that are easy to lose: superscript alif, small high/low letters, rounded zero, pause signs, sajdah, hizb.
    for (const c of ['ٰ', '۟', 'ۥ', 'ۦ', 'ۭ', 'ۖ', 'ۗ', 'ۚ', '۩', '۞', 'ۢ'])
        assert.ok(count(rendered).get(c) > 0, `U+${c.codePointAt(0).toString(16).toUpperCase()} shown`);
});

test('Page 1 (Al-Fatihah), 2 (Al-Baqarah 1–5), 162 (Al-A‘raf 88–95) and 604 (the last three surahs)', () => {
    const one = pageBody(state, 1);
    assert.deepEqual(versesOf(one).map(v => `${v.s}:${v.a}`), ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
    assert.match(one, /q-opening/); assert.equal((one.match(/class="q-surah"/g) ?? []).length, 1);
    assert.ok(!one.includes('q-basmala'), 'Al-Fatihah’s basmala is its first ayah, not a heading');
    const two = pageBody(state, 2);
    assert.deepEqual(versesOf(two).map(v => `${v.s}:${v.a}`), ['2:1', '2:2', '2:3', '2:4', '2:5']);
    assert.match(two, /q-opening/); assert.equal((two.match(/class="q-basmala"/g) ?? []).length, 1);
    assert.ok(two.indexOf('سورة البقرة') < two.indexOf('class="q-basmala"') && two.indexOf('class="q-basmala"') < two.indexOf('id="v-2-1"'));

    const p162 = pageBody(state, 162);
    assert.deepEqual(versesOf(p162).map(v => `${v.s}:${v.a}`), ['7:88', '7:89', '7:90', '7:91', '7:92', '7:93', '7:94', '7:95']);
    assert.ok(!p162.includes('q-surah') && !p162.includes('q-basmala'), 'no surah starts on page 162');
    assert.match(pageRunHead(state, 162), /Juz’ 9, Hizb 17/);
    assert.match(pageRunHead({ ...state, locale: 'ar' }, 162), /الجزء (9|٩)، الحزب (17|١٧)/);
    assert.ok(!pageRunHead({ ...state, locale: 'ar' }, 162).includes('Al-A'), 'in Arabic the surah is named in Arabic only');
    assert.match(pageRunHead({ ...state, locale: 'fr' }, 162), /Al-A&#39;raaf <span class="r-run-ar" lang="ar" dir="rtl">الأعراف<\/span>/);
    assert.match(pageRunFoot(state, 162), />162</);
    // 7:88 opens with the hizb sign ۞, kept with the verse's first word; 7:92 (drawn wrongly before as one run) is whole.
    assert.ok(verse(7, 88).startsWith('۞ '));
    assert.match(p162, /id="v-7-88"[^>]*><span class="wg"><span class="w" data-w="0">۞<\/span> <span class="w" data-w="1">قَالَ<\/span><\/span>/);

    const last = pageBody(state, 604);
    assert.deepEqual([...new Set(versesOf(last).map(v => v.s))], [112, 113, 114]);
    assert.equal((last.match(/class="q-surah"/g) ?? []).length, 3); assert.equal((last.match(/class="q-basmala"/g) ?? []).length, 3);
    assert.deepEqual(versesOf(last).at(-1), { s: 114, a: 6, text: verse(114, 6), marker: '٦' });
});

test('Surah headings and the basmala only where a surah begins; none for At-Tawbah’s basmala', () => {
    for (let p = 1; p <= PAGE_COUNT; p++) {
        const html = pageBody(state, p), starts = pageAyahs(p).filter(([, a]) => a === 1).map(([s]) => s);
        assert.equal((html.match(/class="q-surah"/g) ?? []).length, starts.length, `page ${p}: headings`);
        assert.equal((html.match(/class="q-basmala"/g) ?? []).length, starts.filter(s => s !== 1 && s !== 9).length, `page ${p}: basmala`);
        for (const s of starts) {
            const head = html.indexOf(`سورة ${chapter(s).ar}<`), first = html.indexOf(`id="v-${s}-1"`);
            assert.ok(head >= 0 && head < first, `page ${p}: ${s} heading before its first ayah`);
            if (chapter(s).bismillah) assert.ok(html.indexOf(`>${chapter(s).bismillah}</p>`, head) < first, `${s}: Tanzil’s basmala, unchanged`);
        }
    }
    assert.equal(chapter(9).bismillah, null); assert.equal(chapter(1).bismillah, null);
});

test('Running header: Juz’ and Hizb come from each page’s first verse', () => {
    for (let p = 1; p <= PAGE_COUNT; p++) {
        const [s, a] = pageAyahs(p)[0];
        assert.ok(pageRunHead(state, p).includes(`Juz’ ${juzOf(s, a)}, Hizb ${hizbOf(s, a)}`), `page ${p}`);
    }
    assert.match(pageRunHead(state, 1), /Juz’ 1, Hizb 1/); assert.match(pageRunHead(state, 604), /Juz’ 30, Hizb 60/);
    assert.match(pageRunHead(state, 22), /Juz’ 2, Hizb 3/, 'page 22 opens with 2:142, the start of Juz’ 2');
});

test('Words: each in its own span; a mark written as a word stays on the line of the word it belongs to', () => {
    const strip = (groups) => unescape(groups.join(' ').replace(/<[^>]+>/g, ''));
    for (const s of SURAH_DATA) s.verses.forEach((text, i) => {
        const g = pageWords(text);
        assert.equal(strip(g), text, `${s.id}:${i + 1}`);
        for (const one of g) {
            const words = [...one.matchAll(/<span class="w" data-w="\d+">([^<]*)<\/span>/g)].map(m => m[1]);
            assert.ok(words.length >= 1);
            const marksOnly = (w) => /^[ۖ-ۜ۞۩]+$/.test(w);
            if (words.length > 1) assert.ok(words.filter(w => !marksOnly(w)).length >= 1, `${s.id}:${i + 1}: a group holds a word`);
            assert.ok(!(words.length === 1 && marksOnly(words[0])), `${s.id}:${i + 1}: no mark alone (${words[0]})`);
            if (words.length > 1 && words[0] !== '۞') assert.ok(!marksOnly(words[0]), 'a pause or sajdah sign never starts a group');
        }
    });
    // 7:206 ends with the sajdah sign: it stays with the verse's last word and the medallion.
    const end = pageBody(state, pageOf(7, 206));
    assert.match(end, /id="v-7-206"[\s\S]*?<span class="q-tail"><span class="wg"><span class="w" data-w="\d+">[^<]+<\/span> <span class="w" data-w="\d+">۩<\/span><\/span> <span class="ayah-end"/);
    // A one-word ayah (7:1) is its own tail; the longest (2:282) is whole.
    assert.equal(versesOf(pageBody(state, pageOf(7, 1))).find(v => v.a === 1).text, verse(7, 1));
    assert.equal(versesOf(pageBody(state, pageOf(2, 282))).find(v => v.a === 282).text, verse(2, 282));
    // Easy reading keeps its own word spans (voice following marks those).
    assert.match(easyBody(state, 112, null, (t) => t), /id="ayah-1"/);
});

test('Word spans add nothing to the text: no hidden or direction characters, one plain space between words', () => {
    const HIDDEN = /[­؜​-‏‪-‮⁠-⁩﻿]/;
    for (const s of SURAH_DATA) assert.ok(!s.verses.some(v => HIDDEN.test(v)), `${s.id}: the corpus has none either`);
    for (let p = 1; p <= PAGE_COUNT; p++) {
        const html = pageBody(state, p);
        assert.ok(!HIDDEN.test(html), `page ${p}: no zero-width, soft-hyphen or bidi control characters`);
        // Inside a verse: a word span holds one word with no space in it, and words are separated by exactly one space.
        for (const m of html.matchAll(/<span class="w" data-w="\d+">([^<]*)<\/span>/g)) assert.ok(m[1].length > 0 && !/\s/.test(m[1]), `page ${p}: "${m[1]}"`);
        assert.ok(!/<\/span>\s{2,}<span class="w/.test(html) && !/<\/span><span class="w"/.test(html), `page ${p}: words never run together or double-spaced`);
    }
});

test('Word indices follow the verse’s words (voice following counts the same tokens); every verse stays one button', () => {
    for (const p of [1, 2, 50, 162, 255, 442, 604]) {
        const html = pageBody(state, p);
        let checked = 0;
        for (const m of html.matchAll(/<span class="q-v[^"]*" id="v-(\d+)-(\d+)" data-action="verse-menu" data-surah="(\d+)" data-ayah="(\d+)" role="button" tabindex="0" aria-describedby="([^"]+)">([\s\S]*?)<span class="ayah-end" role="img" aria-label="Ayah (\d+)" lang="en">/g)) {
            const [, s, a, ds, da, described, inner, n] = m;
            assert.deepEqual([ds, da, n], [s, a, a], `${s}:${a}: the button and its medallion name this verse`);
            // VoiceOver reads a button by its content unless it has an aria-label: the content is the Arabic verse.
            assert.ok(!/aria-label/.test(m[0].slice(0, m[0].indexOf('>'))), `${s}:${a}: no aria-label hides the Quran text`);
            assert.equal(described, `v-${s}-${a}-ref`);
            const desc = html.match(new RegExp(`<span class="q-ref" id="${described}" lang="en" hidden>([^<]*)</span>`));
            assert.equal(desc?.[1], `${chapter(Number(s)).name.replace(/'/g, '&#39;')} ${s}:${a}`, `${s}:${a}: described by its reference`);
            const idx = [...inner.matchAll(/data-w="(\d+)"/g)].map(x => Number(x[1]));
            assert.deepEqual(idx, verse(Number(s), Number(a)).split(' ').map((_, i) => i), `${s}:${a}: data-w 0…n−1 in order`);
            checked++;
        }
        assert.equal(checked, pageAyahs(p).length, `page ${p}: every verse checked`);
    }
});

test('Right to left, in Arabic, and drawn in the chosen Quran font', () => {
    for (const p of [1, 2, 162, 604]) {
        const blocks = pageBody(state, p).match(/<p class="q-text"[^>]*>/g);
        assert.ok(blocks.length >= 1 && blocks.every(b => b.includes('lang="ar"') && b.includes('dir="rtl"')), `page ${p}`);
    }
    const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
    assert.match(css, /\.q-text\{font-family:var\(--arabic\);direction:rtl/);
    assert.match(css, /\.wg\{display:inline-block;white-space:nowrap\}/, 'a mark group is never broken or stretched inside');
});

test('Page fitting: readable minimum, scrolling instead of shrinking, even spacing, refit on any resize', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const fit = app.slice(app.indexOf('const READ_MIN'), app.indexOf('/** Plays verses one after another'));
    assert.match(fit, /const READ_MIN = 16, READ_MAX = 34;/);
    assert.match(fit, /let lo = READ_MIN,/, 'the search never goes below the readable minimum');
    assert.match(fit, /if \(size < READ_MIN\) break;/, 'evening the spacing never goes below it either');
    assert.match(fit, /surface\.classList\.toggle\('r-overflow', over\)/);
    assert.match(fit, /if \(over\) surface\.tabIndex = 0;/, 'a scrolling page can be scrolled from the keyboard');
    assert.match(fit, /new ResizeObserver/); assert.match(fit, /'orientationchange'/); assert.match(fit, /'loadingdone'/);
    assert.ok(!/kashida|ـ/.test(fit.replace(/no kashida/g, '')), 'no tatweel is inserted to justify');
    assert.match(app, /surfaceWatch\?\.observe\(fitOn\)/);
});

test('Landscape and tablets: lines stop at a readable width, never below the 16 px minimum, and scroll vertically', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
    const em = Number(app.match(/const MEASURE_EM = (\d+);/)[1]);
    assert.ok(em >= 22 && em <= 32, 'about 12–14 words a line');
    assert.match(css, new RegExp(`\\.q-page\\{[^}]*margin:auto;width:100%;max-width:${em}em;`), 'the CSS column is the same width fitPage assumes, centred');
    assert.match(app, /surface\.style\.setProperty\('--q-measure', `\$\{\(best \* MEASURE_EM\)\.toFixed\(1\)\}px`\)/);
    assert.match(css, /\.r-page \.r-surface>\.r-run,\.r-page \.r-surface>\.r-run-no\{width:100%;max-width:var\(--q-measure,none\);margin-inline:auto\}/, 'header and page number line up with the text');
    assert.match(css, /\.r-page \.r-surface\.r-overflow\{overflow-y:auto\}/, 'a page that does not fit scrolls vertically');
    assert.match(css, /\.r-page \.r-surface\.r-overflow \.q-page\{padding-block:\.3em\}/, 'marks of a scrolling page clear the header and the page number');
    assert.ok(!/\.r-page[^{]*\{[^}]*overflow-x:(auto|scroll)/.test(css), 'never a sideways scroll');
});

test('Screen readers hear the Quran text: each verse button is named by its Arabic content, described by its reference', () => {
    // Easy reading builds its verses the same way as the Mushaf page.
    const flow = easyBody(setHighlight(state, 112, 2, 'gold', 1), 112, null, (t) => t);
    const v2 = flow.match(/<span class="q-v[^"]*" id="ayah-2"[^>]*>/)[0];
    assert.ok(!v2.includes('aria-label'), 'no aria-label replaces the verse');
    assert.match(v2, /role="button" tabindex="0" aria-describedby="ayah-2-ref"/);
    assert.match(flow, /<span class="q-ref" id="ayah-2-ref" lang="en" hidden>Al-Ikhlaas 112:2 · highlighted<\/span>/);
    const inner = flow.slice(flow.indexOf(v2) + v2.length, flow.indexOf('<span class="ayah-end"', flow.indexOf(v2)));
    assert.equal(unescape(inner.replace(/<[^>]+>/g, '')).replace(/\u00a0$/, ''), verse(112, 2), 'the verse text is the button’s content, unchanged');
    // Arabic interface: the description and the medallion are said in Arabic.
    const ar = pageBody({ ...state, locale: 'ar' }, 604);
    assert.match(ar, /<span class="ayah-end" role="img" aria-label="[^"]+" lang="ar">/);
    assert.match(ar, /<span class="q-ref" id="v-112-1-ref" lang="ar" hidden>سورة الإخلاص 112:1<\/span>/);
    // The description is outside the verse span: reading a verse back from the markup still gives the corpus text.
    for (const p of [1, 162, 585]) for (const v of versesOf(pageBody(state, p))) assert.equal(v.text, verse(v.s, v.a));
});

test('Keyboard: a page of verses is one Tab stop, arrows move between verses, and closing the menu returns to the verse', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.ok(pageAyahs(585).length === 42, 'the page with the most verses');
    const rove = app.slice(app.indexOf('function roveVerses'), app.indexOf('/** Refits the page'));
    assert.match(rove, /v\.tabIndex = v === stop \? 0 : -1/, 'one verse is tabbable, the others are reached with the arrows');
    assert.match(app, /roveVerses\(\); \}/, 'render() sets the Tab stop in every reader layout');
    const keys = app.slice(app.indexOf("document.addEventListener('keydown', e => {\n    if (view !== 'reader'"), app.indexOf("root.addEventListener('click', e => {\n    const el = e.target as Element;"));
    assert.ok(!/view !== 'reader' \|\| state\.readingLayout !== 'page'/.test(keys.split('\n')[1]), 'Enter/Space open a verse in Easy reading too');
    assert.match(keys, /ArrowDown: vs\[i \+ 1\], ArrowUp: vs\[i - 1\], Home: vs\[0\], End: vs\[vs\.length - 1\]/);
    assert.match(keys, /e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowRight'/, 'left and right still turn the page');
    const done = app.slice(app.indexOf('const done = () => {'), app.indexOf('d.onclick = async e =>'));
    assert.match(done, /if \(keyboardUse\) back\.focus\(\{ preventScroll: true \}\)/, 'after keyboard use, focus goes back to the verse whose menu closed (not after a touch: no focus ring)');
    assert.ok(done.indexOf('top = surface?.scrollTop') < done.indexOf('d.close()'), 'the place is taken before close(), which scrolls in WebKit');
    assert.match(done, /now\.scrollTop = top/);
});

test('Reading place on a page that scrolls: kept when the page is redrawn or refitted', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const fit = app.slice(app.indexOf('function fitPage'), app.indexOf('/** Keyboard: the verses'));
    assert.match(fit, /place = scrolled > 0 \? surface\.scrollTop \/ scrolled : 0/);
    assert.match(fit, /surface\.scrollTop = over \? place \* \(surface\.scrollHeight - surface\.clientHeight\) : 0;/, 'a refit (rotation, a late font) keeps the place');
    const render = app.slice(app.indexOf('function render(): void'), app.indexOf('function render(): void') + 4000);
    assert.match(render, /kept = was \? \{ page: Number\(was\.querySelector<HTMLElement>\('\.q-page'\)\?\.dataset\.page\), top: was\.scrollTop \}/);
    assert.match(render, /if \(sf && kept\?\.page === readerPage\) sf\.scrollTop = kept\.top;/, 'redrawing the same page (a highlight, a bookmark) keeps the scroll; a new page starts at the top');
    assert.match(app, /const intent = dragIntent\(dx, dy, swipeFrom\.scrolls, swipeFrom\.on\.scrollTop !== swipeFrom\.top\);\n\s*if \(intent === 'scroll'\) \{ swipeFrom = null; return; \}/, 'a scroll never becomes a page turn');
    assert.match(app, /if \(!scrolled && Math\.abs\(dx\) > 60/, 'nor with Reduce Motion, where the page changes on release');
    // WebKit's showModal() scrolls the page (seen in the iOS 18.6 simulator: 296 → 212 px); every reader sheet puts it back.
    const sheet = app.slice(app.indexOf('function openSheet'), app.indexOf('const readingThemeResolved'));
    assert.match(sheet, /if \(surface && surface\.scrollTop !== top\) surface\.scrollTop = top;/);
    assert.equal((app.match(/openSheet\(d[,)]/g) ?? []).length, 3, 'the verse menu, reading settings and jump sheets');
    assert.ok(!/if \(!d\.open\) d\.showModal\(\);\n/.test(app.replace(sheet, '')), 'no reader sheet opens around it');
    const sheets = app.slice(app.indexOf('function sheetActions'), app.indexOf('/** Tajweed colours switch'));
    assert.ok(!/d\.close\(\)/.test(sheets), 'reading settings and jump close through closeSheet, which keeps the place');
    assert.match(app, /case 'sheet-close': \{\n\s*const sheet = el\.closest\('dialog'\);\n\s*if \(sheet\) closeSheet\(sheet\);/);
});
