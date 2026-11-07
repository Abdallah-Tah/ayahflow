// Night beads: a fourth tasbih look. Drawing only: counts never come from it, and old saves keep the look they had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, TASBIH_THEMES, NIGHT_DESIGNS, NIGHT_SHAPES, NIGHT_SKIES, defaultNightBeads } from '../www/js/engine.js';
import { COUNTERS } from '../www/js/adhkar.js';
import { phoneticFor, cycleFor, markersFor, nearest, autoSkyAt, stepChoice } from '../www/js/night-beads.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = read('../src/app.ts'), module_ = read('../src/night-beads.ts'), css = read('../public/style.css');
const withNight = v => { const s = initialState(); return { ...s, worship: { ...s.worship, prefs: { ...s.worship.prefs, nightBeads: { ...s.worship.prefs.nightBeads, ...v } } } }; };

test('v26 saves move to v27 keeping their look, counts and settings; Night beads starts with the approved defaults', () => {
    assert.equal(STATE_VERSION, 27);
    assert.deepEqual([...TASBIH_THEMES], ['ring', 'thread', 'plain', 'night']);
    assert.equal(initialState().worship.prefs.tasbihTheme, 'ring');
    assert.deepEqual(defaultNightBeads(), { design: 'amber', shape: 'round', sky: 'auto', phonetic: true });
    for (const look of ['ring', 'thread', 'plain']) {
        const v26 = JSON.parse(JSON.stringify(initialState())); v26.version = 26; delete v26.worship.prefs.nightBeads;
        v26.worship.prefs.tasbihTheme = look; v26.worship.prefs.haptics = false; v26.counts = [{ day: '2026-11-01', id: 'istighfar', n: 57 }];
        const m = validateState(v26);
        assert.equal(m.version, 27); assert.equal(m.worship.prefs.tasbihTheme, look); assert.equal(m.worship.prefs.haptics, false);
        assert.deepEqual(m.counts, v26.counts); assert.deepEqual(m.worship.prefs.nightBeads, defaultNightBeads());
    }
    const v23 = JSON.parse(JSON.stringify(initialState())); v23.version = 23; delete v23.worship.prefs.nightBeads; delete v23.worship.prefs.tasbihTheme;
    assert.equal(validateState(v23).worship.prefs.tasbihTheme, 'ring');
    assert.deepEqual(validateState(v23).worship.prefs.nightBeads, defaultNightBeads());
});

test('Every choice is accepted, and anything else in a save is rejected', () => {
    assert.equal(NIGHT_DESIGNS.length, 10); assert.equal(NIGHT_SHAPES.length, 6); assert.deepEqual([...NIGHT_SKIES], ['auto', 'fajr', 'day', 'sunset', 'night']);
    for (const design of NIGHT_DESIGNS) assert.equal(validateState(withNight({ design })).worship.prefs.nightBeads.design, design);
    for (const shape of NIGHT_SHAPES) assert.equal(validateState(withNight({ shape })).worship.prefs.nightBeads.shape, shape);
    for (const sky of NIGHT_SKIES) assert.equal(validateState(withNight({ sky })).worship.prefs.nightBeads.sky, sky);
    for (const bad of [{ design: 'neon' }, { shape: 'star' }, { sky: 'noon' }, { phonetic: 'yes' }]) assert.throws(() => validateState(withNight(bad)));
    const none = initialState(); delete none.worship.prefs.nightBeads;
    assert.throws(() => validateState(none));
});

test('The phonetic line is only for the two istighfar phrases, matched to the exact source Arabic', () => {
    const texts = id => COUNTERS.find(c => c.id === id).steps[0].text;
    assert.equal(phoneticFor(texts('istighfar')), 'Astaghfirullah');
    assert.equal(phoneticFor(texts('istighfar-tawbah')), 'Astaghfirullah wa atubu ilayh');
    assert.equal(phoneticFor('أستغفر الله'), null); // not the source spelling
    for (const c of COUNTERS.filter(x => !x.id.startsWith('istighfar'))) for (const s of c.steps) assert.equal(phoneticFor(s.text), null);
    assert.match(app, /p\.phonetic && !o\.custom \? phoneticFor\(o\.text\) : null/);
    assert.match(read('../src/i18n.ts'), /nightPhoneticNote: \['[^']*Not yet reviewed by a qualified teacher/);
    assert.match(read('../docs/ARABIC-AUDIT.md'), /Astaghfirullah wa atubu ilayh/);
});

