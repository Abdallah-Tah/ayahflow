// Lock Screen du'a: every daily pick must fit the rectangle whole (measured by scripts/measure-lock-duas.mjs), and the
// widget never shows a du'a without its Arabic. Regression for 2026-10-26: 2:250 showed only "Surah Al-Baqara, 2:250".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QURANIC_DUAS } from '../www/js/duas.js';
import { LOCK_DUAS, LOCK_DUAS_HASH } from '../www/js/lock-duas.js';
import { dailyAyahs, duaKey, duaTextHash } from '../www/js/smart.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('The measured list matches the current corpus and du\'a list (re-run the measurement if this fails)', () => {
    const keys = QURANIC_DUAS.map(duaKey);
    for (const k of LOCK_DUAS) assert.ok(keys.includes(k), k);
    assert.equal(new Set(LOCK_DUAS).size, LOCK_DUAS.length);
    assert.equal(duaTextHash(LOCK_DUAS), LOCK_DUAS_HASH, 'text changed since it was measured: node scripts/measure-lock-duas.mjs');
    assert.ok(LOCK_DUAS.length >= 20, 'enough variety for a different du\'a most days');
});

test('Every daily du\'a for two years is one measured to fit the Lock Screen; 2:250 is no longer picked', () => {
    const days = dailyAyahs(new Date(2026, 0, 1).getTime(), 731);
    for (const d of days) assert.ok(LOCK_DUAS.includes(duaKey([d.surah, d.ayah, d.to])), `${d.day} ${d.ref}`);
    assert.ok(!days.some(d => d.ref === '2:250'));
    assert.equal(dailyAyahs(new Date(2026, 9, 26).getTime(), 1)[0].ref !== '2:250', true);
    assert.ok(new Set(days.map(d => d.ref)).size >= 20);
});

test('Widget: the Lock Screen rectangle always shows Arabic, unchanged, and the measurement uses the same views', () => {
    const w = read('ios/App/AyahFlowWidget/AyahFlowWidget.swift');
    const lock = w.slice(w.indexOf('struct LockScreenAyah'), w.indexOf('/// The du\'a of the day'));
    const body = lock.slice(lock.indexOf('ViewThatFits'), lock.indexOf('.accessibilityElement'));
    assert.ok(!/Label\(caption/.test(body), 'no reference-only fallback');
    assert.match(body, /\{ header; opening\(2\) \}\s*opening\(2\)\s*\}/, 'the last choices still show the ayah');
    assert.match(lock, /Text\(text\)\.font\(\.quran\(10\)\)[^\n]*\.lineLimit\(lines\)\.truncationMode\(\.tail\)/);
    const m = read('scripts/measure-lock-duas.swift');
    for (const sizes of ['[13.0, 11.5, 10.0]', '[15.0, 13.0, 11.5, 10.0]']) assert.ok(m.includes(sizes));
    assert.match(lock, /titled\(13\); titled\(11\.5\); titled\(10\)\s*line\(15\); line\(13\); line\(11\.5\); line\(10\)/);
    assert.match(read('scripts/measure-lock-duas.mjs'), /BOX = \{ width: 145, height: 56 \}/);
});
