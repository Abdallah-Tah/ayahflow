// Design tokens and touch targets: one radius scale, one type ramp with nothing under 11 px, 44 pt hit areas,
// prayer names kept whole, and press feedback that respects Reduce Motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');

test('Radii come from one scale; only circles and hairline marks stay literal', () => {
    assert.match(css, /--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--radius:var\(--r-xl\)/);
    const literal = [...css.matchAll(/border-radius:(\d+)px/g)].map(m => Number(m[1]));
    assert.deepEqual(literal.filter(n => n > 7 && n !== 999), [], 'card and control radii use --r-* (999 px is a pill)');
});
test('Type ramp: tokens for 11-15 px and no UI text below 11 px', () => {
    assert.match(css, /--fs-2xs:11px;--fs-xs:12px;--fs-sm:13px;--fs-md:14px;--fs-base:15px;/);
    // The tab bar label is the one exception: iOS draws tab bar titles at 10 pt.
    const tiny = [...css.matchAll(/([^{}]+)\{[^}]*font-size:(\d+(?:\.\d+)?)px/g)].filter(m => Number(m[2]) < 11).map(m => m[1].trim());
    assert.deepEqual(tiny, ['.nav-item']);
    assert.deepEqual([...css.matchAll(/font-size:(1[0-5])px/g)].map(m => m[0]), [], 'small sizes go through the ramp');
});
test('Controls drawn under 44 pt get a centred 44 pt hit area', () => {
    for (const sel of ['.icon-button', '.range-chip', '.segment button', '.text-button', '.r-title']) {
        assert(css.includes(`${sel}::after`), sel);
    }
    assert.match(css, /::after\{content:'';position:absolute;inset:min\(0px,calc\(50% - 22px\)\)\}/);
    assert.match(css, /\.search-box input\{min-height:44px\}/);
    assert.match(css, /\.select-row select\{min-height:44px\}/);
    assert.match(css, /\.segment button\{[^}]*min-height:38px/, 'the visible segment keeps its approved height');
});
test('Prayer names never break inside a word', () => {
    assert.match(css, /\.salah-chip \.salah-name\{overflow-wrap:normal;white-space:nowrap;/);
});
test('Press feedback moves cards only without Reduce Motion', () => {
    assert.match(css, /\.feature-wide:active,[^{]*\{transform:scale\(\.98\)\}/);
    assert.match(css, /\.reduced-motion :is\([^)]*\.feature-wide[^)]*\):active\{transform:none;/);
    assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{:is\([^)]*\.feature-wide[^)]*\):active\{transform:none;/);
});
