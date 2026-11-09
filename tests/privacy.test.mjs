// The privacy policy names every host the app itself downloads from, and Settings links to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audioUrl } from '../www/js/data.js';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Every download host is named in the policy', () => {
    const policy = read('public/privacy.html');
    const hosts = new Set([new URL(audioUrl(1, 1)).host]);
    for (const m of read('content/athan/online.json').matchAll(/https:\/\/([a-z0-9.-]+)\//g)) if (m[1].startsWith('cdn.')) hosts.add(m[1]);
    assert.ok(hosts.size >= 2);
    for (const h of hosts) assert.ok(policy.includes(h), `${h} is not in public/privacy.html`);
    const fetches = [...read('src/voice.ts').matchAll(/fetch\(/g)].length + [...read('native/bridge.mjs').matchAll(/fetch\(/g)].length;
    assert.equal(fetches, 1, 'only the bundled voice manifest is fetched by the web layer; a new fetch needs the policy updated');
    assert.match(read('src/app.ts'), /<a class="text-link" href="\.\/privacy\.html">\$\{t\('privacyPolicy'\)\}<\/a>/);
});

test('The privacy manifest is a resource of the App target, so it ships inside App.app', () => {
    const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
    assert.match(pbx, /PrivacyInfo\.xcprivacy in Resources/);
    assert.match(read('ios/App/App/PrivacyInfo.xcprivacy'), /<key>NSPrivacyTracking<\/key><false\/>/);
});

test('Beta: voice following is described as not included, in the app and in the privacy policy', () => {
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8'), policy = readFileSync(new URL('../site/privacy/index.html', import.meta.url), 'utf8');
    assert.match(app, /\$\{voiceAvailable \? `<label class="setting-row">[^`]*voice-toggle[^`]*` : `<div class="setting-row">[^`]*voiceNotIncluded/, 'without the model, Settings explains why instead of hiding it');
    assert.doesNotMatch(policy, /voice-following model are all inside the app/);
    assert.match(policy, /not included in this version/);
    assert.match(policy, /iCloud Backup on iPhone, Google backup on Android/, 'OS backups are disclosed');
});

test('The iOS microphone purpose string matches the beta: started by a tap, recording only, nothing uploaded', () => {
    for (const p of ['ios/App/App/Info.plist', 'scripts/native-configure.mjs']) {
        const m = /NSMicrophoneUsageDescription<\/key><string>([^<]*)</.exec(read(p));
        assert.ok(m, p);
        assert.match(m[1], /only after you tap/); assert.match(m[1], /never uploaded/);
        assert.doesNotMatch(m[1], /Follow my recitation/, `${p} must not promise a feature this build lacks`);
    }
});
