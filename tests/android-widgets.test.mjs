// Android one-card widgets: registered, refreshed with the prayer widget, reading only what the app shared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const P = 'plugins/smart-reminders/android/src/main';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Du\'a, dhikr, daily moments and Jumu\'ah-and-fasts widgets are declared, described and refreshed', () => {
    const manifest = read(`${P}/AndroidManifest.xml`), strings = read(`${P}/res/values/ayahflow_widget_strings.xml`);
    for (const [cls, n] of [['DuaWidgetProvider', 'dua'], ['DhikrWidgetProvider', 'dhikr'], ['StepsWidgetProvider', 'steps'], ['UpcomingWidgetProvider', 'upcoming']]) {
        assert.ok(existsSync(new URL(`../${P}/java/app/ayahflow/smart/${cls}.java`, import.meta.url)), cls);
        assert.match(manifest, new RegExp(`android:name="app\\.ayahflow\\.smart\\.${cls}" android:exported="false"`));
        assert.match(manifest, new RegExp(`@xml/ayahflow_widget_${n}_info`));
        assert.match(strings, new RegExp(`ayahflow_widget_${n}_description`));
        assert.match(read(`${P}/res/xml/ayahflow_widget_${n}_info.xml`), /@layout\/ayahflow_widget_simple/);
    }
    const plugin = read(`${P}/java/app/ayahflow/smart/SmartRemindersPlugin.java`);
    assert.equal(plugin.split('SimpleWidget.refreshAll(getContext());').length - 1, 2, 'refreshed on save and on reset');
    // The step widget became Daily moments (v29) under its old class name, so a widget already placed keeps loading.
    const moments = read(`${P}/java/app/ayahflow/smart/StepsWidgetProvider.java`);
    assert.match(moments, /k\.url = "ayahflow:\/\/adhkar";/); assert.doesNotMatch(moments, /optJSONObject\("steps"\)|progress/);
    assert.match(manifest, /StepsWidgetProvider" android:exported="false" android:label="AyahFlow · Daily moments"/);
    assert.ok(!existsSync(new URL(`../${P}/java/app/ayahflow/smart/StepLog.java`, import.meta.url)), 'no step counter left');
    assert.doesNotMatch(plugin, /TYPE_STEP_COUNTER|public void steps\(/);
    assert.match(plugin, /prefs\(getContext\(\)\)\.edit\(\)\.remove\("steps"\)\.apply\(\);/, 'the old step log is dropped');
    const dua = read(`${P}/java/app/ayahflow/smart/DuaWidgetProvider.java`);
    assert.match(dua, /k\.title = a\.optString\("text"\); k\.rtl = true;/, 'the Quran text as shared, right to left');
});

test('Every ayahflow:// link a widget or reminder opens matches the Android link filter (it was limited to /moment)', () => {
    const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const helper = readFileSync(new URL('../scripts/native-configure.mjs', import.meta.url), 'utf8');
    assert.match(manifest, /<data android:scheme="ayahflow" \/>/, 'the whole scheme, as iOS registers it');
    assert.doesNotMatch(manifest, /android:scheme="ayahflow" android:host=/);
    assert.match(helper, /replace\('<data android:scheme="ayahflow" android:host="moment" \/>', '<data android:scheme="ayahflow" \/>'\)/, 'the helper widens an older filter instead of keeping it');
    const dir = new URL('../plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/', import.meta.url);
    const hosts = new Set();
    for (const f of readdirSync(dir)) for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/"ayahflow:\/\/([a-z-]+)/g)) hosts.add(m[1]);
    assert.ok(['prayer', 'counter', 'ayah', 'adhkar', 'home', 'moment'].every(h => hosts.has(h)), `widgets open ${[...hosts].join(', ')}`);
});
