// Arabic content integrity: every du'a, dhikr, narration and name the app shows, after the display layer
// (orthography, «،» reading pauses, ﴿ ﴾ around Quran quotations) of scripts/build-adhkar.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orthography, bare, inSource, plainKey } from '../scripts/build-adhkar.mjs';
import { tr } from '../www/js/i18n.js';
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const A = json('content/adhkar/adhkar.json'), sources = json('content/adhkar/sources.json').hadiths;
const R = json('content/ramadan/ramadan.json').items, N = json('content/names/names.json');
const texts = [
    ...A.adhkar.filter(e => e.text).map(e => [`adhkar ${e.id}`, e.text]),
    ...A.counters.flatMap(c => c.steps.map((s, i) => [`counter ${c.id}#${i}`, s.text])),
    ...A.library.flatMap(l => [[`library ${l.id}`, l.text], ...(l.virtue ? [[`virtue ${l.id}`, l.virtue]] : [])]),
    ...A.rotation.map(r => [`rotation ${r.id}`, r.text]),
    ...R.map(r => [`ramadan ${r.id}`, r.text]),
    ...N.names.map(n => [`name ${n.n}`, n.ar]), ['names about', N.about.text],
];
const MARKS = /[ً-ْ]/g;
const nfc = (s) => s.normalize('NFC');

test('Every displayed Arabic text uses the corrected spelling and encoding', () => {
    assert.ok(texts.length >= 160, `${texts.length} texts`);
    for (const [id, s] of texts) {
        assert.doesNotMatch(s, /ى[ً-ْ]/, `${id}: a yā' carrying a mark is written ي, not ى`);
        assert.doesNotMatch(s, /لا[ً-ْ]/, `${id}: the marks of lām-alif are on the lām`);
        assert.doesNotMatch(s, /[,;?.*]|�|[‎‏]|\{|\}/, `${id}: no Latin punctuation, asterisk, replacement or direction characters`);
        assert.match(s, /^[؀-ۿ﴾﴿ﷺ\s*]+$/, `${id}: Arabic letters, marks and Arabic punctuation only`);
        assert.equal(s, s.trim(), id);
        assert.doesNotMatch(s, /^،|،$|\s،|،،|، ،/, `${id}: a pause sits right after a word, never doubled or at an edge`);
    }
});

test('The display orthography changes encoding only: the same letters and the same marks', () => {
    for (const [ref, h] of Object.entries(sources)) {
        const o = orthography(h.text);
        assert.equal(plainKey(o), plainKey(h.text), ref);
        assert.deepEqual([...o.matchAll(MARKS)].map(m => m[0]).sort(), [...h.text.matchAll(MARKS)].map(m => m[0]).sort(), `${ref}: no mark added or lost`);
    }
    assert.equal(orthography('شَىْءٌ عَلَىَّ لاَ عَلَى'), 'شَيْءٌ عَلَيَّ لَا عَلَى');
    assert.equal(orthography('إِلا\u0651\u064E'), 'إِل\u0651\u064Eا', 'shadda and fatha move together');
});

test('Each text is its cited narration, differing only by reading pauses, brackets and orthography', () => {
    for (const e of A.adhkar.filter(x => x.text)) assert.ok(inSource(sources[e.source.ref].text, e.text), e.id);
    for (const r of R) assert.ok(inSource(r.full, r.text), r.id);
    // The pauses are reading aids: with them removed, the text is exactly the orthographic source slice.
    const after = A.adhkar.find(e => e.id === 'after-prayer').text;
    assert.equal(nfc(after), nfc('لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ'));
    assert.equal(bare(after), bare(sources['muslim:1342'].text.split('"')[1].replace(/[\u200E\u200F]/g, '')));
});

