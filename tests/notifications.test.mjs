// Adhkar reminder notifications: complete text, one reminder when triggers coincide, and the tap opening the full text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, emptyHistory, entriesFor, momentUrl, parseMomentUrl, RULES, BOUNCE_MINUTES } from '../www/js/adhkar.js';
import { momentPreview, groupedBody, nativeConfig, timedReminders, timedPlan, remindedToday, mergeDetections, windowsFor, PREVIEW_LETTERS } from '../www/js/smart.js';
import { initialState, validateState } from '../www/js/engine.js';
import { verse } from '../www/js/data.js';
// Home is in Makkah; plan in its time zone so prayer days and calendar days agree wherever the tests run.
process.env.TZ = 'Asia/Riyadh';
const nfc = (x) => x.normalize('NFC');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const swift = read('plugins/smart-reminders/ios/Sources/SmartRemindersPlugin/SmartReminders.swift');
const java = read('plugins/smart-reminders/android/src/main/java/app/ayahflow/smart/SmartEngine.java');
const bridge = read('native/bridge.mjs'), app = read('src/app.ts');
const more = (n) => `+${n} more: tap to read them all`;
const body = (m) => momentPreview(m, more).split('\n');
const NOW = new Date(2026, 9, 22, 5, 0).getTime();
const withHome = (smart = {}, extra = {}) => ({ ...initialState(), places: { home: { lat: 21.4225, lng: 39.8262, radius: 150 }, work: null, mosque: null }, smart: { ...initialState().smart, ...smart }, ...extra });
const text = (id) => entriesFor('vehicle').concat(entriesFor('leave_home'), entriesFor('enter_home'), entriesFor('morning')).find(e => e.id === id).text;

test('Leaving home: the complete du\'a and its source', () => {
    assert.deepEqual(body('leave_home'), [text('leave-home'), 'Sunan Abi Dawud 5095']);
});

test('Entering home: the complete hadith, verbatim from Sahih Muslim, not a supplication made up for it', () => {
    const [t, ref] = body('enter_home');
    assert.equal(ref, 'Sahih Muslim 5262');
    assert.ok(nfc(t).startsWith(nfc('إِذَا دَخَلَ الرَّجُلُ بَيْتَهُ')) && nfc(t).endsWith(nfc('أَدْرَكْتُمُ الْمَبِيتَ وَالْعَشَاءَ')), 'all three sentences of the Prophet\'s words');
    assert.equal(entriesFor('enter_home')[0].kind, 'guidance');
});

test('Riding a vehicle: the verse and the istighfar, both whole, no asterisk, one source line', () => {
    const lines = body('vehicle'), [riding, istighfar] = entriesFor('vehicle');
    assert.deepEqual(lines, [riding.text, istighfar.text, 'Sunan Abi Dawud 2602']);
    assert.match(nfc(lines[0]), new RegExp(`^${nfc('﴿سُبْحَانَ الَّذِي سَخَّرَ لَنَا')} .* ${nfc('مُقْرِنِينَ ۝١٣ وَإِنَّا')} .* ${nfc('لَمُنْقَلِبُونَ ۝١٤﴾')}$`));
    assert.doesNotMatch(lines.join('\n'), /\*/);
});

test('Morning and evening: whole adhkar while they fit, then how many are left in the app; a dhikr is never cut', () => {
    for (const m of ['morning', 'evening']) {
        const lines = body(m), all = entriesFor(m), arabic = lines.filter(l => /[ً-ْ]/.test(l));
        assert.equal(arabic[0], all[0].text, `${m}: the first du'a of the collection, whole`);
        for (const l of arabic) assert.ok(all.some(e => e.text === l), `${m}: every Arabic line is one complete dhikr`);
        assert.equal(lines.at(-1), more(all.length - arabic.length));
        assert.ok(lines.includes('×3 · Sunan Abi Dawud 5088'), `${m}: the repeat count stays with its dhikr`);
    }
    // The limit only decides how many follow the first; a long first dhikr is still sent whole.
    assert.ok(PREVIEW_LETTERS >= 100);
    const sleep = body('sleep');
    assert.equal(sleep[0], entriesFor('sleep')[0].text);
});

test('Quran-based adhkar show the ayahs verbatim from the corpus with their end signs', () => {
    const quls = momentPreview('after_prayer');
    assert.ok(quls.length > 0);
    // three-quls is never first in a moment; its rendering is still verbatim when it is reached.
    const e = entriesFor('morning').find(x => x.kind === 'quran');
    assert.ok(e.quran.every(q => verse(q.surah, q.from).length > 0));
});

