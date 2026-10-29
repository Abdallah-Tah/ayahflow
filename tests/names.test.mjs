// The 99 Names: verbatim from Tirmidhi 3507, graded honestly, Tirmidhi 3506 for the authentic statement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAMES, NAMES_LIST, NAMES_ABOUT, NAMES_QURAN, nameOfDay } from '../www/js/names.js';
import { verse } from '../www/js/data.js';
import { plainKey } from '../scripts/build-adhkar.mjs';
import { splitNames } from '../scripts/build-names.mjs';
import { tr } from '../www/js/i18n.js';

test('Ninety-nine names, each verbatim and in order in the cited narration', () => {
    assert.equal(NAMES.length, 99);
    assert.deepEqual(NAMES.map(x => x.n), Array.from({ length: 99 }, (_, i) => i + 1));
    assert.equal(NAMES_LIST.ref, 'tirmidhi:3507');
    let at = 0;
    for (const { ar } of NAMES) { const i = NAMES_LIST.text.indexOf(ar, at); assert.ok(i >= 0, ar); at = i + ar.length; }
    assert.equal(plainKey(NAMES[0].ar), 'الله'); assert.equal(plainKey(NAMES[1].ar), 'الرحمن'); assert.equal(plainKey(NAMES[98].ar), 'الصبور');
    assert.equal(new Set(NAMES.map(x => plainKey(x.ar))).size, 99, 'no name twice');
    assert.deepEqual(splitNames('مَالِكُ الْمُلْكِ ذُو الْجَلاَلِ وَالإِكْرَامِ الْمُقْسِطُ'), ['مَالِكُ الْمُلْكِ', 'ذُو الْجَلاَلِ وَالإِكْرَامِ', 'الْمُقْسِطُ']);
});

test('Grades shown as published: the listing weak, the statement authentic', () => {
    assert.ok(NAMES_LIST.grades.length >= 3 && NAMES_LIST.grades.every(g => g.grade === 'Daif'));
    assert.equal(NAMES_ABOUT.ref, 'tirmidhi:3506');
    assert.ok(NAMES_ABOUT.grades.some(g => g.by === 'Al-Albani' && g.grade === 'Sahih'));
    assert.equal(plainKey(NAMES_ABOUT.text), plainKey('إِنَّ لِلَّهِ تِسْعَةً وَتِسْعِينَ اسْمًا مِائَةً غَيْرَ وَاحِدٍ مَنْ أَحْصَاهَا دَخَلَ الْجَنَّةَ'));
    for (const l of ['en', 'fr', 'ar']) { assert.match(tr('namesListNote', l), /\{source\}/); assert.match(tr('namesListNote', l), /\{grades\}/); }
});

test('Quran passages about the names exist and mention them; a name a day, stable and cycling', () => {
    assert.ok(plainKey(verse(7, 180)).includes('الاسماء الحسني'));
    assert.ok(plainKey(verse(17, 110)).includes('الاسماء الحسني'));
    assert.ok(plainKey(verse(59, 24)).includes('الاسماء الحسني'));
    for (const [s, a, b] of NAMES_QURAN) for (let n = a; n <= b; n++) verse(s, n);
    assert.equal(nameOfDay('2026-10-29').n, nameOfDay('2026-10-29').n);
    const seen = new Set(Array.from({ length: 99 }, (_, i) => { const d = new Date(Date.UTC(2026, 0, 1 + i)); return nameOfDay(d.toISOString().slice(0, 10)).n; }));
    assert.equal(seen.size, 99, 'every name once in 99 days');
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /\$\{nowCard\(\)\}\$\{namesEntry\(\)\}/);
    for (const k of ['namesTitle', 'nameOfDay', 'namesListNote', 'namesQuran', 'namesNoMeanings']) for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k);
});
