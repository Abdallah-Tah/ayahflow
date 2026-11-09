// Memorisation practice: ranges stay inside one surah, the listening queue, hidden words; the session and the learner's
// own answers are saved (tests/daily.test.mjs), revealing words is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hifzRange, hifzQueue, hiddenWord, HIFZ_MAX_AYAHS } from '../www/js/hifz.js';
import { tr } from '../www/js/i18n.js';

test('Ranges never cross a surah boundary and stay short', () => {
    assert.deepEqual(hifzRange(112, 3, 9), { surah: 112, from: 3, to: 4 }, 'Al-Ikhlas has 4 ayahs');
    assert.deepEqual(hifzRange(2, 250, 300), { surah: 2, from: 250, to: 250 + HIFZ_MAX_AYAHS - 1 });
    assert.deepEqual(hifzRange(1, 5, 2), { surah: 1, from: 5, to: 5 }, 'to before from: one ayah');
    assert.deepEqual(hifzRange(1, 0, NaN), { surah: 1, from: 1, to: 1 });
    assert.deepEqual(hifzRange(114, 99, 99), { surah: 114, from: 6, to: 6 });
});

test('Each ayah repeated in order, then the range once to join them', () => {
    assert.deepEqual(hifzQueue(112, 1, 2, 3), [[112, 1], [112, 1], [112, 1], [112, 2], [112, 2], [112, 2], [112, 1], [112, 2]]);
    assert.deepEqual(hifzQueue(112, 1, 1, 2), [[112, 1], [112, 1]], 'one ayah: no joining pass');
});

test('Hidden words by level; the text is never changed; revealing a word saves nothing', () => {
    const idx = [0, 1, 2, 3, 4, 5];
    assert.deepEqual(idx.filter(i => hiddenWord(i, 0)), []);
    assert.deepEqual(idx.filter(i => hiddenWord(i, 1)), [2, 5]);
    assert.deepEqual(idx.filter(i => hiddenWord(i, 2)), [1, 3, 5]);
    assert.deepEqual(idx.filter(i => hiddenWord(i, 3)), idx);
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const view = app.slice(app.indexOf('function hifzVerse'), app.indexOf('function setHifzRange'));
    assert.match(view, /escapeHtml\(w\)/, 'hidden words keep the original text, only masked');
    const reveal = app.slice(app.indexOf("case 'hifz-reveal':"), app.indexOf("case 'hifz-whole':"));
    assert.doesNotMatch(reveal, /commit\(|applyAnswer|saveHifz/, 'showing a word or a verse is not evidence and is not saved');
    const assess = app.slice(app.indexOf("case 'hifz-assess':"), app.indexOf("case 'hifz-restart':"));
    assert.match(assess, /applyAnswer\(state, hifzItem\(h\.surah, a\), d\.correct === 'true', now, hifzEventId\(h, a\)\)/, 'the learner\'s answer goes through the review engine as recall');
    assert.match(assess, /a !== h\.at/, 'only the verse being recited can be answered');
    for (const k of ['hifzTitle', 'hifzShort', 'hifzSub', 'hifzWhat', 'hifzFrom', 'hifzTo', 'hifzMax', 'hifzListen', 'hifzPlay', 'hifzPlayNote', 'hifzNeedAudio', 'hifzTest', 'hifzShowAll', 'hifzHideSome', 'hifzHideHalf', 'hifzHideAll', 'hifzReveal', 'hifzHonest', 'hifzContinue', 'hifzAtVerse', 'hifzDoneShort', 'hifzProgress', 'hifzAsk', 'hifzSaidRecited', 'hifzSaidAgain', 'hifzRepeatVerse', 'hifzWholePassage', 'hifzOneAtATime', 'hifzFinished', 'hifzPractiseAgainOnes', 'hifzAgain', 'hifzNextVerses', 'difficultTitle', 'difficultSub', 'difficultPractise'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k, `${k} ${l}`);
    for (const l of ['en', 'fr', 'ar']) assert.doesNotMatch(tr('hifzHonest', l), /nothing is scored or saved|rien n’est noté|لا يُقيَّم/, 'the note no longer says nothing is saved');
    assert.match(tr('hifzHonest', 'en'), /Tajweed/, 'self-assessment is not a Tajweed check');
});