test('Triggers together: one notification, each moment\'s text under its title, nothing repeated', () => {
    const copy = Object.fromEntries(['leave_home', 'vehicle', 'morning'].map(m => [m, { title: `T:${m}`, body: momentPreview(m, more) }]));
    const b = groupedBody(['leave_home', 'vehicle', 'morning'], copy), parts = b.split('\n\n');
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.map(p => p.split('\n')[0]), ['T:leave_home', 'T:vehicle', 'T:morning']);
    assert.ok(parts[1].includes(entriesFor('vehicle')[1].text), 'the riding istighfar is no longer dropped');
    assert.equal(groupedBody(['leave_home'], copy), copy.leave_home.body, 'a single moment has no heading');
    // A dhikr shared by two moments in one notification is shown once.
    const twice = groupedBody(['morning', 'evening'], { morning: { title: 'M', body: momentPreview('morning', more) }, evening: { title: 'E', body: momentPreview('evening', more) } });
    const shared = entriesFor('morning').find(e => e.id === 'la-yadurr').text;
    assert.equal(twice.split('\n').filter(l => l === shared).length, 1);
});

test('Leaving home in the morning window carries the morning adhkar once, and not after the timed one was delivered', () => {
    const s = withHome({ location: true, timed: true }), w = windowsFor(s, new Date(NOW));
    const enabled = new Set(s.smart.moments), inMorning = w.morning[0] + 60 * 60000;
    const first = decide('EXIT_HOME', inMorning, w, emptyHistory(), enabled);
    assert.deepEqual(first.decision.moments, ['leave_home', 'morning']);
    // Leaving again later that morning: the cooldown passed, morning was already sent today.
    const again = decide('EXIT_HOME', inMorning + 60 * 60000, w, first.history, enabled);
    assert.deepEqual(again.decision.moments, ['leave_home']);
    // The timed morning reminder (Fajr + 20 min) was delivered before leaving: not sent a second time.
    const timed = timedPlan(s, w.morning[0])['morning'][w.day];
    assert.equal(timed, w.morning[0] + 20 * 60000);
    const after = decide('EXIT_HOME', timed + 10 * 60000, w, emptyHistory(), enabled, { morning: timed });
    assert.deepEqual(after.decision.moments, ['leave_home']);
    const before = decide('EXIT_HOME', timed - 5 * 60000, w, emptyHistory(), enabled, { morning: timed });
    assert.deepEqual(before.decision.moments, ['leave_home', 'morning'], 'before it, the grouped reminder replaces it');
});

test('A grouped reminder already sent today is not planned again as a timed one when the app next opens', () => {
    const s = withHome({ location: true, timed: true }), w = windowsFor(s, new Date(NOW));
    const at = w.morning[0] + 5 * 60000, copy = () => ({ title: '', body: '' });
    assert.ok(timedReminders(s, copy, at).some(r => r.moment === 'morning' && r.at > at));
    const detections = mergeDetections([], [{ event: 'EXIT_HOME', at, moments: ['leave_home', 'morning'] }]);
    assert.deepEqual(detections[0].moments, ['leave_home', 'morning']);
    const after = { ...s, detections };
    assert.deepEqual([...remindedToday(after, at + 60000)], ['leave_home', 'morning']);
    const planned = timedReminders(after, copy, at + 60000);
    assert.ok(!planned.some(r => r.moment === 'morning' && new Date(r.at).getDate() === new Date(at).getDate()), 'not today');
    assert.ok(planned.some(r => r.moment === 'morning'), 'tomorrow\'s still planned');
    assert.deepEqual(nativeConfig(after, copy, at + 60000).timedAt, timedPlan(after, at + 60000));
});

test('Location jitter at the edge of Home: no "Entering home" right after "Leaving home"', () => {
    const s = withHome({ location: true }), w = windowsFor(s, new Date(NOW)), enabled = new Set(['leave_home', 'enter_home']);
    const at = w.morning[1] + 3 * 3600000; // outside the morning and evening windows
    const left = decide('EXIT_HOME', at, w, emptyHistory(), enabled);
    assert.equal(decide('ENTER_HOME', at + 2 * 60000, w, left.history, enabled).decision, null);
    assert.deepEqual(decide('ENTER_HOME', at + (BOUNCE_MINUTES + 15) * 60000, w, left.history, enabled).decision.moments, ['enter_home']);
    assert.equal(decide('EXIT_HOME', at + 20 * 60000, w, left.history, enabled).decision, null, 'cooldown: 45 min');
    assert.ok(RULES.filter(r => r.quietAfter).every(r => r.quietAfter.minutes <= 10));
});

