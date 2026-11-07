// Review stages are derived from the spaced-review schedule only; quiz and self-assessed recall are counted apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyAnswer, keyFor, reviewStage, stageCounts, retention } from '../www/js/engine.js';
const START = Date.parse('2026-01-05T09:00:00Z');
const item = (mode = 'next', surah = 112, ayah = 1) => ({ key: keyFor(mode, surah, ayah), mode, surah, ayah, reason: 'new' });
const advance = (state, c, ok, days, id) => applyAnswer(state, c, ok, START + days * 86400000, id);

test('Stages follow the interval and the retained rule, and a miss returns the card to Learning', () => {
    let s = initialState(); const k = item().key, seen = [];
    for (const [d, id] of [[0, 'a'], [1, 'b'], [3, 'c'], [7, 'd'], [16, 'e'], [36, 'f']]) { s = advance(s, item(), true, d, id); seen.push([s.cards[k].intervalDays, reviewStage(s.cards[k])]); }
    assert.deepEqual(seen, [[1, 'learning'], [2, 'learning'], [4, 'familiar'], [9, 'strong'], [20, 'mastered'], [44, 'mastered']]);
    assert.equal(retention(s.cards[k]), 'retained');
    s = advance(s, item(), false, 80, 'g');
    assert.equal(reviewStage(s.cards[k]), 'learning');
});

test('Same-day repeats cannot raise a stage, and untried cards have none', () => {
    let s = initialState();
    for (const id of ['a', 'b', 'c', 'd', 'e']) s = advance(s, item(), true, 0, id);
    assert.equal(reviewStage(s.cards[item().key]), 'learning');
    assert.equal(reviewStage({ ...s.cards[item().key], attempts: 0 }), null);
});

test('Quiz answers and self-assessed recall are counted separately', () => {
    let s = initialState();
    s = advance(s, item('next'), true, 0, 'q'); s = advance(s, item('recall'), true, 0, 'r'); s = advance(s, item('recall', 112, 2), false, 0, 'r2');
    const c = stageCounts(s);
    assert.deepEqual(c.quiz, { learning: 1, familiar: 0, strong: 0, mastered: 0 });
    assert.deepEqual(c['self-assessed'], { learning: 2, familiar: 0, strong: 0, mastered: 0 });
    assert.deepEqual(stageCounts(initialState()).quiz, { learning: 0, familiar: 0, strong: 0, mastered: 0 });
});
