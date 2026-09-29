# AyahFlow

**Your daily return to the Quran.**

![Actual AyahFlow prototype screens](evidence/showcase.png)

A working, local-first mobile application prototype with a charcoal-and-gold interface. Written in strict TypeScript with a small web runtime and a Capacitor 8 native adapter for iOS and Android.

**Delivery status: v0.1 prototype, not an App Store / Google Play release.** The learning engine and browser interface were built and tested. Native dependency installation, Xcode/Gradle compilation, hardware behavior, signing, and store submission were not performed in the delivery environment.

## Try the build

Open **`AyahFlow-preview.html`** in a current desktop browser. It contains the actual interface and learning logic, not a screenshot. No npm installation is needed for this preview.

Some attachment viewers block scripts or storage. Download the file and open it in a normal browser. If the app displays **“Temporary preview · not saved after closing”**, that browser has denied storage: progress and recordings remain only in the open page. They are not durable. This is deliberately visible, not a silent fallback.

For the included multi-file web build, using Node 22 or newer:

```bash
cd ayahflow
node scripts/serve.mjs
```

Open `http://localhost:4173`. The precompiled `www/` folder is included. This route is preferable for testing browser storage and microphone permissions. Real-phone audio should be tested in the native build or over HTTPS, not an unsecured LAN HTTP page.

## What is implemented

| Area | This build |
| --- | --- |
| Today | Adaptive session, 3/7/10-minute guides, due reviews, genuine practice points and calendar streaks |
| Memory | Next ayah, previous ayah, listen-and-identify the surah, hidden-text self-recall |
| Review engine | Per-mode cards, missed-answer priority, spaced intervals, stable question seeds, pause/resume, idempotent answer events |
| Quran library | Eight complete Arabic surahs, 37 ayahs, search, bookmarks, reading position, external translation/tafsir links |
| Tajweed | Four draft lessons, highlighted source phrases, rule explanations, knowledge checks, reference playback controls |
| Voice practice | Record, stop, replay, explicitly save, delete with confirmation, and explicit export/share; 90-second clip limit |
| Progress | Quiz accuracy separated from self-assessed recall, missed-card practice, review retention criterion, chapter practice counts |
| Language/accessibility | English, French, Arabic RTL, reduced-motion option, labelled controls, responsive layout |
| Privacy | No account, ads, analytics SDK, application audio upload, or embedded secret keys; progress export/restore and delete controls |
| Native foundation | Capacitor configuration, native storage/share/notification/haptic adapters, permission helper, privacy-manifest draft, launcher icon assets |

**Scope of the starter corpus:** Al-Fatihah (1), Al-'Asr (103), Al-Kawthar (108), Al-Kafirun (109), An-Nasr (110), Al-Ikhlas (112), Al-Falaq (113), An-Nas (114).

**Tajweed lesson drafts:** Ikhfa, ghunnah on a doubled noon, qalqalah when stopping, natural madd. These are not a complete Tajweed curriculum. Qualified teacher review is pending and is labelled inside the app.

Arabic content has source references and structural tests. That is not a substitute for a qualified editorial review. See `docs/CONTENT-PROVENANCE.md`.

### Intentionally not claimed

There is **no automatic Tajweed or makhraj scoring**, speech-to-text, phoneme assessment, AI teacher, or certification. “Hidden-text recall” is the learner's own assessment. Multiple-choice success does not establish correct pronunciation or complete memorization.

The entire Quran, licensed offline recitation downloads, integrated translations/tafsir, mutashabihat curriculum, word-level audio alignment, child/family accounts, teacher dashboard, cloud sync, subscriptions, and social features are not implemented. Sharing a saved recording opens a share/export action; it does not deliver it to a connected teacher service.

## Develop

```bash
cd ayahflow
npm install
npm run typecheck
npm test
npm run dev
```

`npm install` needs internet. There is no included lockfile because dependency resolution was unavailable in the build container. Generate and review `package-lock.json` on the first successful installation; thereafter use `npm ci` for reproducible builds. Do not infer that dependency installation or a security audit has passed from the browser tests.

The web UI has no third-party runtime dependency. `npm run build` uses TypeScript to produce `www/` and regenerates the single-file preview. The native bridge is bundled separately by `npm run native:prepare` after dependencies are installed.

### iOS: first-time setup on a Mac

```bash
npm install
npm run ios:add
npm run ios
```

This creates the Xcode project with Capacitor, applies microphone metadata and starter icons, synchronizes the web build, and opens Xcode. Select your development team and a simulator or connected iPhone, then build/run in Xcode. Review `PrivacyInfo.xcprivacy` **target membership** and the privacy declarations before distribution.

Capacitor 8's documented environment requires Node 22+ and Xcode 26.0+. Check the current documentation before installing tooling: https://capacitorjs.com/docs/getting-started/environment-setup

### Android: first-time setup