test('Strand rules: the minaret at the end of a round, dividers after each 33, short targets never show two minarets', () => {
    assert.equal(cycleFor(100), 100); assert.equal(cycleFor(33), 33); assert.equal(cycleFor(15), 15);
    assert.equal(cycleFor(3), 15); assert.equal(cycleFor(7), 21); assert.equal(cycleFor(1), 15);
    assert.deepEqual(markersFor(100), [33, 66]); assert.deepEqual(markersFor(99), [33, 66]); assert.deepEqual(markersFor(33), []); assert.deepEqual(markersFor(30), []); assert.deepEqual(markersFor(66), [33]);
    assert.equal(nearest(100, 0, 100), 0); assert.equal(nearest(0, 0, 100), 0); assert.equal(nearest(97, 0, 100), -3); assert.equal(nearest(103, 0, 100), 3); assert.equal(nearest(33, 33, 100), 0); assert.equal(nearest(232, 33, 100), -1);
    for (const total of [1, 3, 7, 10, 14, 15, 30, 33, 70, 100, 1000]) assert.ok(cycleFor(total) >= 15 && cycleFor(total) % total === 0, String(total));
});

test('Auto sky follows the prayer times, and the phone clock when no place is saved', () => {
    const at = (h, m = 0) => new Date(2026, 10, 6, h, m).getTime();
    const times = { fajr: at(5, 10), sunrise: at(6, 30), dhuhr: at(12), asr: at(15), maghrib: at(17, 40), isha: at(19) };
    assert.equal(autoSkyAt(at(5), times), 'night'); assert.equal(autoSkyAt(at(5, 10), times), 'fajr'); assert.equal(autoSkyAt(at(6, 29), times), 'fajr');
    assert.equal(autoSkyAt(at(6, 30), times), 'day'); assert.equal(autoSkyAt(at(16, 54), times), 'day'); assert.equal(autoSkyAt(at(16, 55), times), 'sunset');
    assert.equal(autoSkyAt(at(17, 59), times), 'sunset'); assert.equal(autoSkyAt(at(18), times), 'night'); assert.equal(autoSkyAt(at(23), times), 'night');
    assert.equal(autoSkyAt(at(5), null), 'fajr'); assert.equal(autoSkyAt(at(12), null), 'day'); assert.equal(autoSkyAt(at(18), null), 'sunset'); assert.equal(autoSkyAt(at(21), null), 'night');
    assert.equal(autoSkyAt(at(12), { ...times, fajr: NaN }), 'day'); // no usable times (high latitudes): the clock
});

test('Choices step round and wrap', () => {
    assert.equal(stepChoice(NIGHT_DESIGNS, 'amber', 1), 'crystal'); assert.equal(stepChoice(NIGHT_DESIGNS, 'amber', -1), 'ebony'); assert.equal(stepChoice(NIGHT_SHAPES, 'ridged', 1), 'round');
});

test('It draws but never counts, sends nothing, and stays still under Reduce Motion', () => {
    assert.doesNotMatch(module_, /from '\.\/storage|commit\(|localStorage|fetch\(|XMLHttpRequest|setInterval\([^)]*count/);
    assert.match(module_, /const reducedMotion = \(\) => !!frame\?\.still \|\| /);
    assert.match(module_, /if \(reducedMotion\(\)\) \{ shown = to;/);
    assert.doesNotMatch(module_, /\.filter\s*=/); // canvas filters do not run on iOS Safari
    assert.doesNotMatch(module_, /\.roundRect\(/); // needs iOS 16; the app supports iOS 15
    // The stage's button uses the same actions as the other looks, so every count still goes through the same path.
    assert.match(app, /nightStage\(\{ action: 'count-tap'/); assert.match(app, /nightStage\(\{ action: 'tasbih-tap', disabled: done \|\| tasbihPaused/);
    assert.match(app, /<button class="night-tap" data-action="\$\{o\.action\}"/);
    // The peek at the minaret changes no state.
    assert.doesNotMatch(app.match(/case 'night-show':[\s\S]*?break;/)[0], /commit|pendingCounts/);
    assert.match(css, /\.night-view \.bottom-nav\{display:none\}/);
});

test('The Night beads choices are named in all three languages, and the look can be chosen from both counters', () => {
    const i18n = read('../src/i18n.ts');
    for (const key of [...NIGHT_DESIGNS.map(v => `nightDesign_${v}`), ...NIGHT_SHAPES.map(v => `nightShape_${v}`), ...NIGHT_SKIES.map(v => `nightSky_${v}`), 'tasbihLook_night', 'nightPhonetic', 'nightMore', 'nightShowMinaret', 'nightPrev', 'nightNext', 'nightAutoNote'])
        assert.match(i18n, new RegExp(`\\b${key}: \\['[^']+', '[^']+', '[^']+'\\]`), key);
    assert.equal((app.match(/\$\{tasbihLookSection\(\)\}/g) ?? []).length, 4);
});
