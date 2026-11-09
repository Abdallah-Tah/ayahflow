// The step tracker was removed in schema v29 (owner decision 2026-11-08). Saves and backups from every earlier version
// still import with all their data; only the two step settings are dropped. Nothing fitness-related is left to show.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { initialState, validateState, exportable, STATE_VERSION } from '../www/js/engine.js';
import { tr, allTranslationKeys } from '../www/js/i18n.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A v28 save as the previous build wrote it: step tracker on, goal 10,000, plus real progress around it. */
const v28 = () => {
    const s = structuredClone(initialState());
    s.version = 28; s.health = { steps: true, stepGoal: 10000 };
    s.xp = 120; s.goal = 10; s.bookmarks = ['2:255', '18:10']; s.counts = [{ id: 'istighfar', day: '2026-11-07', n: 64 }];
    s.daysOff = [5]; s.readPosition = { surah: 18, ayah: 10 };
    return s;
};

test('v28 saves move to v29: the step settings are dropped and every other field is kept as it was', () => {
    assert.equal(STATE_VERSION, 29);
    const old = v28(), m = validateState(JSON.parse(JSON.stringify(old)));
    assert.equal(m.version, 29); assert.equal('health' in m, false);
    const { version: _a, ...rest } = m, { version: _b, health: _c, ...before } = old;
    assert.deepEqual(rest, before, 'progress, counts, bookmarks and settings are untouched');
});

test('Old backups import whatever their step settings held, even ones the old validator would not have written', () => {
    for (const health of [{ steps: false, stepGoal: 8000 }, { steps: true, stepGoal: 12000 }, { steps: 'yes', stepGoal: 3 }, undefined]) {
        const s = v28(); s.version = 27; if (health === undefined) delete s.health; else s.health = health;
        delete s.hifz; delete s.daysOff;
        const m = validateState(JSON.parse(JSON.stringify(s)));
        assert.equal(m.version, 29); assert.equal('health' in m, false); assert.equal(m.xp, 120); assert.deepEqual(m.counts, s.counts);
    }
    // A current save round-trips and its export carries no step field.
    const now = validateState(JSON.parse(JSON.stringify(initialState())));
    assert.deepEqual(validateState(JSON.parse(JSON.stringify(now))), now);
    assert.equal('health' in exportable(now), false);
});

test('No Steps screen, Home card, setting or widget page is left; links to the old screen open Home', () => {
    const app = read('src/app.ts'), smart = read('src/smart.ts'), bridge = read('native/bridge.mjs');
    assert.doesNotMatch(app, /stepsView|refreshSteps|steps-enable|step-goal|state\.health|'steps'/);
    assert.match(app, /ayahflow:\\\/\\\/\(home\|moment-ayah\|steps\)/, 'an old widget or notification link to /steps opens Home');
    assert.doesNotMatch(smart, /StepReading|steps\(days|stepsTab|stepsOff/);
    assert.doesNotMatch(bridge, /Smart\.steps/);
    const keys = new Set(allTranslationKeys());
    for (const k of ['steps', 'stepsEnable', 'stepsGoal', 'widgetStepsOff', 'goalReached', 'toGo']) assert.ok(!keys.has(k), k);
    for (const l of ['en', 'fr', 'ar']) assert.notEqual(tr('widgetMoments', l), 'widgetMoments');
});

test('Native step reading is gone; vehicle detection keeps its motion permission', () => {
    const plugin = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartRemindersPlugin.swift');
    assert.doesNotMatch(plugin, /CMPedometer|name: "steps"/);
    const engine = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
    assert.match(engine, /CMMotionActivityManager/, 'riding reminders still read recent motion');
    const plist = read('ios/App/App/Info.plist');
    assert.match(plist, /<key>NSMotionUsageDescription<\/key><string>[^<]*vehicle[^<]*<\/string>/);
    assert.doesNotMatch(plist, /NSMotionUsageDescription<\/key><string>[^<]*step/i, 'the purpose string never mentions steps');
    assert.ok(!existsSync(new URL('../plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/StepLog.java', import.meta.url)));
});