```bash
npm install
npm run android:add
npm run android
```

This creates the Android Studio project, adds the microphone declaration and starter launcher/notification assets, synchronizes, and opens Android Studio. Choose a physical phone or emulator and run from the IDE. Capacitor 8 documents Android Studio 2025.2.1+ and an Android SDK installation.

Run `ios:add` / `android:add` only once per platform. Later, use:

```bash
npm run native:sync
npm run ios
# or
npm run android
```

`com.buildwithabdallah.ayahflow` is the configured development application ID, not a registered store listing. Confirm the application ID and product name before distribution. Launcher assets are installed once so later manual refinements are preserved. Native launch/splash appearance still requires review on devices.

### Native audio caveat

The recorder uses standard `getUserMedia` + `MediaRecorder` inside the WebView. Browser testing used a generated test stream. A real iPhone and Android device must confirm permission prompts, supported codecs, interruption handling, background transitions, Bluetooth routing, and playback. Unsupported devices show an error rather than a fabricated recording or score. See the release checklist for a potential native recording-adapter replacement if required by the supported device matrix.

## Privacy and audio

Progress uses browser localStorage, or native Preferences in the mobile adapter. Saved recordings use browser IndexedDB, or app-local Filesystem storage in the native adapter. Temporary previews use in-memory storage and display a warning. Nothing here guarantees recovery after uninstall, storage clearing, loss of a device, or operating-system cleanup.

The app does not upload recordings. Choosing **share** explicitly exports a clip through the browser or native share sheet. Device-level backups and the selected receiving app have their own policies. Native exported files temporarily exist in the app cache. “Delete all local data” removes the app's own progress and recordings; it cannot delete copies already shared or backed up elsewhere.

Reference recitation is **off by default**. Enabling it permits requests to Islamic Network's CDN, which receives the requester's IP address and the requested ayah. Audio is streamed on demand; it is not bundled or cached for offline redistribution. Live CDN access was not tested in the build container. The provider URL mapping was unit-tested.

Recitation rights remain with the relevant rights holders. Confirm commercial streaming, attribution, caching, and redistribution terms before release. The permissive nature of access is not a blanket commercial license. Sources: https://alquran.cloud/terms-and-conditions and https://alquran.cloud/api

## What the progress numbers mean

A next/previous/listen review records **quiz evidence**. Hidden-text recall records **self-assessed evidence**, excluded from quiz accuracy. Rule quizzes record lesson understanding, not pronunciation.

A review card is “retained” only after successful checks on at least three distinct local dates spanning at least seven days. This is an explicit product heuristic, not a validated probability of mastery. A miss clears the retained sequence and schedules a short review. Points reward participation, not religious merit.

See `docs/ARCHITECTURE.md` for the exact scheduler, failure behavior, and migration boundaries.

## Verification included

- **29 Node tests passed:** boundaries, 37-ayah integrity, unique canonical answer options, repeated-ayah ambiguity, deterministic questions, due prioritization, idempotency, scheduling, separated evidence, date arithmetic, backups and localization.
- **11 browser integration checks passed:** actual single-file UI, navigation, reader/search/bookmarks, consent gate, five-question session, pause/resume, progress, Tajweed quiz, generated-stream recording/save/delete, French/Arabic/reduced motion, responsive widths.
- **Strict TypeScript build passed.**

The browser environment forbids network navigation and real microphone capture. Tests rendered the local file using Playwright `set_content`, exercising the app's labelled temporary-storage mode. No browser security policy was changed. Audio was a synthetic Web Audio stream recorded by a real `MediaRecorder`, not a human recitation. Durable localStorage/IndexedDB, native adapters, live audio, real hardware and store builds are **not covered** by these results.

Evidence: `evidence/unit-tests.tap`, `evidence/browser-tests.json`, `evidence/browser-tests.log`, and actual UI screenshots.

The optional UI test runner requires Python + Playwright and a Chromium installation. Its Chromium path is adjustable in `tests/ui-smoke.py`.

## Repository layout

```text
src/
  app.ts       Screens, navigation, user actions
  engine.ts    Pure learning model, scheduler, validation
  data.ts      Source-indexed Arabic starter corpus and draft lessons
  i18n.ts      English / French / Arabic interface copy
  storage.ts   Web/native storage boundary and explicit temporary mode
  audio.ts     Recitation player and local recording lifecycle
  icons.ts     Original inline SVG interface artwork
public/        HTML, design system, manifest, original app icons
native/        Native bridge, privacy draft, launcher assets
scripts/       Web build, preview server, native bundle/configuration
www/           Included precompiled web build
tests/        Unit and browser tests
docs/         Architecture, provenance, roadmap, release gates
evidence/     Actual test results and screenshots
```

Read `AGENTS.md` before extending the app with a coding agent. Read `docs/RELEASE-CHECKLIST.md` before using this prototype with learners.
