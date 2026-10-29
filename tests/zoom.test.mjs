// Double-tapping a button must not zoom the app; pinch zoom stays available (no user-scalable=no / maximum-scale).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('No double-tap zoom, pinch zoom kept', () => {
    assert.match(read('public/style.css'), /html,body\{overflow-x:clip;touch-action:manipulation\}/);
    const viewport = /<meta name="viewport" content="([^"]+)"/.exec(read('public/index.html'))[1];
    assert.doesNotMatch(viewport, /user-scalable=no|maximum-scale/);
});
