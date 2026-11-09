// Tasbih look: a drawing choice only, migrated to the ring earlier builds showed, no new motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, TASBIH_THEMES } from '../www/js/engine.js';

test('v23 saves move to v24 with the ring look; counts and settings are kept; bad looks are rejected', () => {
    assert.equal(STATE_VERSION, 29);
    assert.deepEqual([...TASBIH_THEMES], ['ring', 'thread', 'plain', 'night']);
    const v23 = JSON.parse(JSON.stringify(initialState())); v23.version = 23; delete v23.worship.prefs.tasbihTheme;
    v23.worship.tasbih = [{ day: '2026-11-01', prayer: 'fajr', id: v23.worship.prefs.tasbihVariant, n: 40 }]; v23.worship.prefs.haptics = false;
    const m = validateState(v23);
    assert.equal(m.worship.prefs.tasbihTheme, 'ring'); assert.equal(m.worship.prefs.haptics, false); assert.deepEqual(m.worship.tasbih, v23.worship.tasbih);
    for (const v of TASBIH_THEMES) assert.equal(validateState({ ...initialState(), worship: { ...initialState().worship, prefs: { ...initialState().worship.prefs, tasbihTheme: v } } }).worship.prefs.tasbihTheme, v);
    assert.throws(() => validateState({ ...initialState(), worship: { ...initialState().worship, prefs: { ...initialState().worship.prefs, tasbihTheme: 'neon' } } }));
});

test('Both counters draw the chosen look; the looks add no animation', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8'), css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
    assert.equal((app.match(/beads\([^)]*state\.worship\.prefs\.tasbihTheme\)/g) ?? []).length, 2);
    for (const rule of css.match(/\.beads[.\s][^{]*\{[^}]*\}/g) ?? []) assert.doesNotMatch(rule, /animation|transition/, rule);
});