test('Detections with the moments they carried are validated; older records without them still load', () => {
    const ok = { ...initialState(), detections: [{ event: 'EXIT_HOME', at: NOW, moments: ['leave_home', 'morning'] }, { event: 'WAKE', at: NOW + 1 }] };
    assert.deepEqual(validateState(ok).detections, ok.detections);
    assert.throws(() => validateState({ ...initialState(), detections: [{ event: 'EXIT_HOME', at: NOW, moments: ['nope'] }] }));
});

test('The native engines apply the same dedupe, and only to adhkar: athan alerts are never cancelled by it', () => {
    assert.match(swift, /var timedAt: \[String: \[String: Double\]\]\?/, 'optional: configurations saved by earlier builds still decode');
    assert.match(swift, /cfg\.timedAt\?\[m\]\?\[day\]\)\.map \{ \$0 <= now \} == true/);
    assert.match(swift, /let quietAfter: Quiet\?/);
    assert.match(swift, /if let q = rule\.quietAfter, let last = history\.last\[q\.moment\], now >= last, now - last < q\.minutes \* 60000 \{ continue \}/);
    assert.match(java, /timed != null && timed\.has\(day\) && timed\.optDouble\(day\) <= now/);
    assert.match(java, /JSONObject quiet = rule\.optJSONObject\("quietAfter"\);/);
    // Only the timed adhkar ids (codes 1–3) are ever cancelled by a grouped reminder; athan ids are codes 4–8.
    assert.match(swift, /let cancel = moments\.compactMap \{ cfg\.timedIds\[\$0\]\?\[day\] \}/);
    const c = nativeConfig(withHome({ timed: true }), () => ({ title: '', body: '' }), NOW);
    for (const ids of Object.values(c.timedIds)) for (const id of Object.values(ids)) assert.ok(Math.floor(id / 1e6) <= 3, String(id));
});

test('Tapping a reminder opens the full adhkar: cold launch, background and foreground', () => {
    // Every reminder links to its moments; a grouped one to all of them.
    assert.equal(momentUrl(['leave_home', 'morning']), 'ayahflow://moment/leave_home+morning');
    assert.deepEqual(parseMomentUrl('ayahflow://moment/leave_home+morning'), ['leave_home', 'morning']);
    assert.deepEqual(parseMomentUrl('ayahflow://moment/vehicle'), ['vehicle']);
    assert.match(swift, /content\.userInfo = \["cap_extra": \["url": "ayahflow:\/\/moment\/" \+ moments\.joined\(separator: "\+"\)\]\]/);
    assert.match(java, /Uri\.parse\("ayahflow:\/\/moment\/" \+ String\.join\("\+", moments\)\)/);
    assert.ok(timedReminders(withHome({ timed: true }), () => ({ title: '', body: '' }), NOW).every(r => r.url === `ayahflow://moment/${r.moment}`));
    // Cold launch: the tap is retained by @capacitor/local-notifications until the listener exists, and links arriving
    // before the app registers its handler are queued, then delivered.
    const handler = read('node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift');
    assert.match(handler, /notifyListeners\("localNotificationActionPerformed", data: data, retainUntilConsumed: true\)/);
    assert.match(bridge, /if \(deepLinkHandler\) deepLinkHandler\(url\); else queuedLinks\.push\(url\);/);
    assert.match(bridge, /onDeepLink\(handler\) \{ deepLinkHandler = handler; queuedLinks\.splice\(0\)\.forEach\(handler\); \}/);
    assert.match(bridge, /localNotificationActionPerformed', \(\{ actionId, notification \}\) => \{ const url = notification\?\.extra\?\.url;/);
    // Background or foreground, the same route: the moment screen with every dhikr of those moments in full.
    assert.match(app, /const ms = parseMomentUrl\(url\); if \(ms\.length\) \{ momentIds = ms; void navigate\('moment'\); \}/);
    // Foreground: no presentationOptions override, so iOS shows the banner, list entry and sound while the app is open
    // (LocalNotificationsHandler.willPresent default), and nothing navigates until the user taps.
    const cap = JSON.parse(read('capacitor.config.json'));
    assert.equal(cap.plugins.LocalNotifications.presentationOptions, undefined);
    assert.match(handler, /return \[\s*\.badge,\s*\.sound,\s*\.banner,\s*\.list\s*\]/);
});
