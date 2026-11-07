// Eid view: cited narrations only, the athar labelled, Zakat al-Fitr quoted with no ruling, takbir from the Quran.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EID_TEXT, eidSections, currentEid } from '../www/js/eid.js';
import { tr } from '../www/js/i18n.js';
process.env.TZ = 'Asia/Riyadh';

test('Each Eid shows its own narrations, Zakat al-Fitr only before Eid al-Fitr', () => {
    const ids = (k) => eidSections(k).flatMap(s => s.items);
    assert.deepEqual(ids('eid-fitr'), ['our-eid', 'fitr-dates', 'eat-adha', 'other-route', 'ghusl', 'zakat-fitr', 'zakat-purpose']);
    assert.deepEqual(ids('eid-adha'), ['our-eid', 'eat-adha', 'other-route']);
    for (const id of [...ids('eid-fitr'), ...ids('eid-adha')]) {
        const x = EID_TEXT.find(e => e.id === id);
        assert.ok(x && x.text && x.source.collection, id);
        assert.equal(x.full, undefined, 'the full narration stays out of the bundle');
        for (const l of ['en', 'fr', 'ar']) assert.notEqual(tr(`eid_${id}`, l), `eid_${id}`, `${id} ${l}`);
    }
});

test('The next Eid, or today when it is Eid', () => {
    const next = currentEid(Date.parse('2026-11-01T09:00:00+03:00'));
    assert.equal(next.kind, 'eid-fitr'); assert.equal(next.today, false);
    const on = currentEid(next.occasion.at + 10 * 3600000);
    assert.equal(on.kind, 'eid-fitr'); assert.equal(on.today, true);
});

test('Wording rules: athar labelled, no ruling on Zakat al-Fitr, takbir and greeting omissions explained', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /x\.athar \? ` <span class="pill athar">\$\{t\('atharLabel'\)\}/);
    assert.match(app, /sec\.id === 'zakat' \? `<div class="notice mb16">\$\{ic\('info', 18\)\}<p>\$\{t\('zakatFitrNote'\)\}/);
    assert.match(app, /verse\(2, 185\)[\s\S]*?takbirNote/);
    for (const k of ['zakatFitrNote', 'takbirNote', 'eidGreetingNote', 'atharNote']) for (const l of ['en', 'fr', 'ar']) assert.notEqual(tr(k, l), k, `${k} ${l}`);
    assert.match(tr('zakatFitrNote', 'en'), /gives no ruling/);
    assert.match(app, /function eidView[\s\S]*?occSighting/, 'the sighting caveat beside the date');
});
