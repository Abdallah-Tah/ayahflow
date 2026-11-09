// Tajweed colouring: spans carried over exactly to our Tanzil text, colouring only, text unchanged, credit shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tajweedWords, TAJWEED_RULES } from '../www/js/tajweed.js';
import { initialState, validateState, STATE_VERSION } from '../www/js/engine.js';
const T = JSON.parse(readFileSync(new URL('../content/tajweed/tajweed.json', import.meta.url), 'utf8'));
const xml = readFileSync(new URL('../content/tanzil/quran-uthmani.xml', import.meta.url), 'utf8');
const ayah = (s, a) => new RegExp(`<sura index="${s}"[^>]*>[\\s\\S]*?<aya index="${a}" text="([^"]*)"`).exec(xml)[1];
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

test('Source pinned, CC BY 4.0 with credit, marked unreviewed; nearly all spans carried over', () => {
    assert.equal(T.source, 'cpfair/quran-tajweed@496f71cd191da00fa2a37ded79dbbddb033bb0ad'); assert.equal(T.licence, 'CC BY 4.0'); assert.equal(T.reviewed, false);
    assert.deepEqual(T.rules, [...TAJWEED_RULES]);
    assert.ok(T.kept / (T.kept + T.dropped) > 0.98, `${T.kept} kept, ${T.dropped} dropped`);
    const py = readFileSync(new URL('../scripts/build-tajweed.py', import.meta.url), 'utf8');
    assert.match(py, /151d616ad37a4cc21a80f20d5e1104c5b408375107ddd4d71247dea4c05ebf67/); assert.match(py, /abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2/);
});

test('Colouring never changes the text: without the tags every word is the original word', () => {
    for (const key of ['1:1', '2:255', '7:38', '112:1', '114:6', '36:1']) {
        const [s, a] = key.split(':'), text = ayah(s, a), spans = T.spans[key] ?? [];
        const words = tajweedWords(text, spans);
        assert.deepEqual(words.map(strip), text.split(' ').filter(Boolean), key);
        for (const [st, en] of spans) assert.ok(st >= 0 && en <= text.length && st < en, key);
    }
    assert.match(tajweedWords('ٱلرَّحْمَـٰنِ', [[0, 1, 0]])[0], /^<i class="tj tj-silent">ٱ<\/i>/);
    assert.deepEqual(tajweedWords('a&b <c>', [[0, 3, 17]]), ['<i class="tj tj-qalqalah">a&amp;b</i>', '&lt;c&gt;']);
});

test('Off by default (state v26, migrated off); loaded only when switched on; the notes say what it is', () => {
    assert.equal(STATE_VERSION, 28); assert.equal(initialState().tajweedColours, false);
    const v25 = JSON.parse(JSON.stringify(initialState())); v25.version = 25; delete v25.tajweedColours;
    assert.equal(validateState(v25).tajweedColours, false);
    assert.throws(() => validateState({ ...initialState(), tajweedColours: 'yes' }), /Tajweed/);
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /await import\('\.\/tajweed-data\.js'\)/);
    assert.match(app, /tajweedNote[\s\S]*?tajweedCredit/);
});
