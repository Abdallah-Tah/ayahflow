// Home Qibla shortcut and "I recited it" on adhkar reminders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tr } from '../www/js/i18n.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('"I recited it": registered in the app language, on timed and smart reminders, recorded once per day', () => {
    const bridge = read('native/bridge.mjs');
    assert.match(bridge, /registerActionTypes\(\{ types: \[\{ id: DHIKR_ACTIONS, actions: \[\{ id: 'recited', title, foreground: true \}\] \}\] \}\)/);
    assert.match(bridge, /extra: \{ url: n\.url \}, actionTypeId: DHIKR_ACTIONS/);
    assert.match(bridge, /deliver\(actionId === 'recited' && typeof url === 'string' \? `\$\{url\}\?recited=1` : url\)/);
    assert.match(read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift'), /content\.categoryIdentifier = "ayahflow-dhikr"/);
    const app = read('src/app.ts');
    assert.match(app, /completeDhikr\(state, e\.id, m, Date\.now\(\), `\$\{m\}:\$\{e\.id\}:\$\{dayKey\(\)\}`\)/, 'same idempotent key as the in-app button');
    assert.match(app, /void bridge\.setDhikrAction\(t\('recitedIt'\)\);/);
    for (const k of ['recitedIt', 'recitedFromNotification', 'qiblaTileSub']) for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k, `${k} ${l}`);
});

test('Qibla shortcut on Home only with a saved place, opening the Qibla tab', () => {
    const app = read('src/app.ts');
    assert.match(app, /function qiblaTile\(\): string \{\n    const p = prayerPlace\(state\);\n    if \(!p\) return '';/);
    assert.match(app, /case 'open-qibla':\n            prayerTab = 'qibla'; await navigate\('prayer'\);/);
});
