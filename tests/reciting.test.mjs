// Highlighting the ayah being recited: derived from the playing audio's URL, never saved, never moving the plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audioUrl, ayahOfAudioUrl, SURAH_DATA } from '../www/js/data.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Every ayah\'s recitation URL maps back to that ayah; other audio maps to nothing', () => {
    let n = 0;
    for (const s of SURAH_DATA) for (let a = 1; a <= s.count; a++) { assert.deepEqual(ayahOfAudioUrl(audioUrl(s.id, a)), [s.id, a]); n++; }
    assert.equal(n, 6236);
    assert.equal(ayahOfAudioUrl('blob:capacitor://localhost/123'), null);
    assert.equal(ayahOfAudioUrl('./sounds/athan-makkah.mp3'), null);
    assert.equal(ayahOfAudioUrl('https://cdn.islamic.network/quran/audio/128/ar.alafasy/6237.mp3'), null);
});

test('Wiring: follows audio events, repaints after each render, page turns are not saved', () => {
    const app = read('src/app.ts');
    assert.match(app, /followRecitation\(detail\.status, detail\.url\);/);
    assert.match(app, /syncCompass\(\); showReciting\(false\); \}/);
    const show = app.slice(app.indexOf('function showReciting'), app.indexOf('// ---- Home shortcuts'));
    assert.doesNotMatch(show, /goToPage\(|turnedPage\(/, 'following the reciter never advances the Quran plan');
    assert.match(show, /void commit\(\{ \.\.\.state, readPosition: \{ surah: s, ayah: a \} \}\)/, 'only the reading place moves with it');
    assert.match(read('public/style.css'), /\.q-v\.reciting\{/);
});
