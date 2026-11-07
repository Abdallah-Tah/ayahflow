// The Mushaf page turn: a drawing over the page. It never changes the text, the place, or what Reduce motion promises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curlShape, clampTilt, tipFromDrag, releaseCompletes } from '../www/js/page-curl.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const app = read('../src/app.ts'), curl = read('../src/page-curl.ts'), css = read('../public/style.css');
const W = 390, H = 844;
const area = pts => Math.abs(pts.reduce((sum, [x, y], i) => { const [u, v] = pts[(i + 1) % pts.length]; return sum + x * v - u * y; }, 0)) / 2;

test('a flat sheet is the whole page; a finished turn leaves none of it on the page', () => {
    const flat = curlShape(W, H, [0, 700], [0, 700]);
    assert.equal(area(flat.flat), W * H);
    assert.deepEqual(flat.flap, []);
    const done = curlShape(W, H, [0, 700], [W * 2, 700]);
    assert.ok(area(done.flat) < 1);
    assert.ok(Math.abs(area(done.revealed) - W * H) < 1);
    assert.ok(done.flap.every(([x]) => x >= W - 0.001), 'the turned sheet has left the screen');
});

test('the fold conserves paper: the two parts make the page, and the flap is the size of what lifted', () => {
    for (const [tipX, tipY] of [[120, 700], [390, 650], [500, 760], [700, 690]]) {
        const y = clampTilt(W, 700, tipX, tipY), s = curlShape(W, H, [0, 700], [tipX, y]);
        assert.ok(Math.abs(area(s.flat) + area(s.revealed) - W * H) < 0.5);
        assert.ok(Math.abs(area(s.flap) - area(s.revealed)) < 0.5);
    }
});

test('the free edge lands where the finger holds it, and the gradient follows the crease', () => {
    const s = curlShape(W, H, [0, 700], [200, 700]);
    assert.ok(s.flap.some(([x, y]) => Math.abs(x - 200) < 0.001 && Math.abs(y - 700) < 700));
    assert.equal(s.reach, 100);
    assert.equal(s.angle, 90);
    assert.ok(Math.abs(s.at(0) - (100 / W) * 100) < 0.001);
    assert.ok(s.at(50) > s.at(0), 'towards the spine is further along the gradient');
});

test('the crease is upright at both ends of a turn, whatever the finger does', () => {
    assert.equal(clampTilt(W, 700, 0, 100), 700);
    assert.equal(clampTilt(W, 700, W * 2, 100), 700);
    assert.ok(Math.abs(clampTilt(W, 700, 100, 100) - 700) <= 35.001);
});

test('next page opens by dragging right and previous by dragging left, within the page', () => {
    assert.equal(tipFromDrag('next', W, 0), 0);
    assert.equal(tipFromDrag('prev', W, 0), W * 2);
    assert.ok(tipFromDrag('next', W, 100) > 0);
    assert.ok(tipFromDrag('prev', W, -100) < W * 2);
    assert.equal(tipFromDrag('next', W, -50), 0);
    assert.equal(tipFromDrag('next', W, 9999), W * 2);
    assert.equal(tipFromDrag('prev', W, 50), W * 2);
});

test('a release turns the page only when it was meant to', () => {
    assert.equal(releaseCompletes('next', W, 20, 0), false, 'a small drag falls back');
    assert.equal(releaseCompletes('next', W, 90, 0), true, 'a long drag completes');
    assert.equal(releaseCompletes('next', W, 30, 0.8), true, 'a flick completes');
    assert.equal(releaseCompletes('next', W, 120, -0.6), false, 'flicking back cancels');
    assert.equal(releaseCompletes('prev', W, -90, 0), true);
    assert.equal(releaseCompletes('prev', W, -30, -0.8), true);
    assert.equal(releaseCompletes('prev', W, -120, 0.6), false);
});

test('Reduce motion gets no sheet, and the turn is hidden from assistive technology and from taps', () => {
    const begin = app.slice(app.indexOf('function beginLeaf'), app.indexOf('/** Opens a verse in the current layout'));
    assert.match(begin, /state\.reducedMotion/);
    assert.match(begin, /dialog\[open\]/);
    assert.match(curl, /aria-hidden/);
    assert.match(curl, /'inert'/);
    assert.match(css, /\.r-leaf\{[^}]*pointer-events:none/);
});

test('the sheet shows the real page text: same renderer, no ids repeated, nothing mirrored', () => {
    assert.match(app, /const surfaceInner = [^\n]*pageBody\(state, page, selected\)/);
    assert.equal((app.match(/pageBody\(state, /g) ?? []).length, 1, 'the reader and the sheet draw the page the same way');
    assert.match(curl, /removeAttribute\('id'\)/);
    assert.doesNotMatch(curl, /scaleX\(-1\)|rotateY|textContent|innerHTML/);
    assert.match(css, /\.r-leaf-flap\{background-color:var\(--r-paper\)\}/);
});

test('the place is saved only when a page is really turned', () => {
    const end = app.slice(app.indexOf("root.addEventListener('touchend'"), app.indexOf("root.addEventListener('touchcancel'"));
    const done = end.indexOf("leaf.play('done', true); void goToPage(leafTo)"), back = end.indexOf("leaf.play('back', true)");
    assert.ok(done > 0 && back > done, 'a cancelled drag only plays the sheet back');
    const move = app.slice(app.indexOf("root.addEventListener('touchmove'"), app.indexOf("root.addEventListener('touchend'"));
    assert.doesNotMatch(move, /commit\(|goToPage\(/);
});

test('the click after a page drag does nothing: a finger that came back must not open a verse', () => {
    const end = app.slice(app.indexOf("root.addEventListener('touchend'"), app.indexOf("root.addEventListener('touchcancel'"));
    assert.match(end, /dragEnded = e\.timeStamp/);
    assert.match(app, /root\.addEventListener\('click', e => \{ if \(e\.timeStamp - dragEnded < 400\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); \} \}, true\);/);
});
