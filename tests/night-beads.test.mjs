// Night beads: a fourth tasbih look. Drawing only: counts never come from it, and old saves keep the look they had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, STATE_VERSION, TASBIH_THEMES, NIGHT_DESIGNS, NIGHT_SHAPES, NIGHT_SKIES, defaultNightBeads } from '../www/js/engine.js';
import { COUNTERS } from '../www/js/adhkar.js';
import { phoneticFor, cycleFor, markersFor, nearest, autoSkyAt, stepChoice, swingStep, SWING_REST, makeChain, chainStep } from '../www/js/night-beads.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = read('../src/app.ts'), module_ = read('../src/night-beads.ts'), css = read('../public/style.css');
const withNight = v => { const s = initialState(); return { ...s, worship: { ...s.worship, prefs: { ...s.worship.prefs, nightBeads: { ...s.worship.prefs.nightBeads, ...v } } } }; };

test('v26 saves move to v27 keeping their look, counts and settings; Night beads starts with the approved defaults', () => {
    assert.equal(STATE_VERSION, 28);
    assert.deepEqual([...TASBIH_THEMES], ['ring', 'thread', 'plain', 'night']);
    assert.equal(initialState().worship.prefs.tasbihTheme, 'ring');
    assert.deepEqual(defaultNightBeads(), { design: 'amber', shape: 'round', sky: 'auto', phonetic: true });
    for (const look of ['ring', 'thread', 'plain']) {
        const v26 = JSON.parse(JSON.stringify(initialState())); v26.version = 26; delete v26.worship.prefs.nightBeads;
        v26.worship.prefs.tasbihTheme = look; v26.worship.prefs.haptics = false; v26.counts = [{ day: '2026-11-01', id: 'istighfar', n: 57 }];
        const m = validateState(v26);
        assert.equal(m.version, 28); assert.equal(m.worship.prefs.tasbihTheme, look); assert.equal(m.worship.prefs.haptics, false);
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

test('The tassel swings looser than the minaret, against the slide, and settles back to rest', () => {
    const run = (s, seconds, dt = 1 / 60) => { for (let i = 0; i < seconds / dt; i++) s = swingStep(s, dt); return s; };
    assert.deepEqual(swingStep({ ...SWING_REST }, 1 / 60), { ...SWING_REST }, 'nothing moves it, nothing moves');
    const kicked = swingStep({ ...SWING_REST }, 1 / 60, 500);
    assert.ok(kicked.tv < 0 && kicked.mv < 0, 'cord moves right, the piece lags left');
    assert.ok(Math.abs(kicked.tv) > Math.abs(kicked.mv) * 2, 'the tassel is the loose part');
    let peakT = 0, peakM = 0, s = kicked;
    for (let i = 0; i < 90; i++) { s = swingStep(s, 1 / 60); peakT = Math.max(peakT, Math.abs(s.t)); peakM = Math.max(peakM, Math.abs(s.m)); }
    assert.ok(peakT > peakM && peakT > .2 && peakT <= .62, `tassel ${peakT}, minaret ${peakM}`);
    const later = run(kicked, 12);
    assert.ok(Math.abs(later.t) < .01 && Math.abs(later.m) < .01, 'it comes to rest');
    // Slow or uneven frames must not make it fly off, and a huge jump is capped.
    let rough = swingStep({ ...SWING_REST }, .05, 1e6), most = 0;
    for (let i = 0; i < 400; i++) { rough = swingStep(rough, .05); most = Math.max(most, Math.abs(rough.t), Math.abs(rough.m)); assert.ok(Number.isFinite(rough.t)); }
    assert.ok(most <= .62); assert.ok(Math.abs(rough.t) < .05);
});

test('A pull on one bead ripples outward along the strand, stays small, and settles', () => {
    const size = 16, c = makeChain(size);
    assert.deepEqual(chainStep(makeChain(4), 1 / 60).a, [0, 0, 0, 0], 'nothing pulls it, nothing moves');
    chainStep(c, 1 / 60, 8, 100, 100);
    assert.ok(c.a[8] > 0 && c.n[8] > 0, 'the pulled bead moves first');
    const first = Math.abs(c.n[11]);
    let reach = 0;
    for (let i = 0; i < 30; i++) { chainStep(c, 1 / 60); reach = Math.max(reach, Math.abs(c.n[11])); }
    assert.ok(first < .2 && reach > first * 3, `the ripple reaches a neighbour later (${first} then ${reach})`);
    for (let i = 0; i < 40; i++) { chainStep(c, 1 / 30); assert.ok(c.a.every(v => Math.abs(v) <= 5) && c.n.every(v => Math.abs(v) <= 6), 'pieces never run through each other'); }
    for (let i = 0; i < 1200; i++) chainStep(c, 1 / 60);
    assert.ok(c.a.every(v => Math.abs(v) < .01) && c.n.every(v => Math.abs(v) < .01), 'it comes to rest');
    const rough = makeChain(16);
    for (let i = 0; i < 200; i++) chainStep(rough, .05, i % 16, 400, 400);
    assert.ok(rough.a.every(Number.isFinite) && rough.n.every(Number.isFinite), 'slow frames stay stable');
});

test('The tassel rests under Reduce Motion and stops moving when left alone', () => {
    assert.match(module_, /const runLoop = \(\) => \{ if \(!raf && !reducedMotion\(\)\)/);
    assert.match(module_, /if \(reducedMotion\(\)\) \{ shown = to; anim = null; swing = \{ \.\.\.SWING_REST \};/);
    assert.match(module_, /const REST_AFTER_MS = 45000;/);
    assert.match(module_, /anim \|\| now - lastTouch < REST_AFTER_MS/);
    assert.match(module_, /still \? 0 : slot\.a \+ drift/);
});

test('The stage says why the beads are still; only a tap turns the movement back on', () => {
    assert.match(app, /if \(state\.reducedMotion\) return actionButton\('night-motion-on'/);
    assert.match(app, /case 'night-motion-on':\s+await commit\(\{ \.\.\.state, reducedMotion: false \}\)/);
    assert.equal((app.match(/reducedMotion: false/g) ?? []).length, 1);
});

test('Choices step round and wrap', () => {
    assert.equal(stepChoice(NIGHT_DESIGNS, 'amber', 1), 'crystal'); assert.equal(stepChoice(NIGHT_DESIGNS, 'amber', -1), 'ebony'); assert.equal(stepChoice(NIGHT_SHAPES, 'ridged', 1), 'round');
});

test('It draws but never counts, sends nothing, and stays still under Reduce Motion', () => {
    assert.doesNotMatch(module_, /from '\.\/storage|commit\(|localStorage|fetch\(|XMLHttpRequest|setInterval\([^)]*count/);
    assert.match(module_, /const reducedMotion = \(\) => !!frame\?\.still \|\| /);
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
    // On the other looks both counters offer it above the circle, where it shows without scrolling; only a tap changes the look.
    assert.equal((app.match(/\$\{nightOffer\(\)\}<\/div>\n\$\{(textCard|tapTextOutside)/g) ?? []).length, 2);
    assert.match(app, /function nightOffer\(\): string \{ return `<button class="range-chip night-offer" data-action="tasbih-theme" data-v="night">/);
});
