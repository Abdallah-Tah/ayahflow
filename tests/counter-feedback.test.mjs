// Dhikr counter: long text leaves the circle, taps give the feedback the user chose (Reduce Motion does not mute the
// vibration), and the athan settings say plainly that iPhone mutes notification sounds on Silent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTERS, LIBRARY } from '../www/js/adhkar.js';
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../src/i18n.ts', import.meta.url), 'utf8');

test('Dhikr longer than 60 characters is shown whole above the circle, not inside it', () => {
    assert.match(app, /const TAP_TEXT_MAX = 60;/);
    assert.match(app, /const tapTextOutside = \(text: string\) => text\.length > TAP_TEXT_MAX;/);
    assert.match(app, /const phrase = outside \? '' :/, 'nothing long inside the circle');
    assert.match(app, /<p class="arabic tap-text" lang="ar" dir="rtl">\$\{escapeHtml\(step\.text\)\}<\/p>/, 'the full text, verbatim');
    assert.equal((app.match(/\$\{textCard\}<button class="tap-counter" data-action="count-tap"/g) || []).length, 1);
    assert.match(app, /\$\{tapTextOutside\(step\.text\) \? `<p class="arabic tap-text"[^`]*`[^}]*\}<button class="tap-counter" data-action="tasbih-tap"/);
    assert.match(css, /\.tap-text\{[^}]*font-size:calc\(21px \* var\(--ar\)\)/, 'a readable Arabic size');
    // The longest texts in the library are the ones that must move out.
    const texts = [...COUNTERS.flatMap(c => c.steps.map(s => s.text)), ...LIBRARY.map(l => l.text)];
    const longest = Math.max(...texts.map(x => x.length));
    assert(longest > 60, 'the Ibrahimiyya and sayyid al-istighfar are long');
    assert(texts.filter(x => x.length > 24 && x.length <= 60).length > 0, 'medium texts use the mid size inside');
    assert.match(app, /const tapSize = \(text: string\) => text\.length > 40 \? 'long' : text\.length > 24 \? 'mid' : '';/);
});
test('Tap feedback follows the Vibration and Sound switches only, and only from a tap', () => {
    const fb = app.slice(app.indexOf('function feedback('), app.indexOf('const statusIcon'));
    assert.match(fb, /if \(p\.haptics\) \{ haptic\(\);/);
    assert.doesNotMatch(fb, /reducedMotion/, 'Reduce Motion does not mute the vibration');
    assert.match(fb, /if \(p\.sounds\) \{/);
    assert.match(fb, /if \(tickAudio\.state !== 'running'\) void tickAudio\.resume\(\)/);
    assert.doesNotMatch(app, /if \(!state\.reducedMotion\) haptic\(\)/);
    // feedback() is called from tap handlers only (no timers or render paths).
    for (const m of app.matchAll(/\bfeedback\((?:true|false|finished)?\)/g)) {
        const before = app.slice(Math.max(0, m.index - 1500), m.index);
        assert.match(before, /case '(count-tap|quick-tap|tasbih-tap|count-undo)'|function feedback/);
    }
});
test('Athan settings say iPhone mutes notification sounds on Silent, in three languages', () => {
    assert.match(i18n, /athanSilentNote: \['On Silent, and in most Focus modes, iPhone plays no notification sound[^']*', '[^']+', '[^']+'\]/);
    assert.match(app, /const silent = state\.athan\.enabled \? `<div class="notice mt12">\$\{ic\('info', 18\)\}<p>\$\{t\('athanSilentNote'\)\}<\/p><\/div>` : '';/);
    assert.match(app, /\$\{detail\}\$\{silent\}`;/);
});
