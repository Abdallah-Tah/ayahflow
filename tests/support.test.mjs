// "Report a problem": a mail draft only, hidden until a support address is configured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORT_EMAIL, reportMailto } from '../www/js/support.js';

test('No support address ships by default, so the button stays hidden', () => {
    assert.equal(SUPPORT_EMAIL, '');
    assert.equal(reportMailto('s', 'i', 'c', 'p'), null);
    assert.equal(reportMailto('s', 'i', 'c', 'p', 'not an address'), null);
});

test('With an address, it is a mailto draft naming only the versions and platform', () => {
    const href = reportMailto('AyahFlow: a problem', 'What happened?', 'tanzil-1.1', 'iPhone', 'help@example.org');
    assert.ok(href.startsWith('mailto:help@example.org?subject=AyahFlow%3A%20a%20problem&body='));
    const body = decodeURIComponent(href.split('body=')[1]);
    assert.match(body, /^What happened\?\n/);
    assert.match(body, /AyahFlow 0\.1\.0 · tanzil-1\.1 · iPhone/);
    const src = readFileSync(new URL('../src/support.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|https?:\/\//, 'no network endpoint');
});