test('Quran quotations are bracketed and get no added pause', () => {
    const riding = A.adhkar.find(e => e.id === 'riding'), travel = A.adhkar.find(e => e.id === 'travel');
    assert.ok(nfc(riding.text).startsWith(nfc('﴿سُبْحَانَ الَّذِي سَخَّرَ لَنَا')) && nfc(riding.text).endsWith(nfc('لَمُنْقَلِبُونَ ۝١٤﴾')));
    assert.ok(nfc(travel.text).startsWith(nfc(riding.text + '، اللَّهُمَّ إِنَّا نَسْأَلُكَ')), 'the travel du\'a starts where the narration does');
    // The edition's «*» between 43:13 and 43:14 is shown as the ayah-end sign with the ayah's number, each ayah ending so.
    for (const e of [riding, travel]) assert.ok(nfc(e.text).includes(nfc('مُقْرِنِينَ ۝١٣ وَإِنَّا')), e.id);
    assert.ok(nfc(sources['abudawud:2602'].text).includes(nfc('مُقْرِنِينَ * وَإِنَّا')), 'the separator replaced is the source\'s own');
    for (const e of [riding, travel]) { assert.equal(e.quranRef, '43:13-14'); assert.doesNotMatch(e.text.match(/﴿[^﴾]*﴾/)[0], /،/); }
    for (const [id, s] of texts) assert.equal((s.match(/﴿/g) ?? []).length, (s.match(/﴾/g) ?? []).length, id);
    for (const id of ['dua-yunus', 'hasbunallah']) assert.doesNotMatch(A.library.find(l => l.id === id).text, /،/, id);
});

test('Repetition counts follow the narrations, and the three tasbih forms stay separate', () => {
    const c = Object.fromEntries(A.counters.map(x => [x.id, x]));
    const counts = (id) => c[id].steps.map(s => [plainKey(s.text).split(' ').slice(0, 2).join(' '), s.count]);
    assert.deepEqual(counts('tasbih-prayer'), [['سبحان الله', 33], ['الحمد لله', 33], ['الله اكبر', 33], ['لا اله', 1]]);
    assert.deepEqual(counts('tasbih-prayer-34'), [['سبحان الله', 33], ['الحمد لله', 33], ['الله اكبر', 34]]);
    assert.deepEqual(counts('tasbih-prayer-10'), [['سبحان الله', 10], ['الحمد لله', 10], ['الله اكبر', 10]]);
    for (const x of A.counters) assert.equal(x.total, x.steps.reduce((n, s) => n + s.count, 0), x.id);
    assert.equal(c['tasbih-prayer'].total, 100); assert.equal(c['tasbih-prayer-34'].total, 100); assert.equal(c['tasbih-prayer-10'].total, 30);
    assert.ok(c['istighfar-tawbah'].atLeast, '"more than seventy" is shown as 70+');
    const rep = Object.fromEntries(A.adhkar.map(e => [e.id, e.repeat]));
    assert.deepEqual(Object.entries(rep).filter(([, n]) => n !== 1), [['la-yadurr', 3], ['subhan-bihamdih', 100], ['three-quls', 3]]);
    for (const [id, ev] of [['la-yadurr', 'ثلاث مرات'], ['subhan-bihamdih', 'مائة مرة'], ['three-quls', 'ثلاث مرات']]) {
        const e = A.adhkar.find(x => x.id === id); assert.ok(plainKey(sources[e.source.ref].text).includes(plainKey(ev)), `${id}: count stated in the source`);
    }
});

test('No record lost or duplicated; every note has its text in three languages', () => {
    for (const k of ['adhkar', 'counters', 'library', 'rotation']) assert.equal(new Set(A[k].map(x => x.id)).size, A[k].length, k);
    assert.deepEqual([A.adhkar.length, A.counters.length, A.library.length, A.rotation.length, R.length, N.names.length], [23, 5, 16, 12, 2, 99]);
    const ret = A.adhkar.findIndex(e => e.id === 'travel-return');
    assert.equal(A.adhkar[ret - 1].id, 'travel'); assert.deepEqual(A.adhkar[ret].moments, ['travel']);
    assert.equal(nfc(A.adhkar[ret].text), nfc('آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ'));
    for (const e of A.adhkar.filter(x => x.note)) for (const l of ['en', 'fr', 'ar']) assert.notEqual(tr(l, e.note), e.note, `${e.id} ${l}`);
    assert.equal(nfc(A.library.find(l => l.id === 'salawat-nabi').text), nfc('اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ'));
});
