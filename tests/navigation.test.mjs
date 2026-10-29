// Back and the tabs can never be locked by an action that is still running (e.g. a location request iOS never answers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Back and tabs bypass the busy guard; the guard expires; location requests time out', () => {
    const app = read('src/app.ts');
    assert.match(app, /const BUSY_LIMIT = 8000, ALWAYS_ACTIONS = new Set\(\['nav', 'back'\]\);/);
    assert.match(app, /\(busy && !ALWAYS_ACTIONS\.has\(target\.dataset\.action \?\? ''\) && Date\.now\(\) - busySince < BUSY_LIMIT\)/);
    assert.match(app, /if \(busyToken === mine\) busy = false;/, 'a stale action finishing late does not unlock a newer one');
    assert.match(read('native/bridge.mjs'), /currentPosition: \(\) => Promise\.race\(\[Smart\.currentPosition\(\), new Promise\(\(_, reject\) => setTimeout\(\(\) => reject\(Error\('Location timed out'\)\), 20000\)\)\]\),/);
});

test('Every screen with a back button has a parent to go back to', () => {
    const app = read('src/app.ts');
    const withBack = /\['reader', 'lesson', 'recite', 'tajweed', 'practice', 'settings', 'moment', 'reminders', 'counter', 'steps', 'rotation', 'tasbih', 'verses', 'recitations', 'review', 'wake', 'khatm', 'names', 'hifz'\]\.includes\(view\)/;
    assert.match(app, withBack);
    const back = app.slice(app.indexOf("case 'back':"), app.indexOf("case 'daily':"));
    for (const v of ['reader', 'verses', 'recitations', 'practice', 'review', 'khatm', 'hifz', 'lesson', 'settings', 'steps', 'moment', 'reminders', 'counter', 'rotation', 'names', 'tasbih', 'wake'])
        assert.ok(back.includes(`view === '${v}'`), `${v} has no explicit back target`);
});
