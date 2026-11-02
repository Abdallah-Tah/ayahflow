// Zakat calculator: arithmetic on typed prices only, quoted sources, no ruling, nothing saved or fetched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zakatFigures, parseAmount, GOLD_NISAB_G, SILVER_NISAB_G, RATE } from '../www/js/zakat.js';
import { EID_TEXT } from '../www/js/eid.js';
import { tr } from '../www/js/i18n.js';

test('Nisab for each priced metal, whether the amount reaches it, and 2.5% of the amount', () => {
    assert.deepEqual([GOLD_NISAB_G, SILVER_NISAB_G, RATE], [85, 595, 0.025]);
    assert.deepEqual(zakatFigures({ wealth: 10000, goldPerGram: 100, silverPerGram: 1.2 }), { lines: [{ metal: 'gold', nisab: 8500, reaches: true }, { metal: 'silver', nisab: 714, reaches: true }], share: 250 });
    assert.deepEqual(zakatFigures({ wealth: 5000, goldPerGram: 100, silverPerGram: null }).lines, [{ metal: 'gold', nisab: 8500, reaches: false }]);
    assert.deepEqual(zakatFigures({ wealth: 0, goldPerGram: null, silverPerGram: null }), { lines: [], share: null });
    assert.equal(zakatFigures({ wealth: 1234.56, goldPerGram: 1, silverPerGram: null }).share, 30.86);
});

test('Typed amounts: dot or comma, Arabic-Indic digits; anything else is not a number', () => {
    assert.equal(parseAmount('1.10'), 1.1); assert.equal(parseAmount('1,10'), 1.1); assert.equal(parseAmount('١٢٠٠٠'), 12000); assert.equal(parseAmount('١٫٥'), 1.5);
    for (const bad of ['', '-5', '1e3', 'abc', '1.2.3', 'Infinity']) assert.equal(parseAmount(bad), null, bad);
});

test('Sources quoted, the conversion labelled as not hadith text, no ruling, nothing saved or fetched', () => {
    for (const id of ['nisab-silver', 'nisab-gold']) assert.ok(EID_TEXT.find(x => x.id === id)?.source.collection, id);
    const src = readFileSync(new URL('../src/zakat.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|localStorage|https?:\/\//);
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(app, /commit\([^)]*zakatIn/);
    assert.match(tr('zakatNoRuling', 'en'), /gives no ruling/); assert.match(tr('zakatGrams', 'en'), /not hadith text/);
    assert.match(app, /function zakatView[\s\S]*?zakatNoRuling[\s\S]*?cited\('nisab-silver'\)\}\$\{cited\('nisab-gold'\)\}/);
});
