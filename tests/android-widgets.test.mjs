// Android one-card widgets: registered, refreshed with the prayer widget, reading only what the app shared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const P = 'plugins/smart-reminders/android/src/main';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Du\'a, dhikr, steps and Jumu\'ah-and-fasts widgets are declared, described and refreshed', () => {
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
    const dua = read(`${P}/java/app/ayahflow/smart/DuaWidgetProvider.java`);
    assert.match(dua, /k\.title = a\.optString\("text"\); k\.rtl = true;/, 'the Quran text as shared, right to left');
});
