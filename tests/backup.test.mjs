// Full backup: all the app's own data, places included, minus device-only file references; restores through
// validation and migration; nothing leaves the phone except where the user puts the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, validateState, backup, exportable } from '../www/js/engine.js';
import { tr } from '../www/js/i18n.js';

test('A backup keeps places and every saved field, and restores to the same state', () => {
    const s = initialState();
    s.places.home = { lat: 21.4225, lng: 39.8262, radius: 150 }; s.xp = 42; s.hijriOffset = 1; s.calendar.occasions.arafah = true;
    s.athan.custom = { name: 'Mine', ext: 'm4a', version: 2 }; s.athan.reciter = 'custom';
    const b = backup(s);
    assert.deepEqual(b.places.home, s.places.home);
    assert.equal(b.athan.custom, null, 'a file only on this device is not referenced');
    assert.notEqual(b.athan.reciter, 'custom');
    const restored = validateState(JSON.parse(JSON.stringify(b)));
    assert.deepEqual({ ...restored, athan: null }, { ...b, athan: null });
    assert.equal(exportable(s).places.home, null, 'the plain export still leaves places out');
});

test('Wiring: a user-started file save only, no endpoint; restore keeps the existing validation and size limit', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    assert.match(app, /case 'backup':\n\s+await exportProgress\(backup\(state\), `ayahflow-backup-\$\{dayKey\(\)\}\.json`\);/);
    assert.match(app, /if \(file\.size > 5000000\)[\s\S]*?validateState\(JSON\.parse/);
    const storage = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(storage.slice(storage.indexOf('export async function exportProgress'), storage.indexOf('export async function exportProgress') + 400), /fetch\(/);
});

test('A save that cannot be opened can be copied out unchanged before any restore or reset', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8'), storage = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
    const boot = app.slice(app.indexOf('catch (error) {\n    root.innerHTML'), app.indexOf('void boot();'));
    assert.ok(boot.indexOf("actionButton('export-raw'") > 0 && boot.indexOf("actionButton('export-raw'") < boot.indexOf("actionButton('reset'"), 'the copy comes first, before reset');
    const raw = storage.slice(storage.indexOf('export async function exportRawState'), storage.indexOf('export function downloadBlob'));
    assert.doesNotMatch(raw, /JSON\.parse|validateState|saveState|setItem|nativeBridge\.save/, 'exported exactly as stored; nothing written');
    for (const k of ['bootError', 'bootErrorReset', 'exportRaw', 'exportRawNone']) for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k, `${k} ${l}`);
});
