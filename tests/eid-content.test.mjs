// Eid, Zakat al-Fitr and fast narrations: verbatim slices of their cited source, with the athar labelled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inSource, plainKey } from '../scripts/build-adhkar.mjs';
const E = JSON.parse(readFileSync(new URL('../content/eid/eid.json', import.meta.url), 'utf8'));

test('Each Eid text is its cited narration, with reference, and only Malik 429 is an athar', () => {
    assert.equal(E.dataset, 'fawazahmed0/hadith-api@1');
    assert.deepEqual(E.items.map(i => i.id), ['our-eid', 'fitr-dates', 'eat-adha', 'other-route', 'ghusl', 'eid-greeting', 'zakat-fitr', 'zakat-purpose', 'arafah', 'ashura', 'tasua', 'ten-days']);
    for (const i of E.items) {
        assert.ok(inSource(i.full, i.text), i.id);
        assert.ok(i.source.collection && i.source.number && i.source.inBook, `${i.id}: reference`);
        assert.doesNotMatch(i.text, /[*?]|[‎‏]/, i.id);
    }
    assert.deepEqual(E.items.filter(i => i.athar).map(i => i.source.ref), ['malik:429']);
    assert.equal(E.items.find(i => i.id === 'ghusl').source.grades[0].grade, 'Mauquf Sahih');
    for (const id of ['zakat-purpose', 'ten-days']) assert.ok(E.items.find(i => i.id === id).source.grades.length, `${id}: graded`);
});

test('Zakat al-Fitr is quoted, never computed: no amount appears outside the narration', () => {
    const z = E.items.filter(i => i.group === 'zakat');
    assert.ok(plainKey(z[0].text).includes(plainKey('صاعا من تمر')));
    for (const i of z) assert.doesNotMatch(i.text, /[0-9٠-٩]/, i.id);
});
