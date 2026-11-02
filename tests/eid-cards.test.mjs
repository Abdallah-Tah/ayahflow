// Eid greeting cards: cited text only, never changed (only broken at spaces), shared through the share sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wrapWords, CARD_TEXTS, NOTE_MAX } from '../www/js/cards.js';
import { EID_TEXT } from '../www/js/eid.js';
import { inSource } from '../scripts/build-adhkar.mjs';
const E = JSON.parse(readFileSync(new URL('../content/eid/eid.json', import.meta.url), 'utf8'));

test('Line breaking keeps the text exactly: joined by spaces, the lines give it back', () => {
    const text = 'قُلْ بِفَضْلِ ٱللَّهِ وَبِرَحْمَتِهِۦ فَبِذَٰلِكَ فَلْيَفْرَحُوا۟ هُوَ خَيْرٌ مِّمَّا يَجْمَعُونَ';
    for (const max of [5, 40, 120, 1e6]) {
        const lines = wrapWords(text, s => s.length * 4, max);
        assert.equal(lines.join(' '), text, `max ${max}`);
        assert.ok(lines.every(l => l.length * 4 <= max || !l.includes(' ')), 'only a single long word may overflow');
    }
});

test('Card texts are the cited greeting (Bukhari 952, without the address) and Quran 10:58 from the corpus', () => {
    assert.deepEqual(CARD_TEXTS, ['eid-greeting', 'quran-10-58']);
    const g = E.items.find(i => i.id === 'eid-greeting');
    assert.equal(g.source.ref, 'bukhari:952'); assert.ok(inSource(g.full, g.text));
    assert.ok(!g.text.includes('بكر'), 'the Prophet\'s words alone');
    assert.ok(EID_TEXT.some(i => i.id === 'eid-greeting'));
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /text: quran \? verse\(10, 58\) : x\.text/);
    assert.match(app, /reference: quran \? `\$\{chapter\(10\)\.name\} 10:58` : `\$\{x\.source\.collection\} \$\{x\.source\.number\}`/);
    assert.equal(NOTE_MAX, 60);
});

test('Sharing goes through the share sheet only; the card and the user\'s line are not saved or sent anywhere', () => {
    const bridge = readFileSync(new URL('../native/bridge.mjs', import.meta.url), 'utf8');
    assert.match(bridge, /async shareImage\(data, name\) \{ await shareFile\(name, data\); \}/);
    const cards = readFileSync(new URL('../src/cards.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(cards, /fetch\(|XMLHttpRequest|localStorage|https?:\/\//);
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(app, /commit\([^)]*cardNote/, 'the personal line is never written to the saved state');
});
