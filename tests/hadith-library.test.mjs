// Hadith library: an-Nawawi's Forty and the Forty Qudsi, Arabic, verbatim from the public-domain dataset, unreviewed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const L = JSON.parse(readFileSync(new URL('../content/hadith/library.json', import.meta.url), 'utf8'));

test('Two collections, every hadith present once with Arabic text, source pinned, marked unreviewed', () => {
    assert.equal(L.dataset, 'fawazahmed0/hadith-api@1'); assert.equal(L.reviewed, false); assert.match(L.licence, /Unlicense/);
    assert.deepEqual(L.collections.map(c => [c.id, c.items.length]), [['nawawi', 42], ['qudsi', 40]]);
    for (const c of L.collections) {
        assert.match(c.sha256, /^[0-9a-f]{64}$/); assert.match(c.url, /^https:\/\/sunnah\.com\/(nawawi40|qudsi40)$/);
        assert.equal(new Set(c.items.map(h => h.n)).size, c.items.length, c.id);
        for (const h of c.items) { assert.match(h.text, /[؀-ۿ]/, `${c.id} ${h.n}`); assert.doesNotMatch(h.text, /[A-Za-z]{4,}/, `${c.id} ${h.n}: Arabic only`); }
    }
    assert.ok(L.collections[0].items[0].text.includes('الْأَعْمَالُ بِالنِّيَّاتِ'));
});

test('Shown verbatim with the unreviewed note; search is local; loaded only when opened', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /function hadithView[\s\S]*?hadithNote/);
    assert.match(app, /escapeHtml\(h\.text\)/);
    assert.match(app, /await import\('\.\/hadith-data\.js'\)/);
    assert.doesNotMatch(app.slice(app.indexOf('function hadithList'), app.indexOf('function hadithView')), /fetch\(/);
});
