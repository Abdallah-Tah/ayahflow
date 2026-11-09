// The app-wide emerald identity (2026-11-08): one token set for the emerald page, one "paper" scope for cream cards,
// vector ornaments only, and text contrast of at least 4.5:1 on every surface the palette creates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const block = (sel) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
const token = (b, name) => new RegExp(`--${name}:(#[0-9a-f]{6})`).exec(b)?.[1];
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('Both appearances share the emerald page; light mode draws cards on cream paper', () => {
    const dark = block(':root{color-scheme:dark;'), light = block('html[data-theme=light]{color-scheme:light;');
    assert.equal(token(dark, 'bg'), '#082119'); assert.equal(token(light, 'bg'), '#0f3d2e');
    assert.equal(token(light, 'paper-bg'), '#f7efdd', 'cream cards in light mode');
    assert.equal(token(dark, 'paper-bg'), '#0f3326', 'deep-green cards in dark mode');
    for (const b of [dark, light]) assert.equal(token(b, 'gold') !== undefined, true);
});

test('Text reaches 4.5:1 on the page, on paper and on the emerald step', () => {
    const dark = block(':root{color-scheme:dark;'), light = block('html[data-theme=light]{color-scheme:light;');
    const pairs = [];
    for (const b of [dark, light]) {
        for (const fg of ['text', 'muted', 'soft', 'gold']) pairs.push([`${fg} on page`, token(b, fg), token(b, 'bg')], [`${fg} on panel`, token(b, fg), token(b, 'panel')]);
        for (const fg of ['paper-text', 'paper-muted', 'paper-soft', 'paper-gold']) pairs.push([`${fg} on paper`, token(b, fg), token(b, 'paper-bg')], [`${fg} on raised paper`, token(b, fg), token(b, 'paper-raise')]);
    }
    for (const [name, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}:1`);
});

test('Cards are styled once through the paper scope, not per screen', () => {
    const scope = /:is\(([\s\S]*?)\)\{\n--text:var\(--paper-text\);/.exec(css);
    assert.ok(scope, 'one paper scope');
    for (const c of ['.plan-card', '.hifz-verse', '.widget:not(.prayer-day', '.feature-wide', '.dhikr-card', '.lesson-card', '.verse-card', '.notice', '.prayer-list', 'dialog']) assert.ok(scope[1].includes(c), c);
    assert.match(css, /\.prayer-day:not\(\.empty\)\{[^}]*border-radius:var\(--r-arch\)/, 'the next-prayer card keeps the arch');
    // 2026-11-09: the Home band's mosque is now the approved home scene; in Arabic it moves to the end side (left).
    assert.match(css, /\[dir=rtl\] \.home-band::before\{inset:28px auto 0 0;/, 'the Home scene moves to the other side in Arabic');
});

test('Ornaments stay inline vectors (the illustrated scenes are covered by art-backgrounds.test.mjs), and the reader keeps its own reading themes', () => {
    for (const k of ['--pattern', '--mosque', '--wave']) assert.match(css, new RegExp(`${k}:url\\("data:image/svg\\+xml,`));
    assert.ok(statSync(new URL('../public/style.css', import.meta.url)).size < 120_000, 'the stylesheet stays small');
    assert.match(css, /html\[data-theme=light\] body\.reading\{--r-body:#f7f2e4\}/, 'reading themes unchanged');
    assert.match(app, /return `<div class="home-band">\$\{dateLine\(\)\}<\/div>/);
    assert.match(app, /class="plan-step \$\{done \? 'done' : ''\} \$\{p1 \? 'primary' : ''\}" data-action="\$\{action\}"/, 'every plan step keeps its action');
});
