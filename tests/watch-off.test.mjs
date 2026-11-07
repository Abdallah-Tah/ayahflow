// Place and vehicle reminders need "Always" location. When iOS takes it away (e.g. "Change to Only While Using"), the
// app says so on Home and Adhkar and the native engine logs the gap, instead of detection stopping without a word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState } from '../www/js/engine.js';
import { backgroundBlocked } from '../www/js/smart.js';
import { tr } from '../www/js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const withSmart = (smart) => { const s = initialState(); s.smart = { ...s.smart, ...smart }; return s; };
const status = (location) => ({ location, motion: 'granted', monitoring: [], precise: true });

test('Blocked only when place or vehicle reminders are on and location is not Always', () => {
    assert.equal(backgroundBlocked(withSmart({ vehicle: true }), status('whenInUse')), true);
    assert.equal(backgroundBlocked(withSmart({ location: true }), status('denied')), true);
    assert.equal(backgroundBlocked(withSmart({ location: true, vehicle: true }), status('always')), false);
    assert.equal(backgroundBlocked(withSmart({ location: false, vehicle: false, timed: true }), status('whenInUse')), false, 'timed reminders need no location');
    assert.equal(backgroundBlocked(withSmart({ vehicle: true }), null), false, 'unknown status (browser, not yet read) shows nothing');
});

test('Home and Adhkar show the card; the native engine logs stop and restore', () => {
    const app = read('src/app.ts');
    assert.match(app, /function homeView\(\): string \{\n    return `\$\{dateLine\(\)\}\$\{watchCard\(\)\}/);
    assert.match(app, /\$\{t\('adhkarTitle'\)\}<\/h1>\$\{watchCard\(\)\}/);
    const swift = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
    const note = swift.slice(swift.indexOf('private func noteWatching('), swift.indexOf('public func locationManager(_ manager: CLLocationManager, didUpdateLocations'));
    assert.match(note, /cfg\.location \|\| cfg\.vehicle/);
    assert.match(note, /log\(on \? "WATCH_ON" : "WATCH_OFF"/);
    assert.match(swift, /applyMonitoring\(\)\n        noteWatching\(\)\n    \}/, 'checked on every authorization change');
    for (const k of ['watchOffTitle', 'watchOffSteps', 'ev_WATCH_OFF', 'ev_WATCH_ON'])
        for (const l of ['en', 'fr', 'ar']) assert.ok(tr(k, l) !== k && tr(k, l).length > 0, `${k} ${l}`);
});
