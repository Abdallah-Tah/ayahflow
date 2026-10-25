# Release gates — do not mark complete without evidence

Status as of 2026-10-25, branch `feature/mushaf-design-locate`. Each tick names its evidence. Browser and unit tests do
not stand in for native, simulator or device results, and nothing here is a store, privacy or accuracy certification.

## 1. Automated tests (done)

- [x] `npm run typecheck` (strict TypeScript, app and voice worker) passes.
- [x] `npm test`: 115 Node tests in 5 files pass (engine, adhkar, worship, release, dst-athan). They cover, among others:
  the corpus checksum and verbatim text, migrations up to schema v13 without reset, idempotent writes, prayer times for
  every method across both 2026 US DST changes, time-zone changes, Hanafi Asr, the prayer day around midnight,
  high-latitude Isha after midnight and at or after the next Fajr, unique athan ids for a year at 51–60°N, the Ayah of
  the Moment changing every 30 elapsed minutes across America/New_York 2026-03-08 and 2026-11-01 (and half-hour /
  45-minute zones), the widget's bundled verse pool matching the app's, and tracking that never changes by itself.
- [x] The Swift `MomentClock` (widget) and `slotOf` (app) give identical slots for 15,450 sampled instants in five time
  zones around their DST changes (compiled on the Mac with `swiftc`, compared line by line; a one-off check, not in `npm test`).
- [x] Original v0.1 delivery: 11 browser checks of the single-file app (evidence/browser-tests.json); not re-run since.
- [x] Questionnaire evidence, self-checks and lesson understanding remain separate; no AI pronunciation score is shown.

## 2. Native builds (done for iOS only)

- [x] Dependencies installed from `package-lock.json`; `npm run native:sync` copies the web build into the iOS project.
- [x] iOS Debug build for a physical iPhone (Xcode 27.0, `xcodebuild … -configuration Debug -destination id=<iPhone>`):
  BUILD SUCCEEDED for the app and the AyahFlowWidget extension at commit 170a765.
- [x] Signing: app and widget are signed by team KFHK4QSUC6 (development, `get-task-allow`); `codesign --verify --deep --strict`
  passes; both carry the keychain group `KFHK4QSUC6.com.buildwithabdallah.ayahflow.shared`, and both Info.plists resolve
  `AyahFlowSharedKeychain` to that group. `AyahMoments.json` in the built widget is byte-identical to the repository's.
- [ ] Android development build in this QA round (not built; an older `android/app/build` output exists but was not checked).
- [ ] Release (not Debug) configuration and distribution signing.
- [ ] Dependency audit (`npm audit`) reviewed before distribution.

## 3. Simulator tests

- [x] iPhone 16e simulator: the app launches and the Home screen renders (read-only `simctl` screenshot, previous QA round).
- [ ] Widgets on the simulator: not tested (adding widgets needs interaction that was not available).

## 4. Real iPhone tests (iPhone 16 Pro, development build)

- [x] In-place update installed with `devicectl device install app` and launched (`devicectl device process launch`),
  built from the clean tracked tree at 170a765 (the device reports only version 1.0 (1), not a commit).
- [x] Saved data survives the update: schema 13, the chosen calculation method unchanged, athan on, Home saved,
  salah records, dhikr counts and XP present (read from the app's own data container, local copy then deleted).
- [x] Lock Screen rectangular Du'a widget showed only the reference before c40ea6f (user screenshot). The fix is
  measured on the Mac (48/58 du'as and 390/517 moment ayahs fit whole); **not yet confirmed on the phone**.
- [x] User-reported pass, 2026-10-25, build 170a765 (reported in chat; no screenshots, so not screenshot-verified):
  - Prayer widget: the requested check covered small/medium/large and Lock Screen, light and dark, next prayer,
    countdown, Hijri and Gregorian dates, and the Arabic text.
  - Prayer confirmation: the widget checkmark appears after marking a prayer in the app.
  - Ayah of the Moment rotation: the widget changed between half hours (the over-a-day check is still open, see section 5).
  - Dhikr persistence: counts kept after force-quit and relaunch.
  - Athan notification: fired as expected.
- [ ] The rest of section 5.

## 5. Not yet done (needs a person with the phone, or later work)

Widgets (iPhone, after 170a765):
- [ ] Before Fajr the widget shows the previous day's prayers and checkmarks (not part of the user-reported check).
- [ ] Ayah of the Moment widget keeps changing for more than a day without opening the app. Pending: the build was
  installed on 2026-10-25 around 17:20, so check on 2026-10-26 after 17:20 at the earliest (the extension computes the
  rotation; WidgetKit decides when it redraws, so a change can come a little after the half hour).
- [ ] A widget write failure is shown on the Prayers page (simulate only if a safe way exists; otherwise review Console logs,
  subsystem `com.buildwithabdallah.ayahflow`, category `widget`).

App on the iPhone:
- [ ] Guided tasbih progress after force-quit, and no double counting (dhikr counts themselves: user-reported pass above).
- [ ] Athan over several days: every enabled prayer fires once, nothing duplicated after reopening the app; behaviour
  after a time-zone change and the next DST change (a single Athan: user-reported pass above).
- [ ] Offline use (airplane mode): prayer times, Quran, adhkar and widgets.

Native compilation and device testing (carried over):
- [ ] Test on at least one physical Android phone, not only emulators.
- [ ] Confirm durable Preferences state and Filesystem audio across relaunch, force-stop and upgrade on Android.
- [ ] Confirm ordinary-browser localStorage / IndexedDB persistence and export/restore separately from the temporary preview test.

## Native audio, storage and platform behaviour (not yet done)

- [ ] Test microphone grant, denial, revocation, restricted device, first use and repeat use.
- [ ] Test successful recording/playback with each platform's actual MIME type; reject unsupported recording reliably.
- [ ] Test incoming calls, Siri/assistant interruption, Bluetooth, headphones, screen lock, app switching and device rotation.
- [ ] Confirm no ongoing capture after stop, cancel, background, permission failure or error.
- [ ] Replace WebView recording with an appropriate native adapter if the supported device matrix requires it; do not fake support.
- [ ] Test saving failures, full storage, file/index mismatch and recovery after interrupted writes.
- [ ] Verify native share sheets, exported format playback in receiving apps, and cache cleanup.
- [ ] Verify local reminders, denial, time-zone changes, daily repeat, cancellation and reinstall behavior.
- [ ] Verify native safe areas, keyboard behavior, text zoom, system bars, launcher icons and splash appearance.
- [ ] Confirm external source/tafsir links open outside the privileged app WebView.

## Voice following (experimental)

- [x] Model files are checksum-pinned, fetched at build time, and not committed; the app makes no network call to use them.
- [x] Browser end-to-end check: a recorded recitation of Al-Ikhlas (fake microphone) is followed ayah by ayah and word by word; stop ends capture; nothing is written to progress.
- [ ] Test on a physical iPhone and Android phone: permission prompt, first-load time, memory, heat/battery, interruption (call, Siri, lock), and that capture stops on Stop/leave/background.
- [ ] Evaluate following accuracy with real learners' recitation (not only a professional reciter), including noise and children's voices; document failure modes.
- [ ] Legal review of NPL-1.2 for the intended distribution; confirm the app and this feature stay free of charge and advertising.

## Smart reminders

- [x] Rules engine, timed-reminder ids, prayer windows, completions and v5 migration covered by unit tests.
- [x] Adhkar texts verified offline as verbatim slices of committed source hadiths; grades recorded; weak entering-home wording excluded.
- [ ] Physical iPhone: Home/Work/Mosque exits and entries with the app closed, after force-quit, after reboot, in Low Power Mode; measure delay.
- [ ] Physical iPhone: vehicle reminder on real drives (significant-change wake + motion history) and the CarPlay/Bluetooth Shortcut route.
- [ ] Physical Android: geofences and `IN_VEHICLE` transitions with battery optimisation on/off, after reboot (BootReceiver), on Android 10–15.
- [ ] Notification taps open the right moment from a cold start on both platforms.
- [ ] Permission flows: denial, "While using" only, precise location off, revocation, and that features turn themselves off honestly.
- [ ] App Store / Play review of background-location justification and the in-app explanation.
- [ ] Scholar review of every adhkar entry, the prayer-surah notes and the morning/evening window options.

## Quran and learning quality

- [ ] Qualified reviewer checks the Arabic corpus and all displayed glyphs/marks against the chosen convention.
- [ ] Reviewer signs off each Tajweed lesson and all three language versions.
- [ ] Publish actual content-version/reviewer metadata; do not substitute a checksum for approval.
- [ ] Validate the reference recordings and text/ayah mapping by listening, not only matching integer IDs.
- [ ] Record streaming, offline-download and commercial licensing decisions with required attribution.
- [ ] Test distractor ambiguity and difficulty with real learners.
- [ ] Describe retention as a heuristic unless a properly designed evaluation supports a stronger claim.
- [ ] Establish a correction-reporting and reviewed content-update process.

## Privacy, security and reliability

- [ ] Review privacy policy and any store data declarations against actual runtime behavior and provider traffic.
- [ ] Verify PrivacyInfo.xcprivacy is included in the correct Xcode target; reassess declarations when plugins or network services change.
- [ ] Review OS backup inclusion/exclusion, restoration and recording retention policy.
- [ ] Test corrupt/missing saves and explicit import without accidental overwrite.
- [x] Versioned migrations (schema v13) with tests; saved data is migrated, never reset.
- [ ] Add native file/index reconciliation or transactional storage before claiming crash consistency.
- [ ] Introduce an appropriate database before large-corpus/history/sync growth; Preferences is not a database.
- [ ] Review browser CSP and HTTPS deployment headers.
- [ ] Test VoiceOver and TalkBack, focus order, touch targets, contrast, reduced motion and large Arabic text.
- [ ] No API keys, signing keys, credentials or identifiable recordings in source, logs or test fixtures.
- [ ] If any cloud/AI service is introduced, create explicit audio-consent, deletion, retention, access-control and data-location policies before upload.

## Distribution

- [ ] Confirm the AyahFlow name and bundle/application ID can be used for the intended release.
- [ ] Replace development signing with the owner's provisioning/signing workflow.
- [ ] Run TestFlight/internal Android testing and resolve device issues (only with the owner's approval).
- [ ] Prepare actual store screenshots and accurate capability descriptions.
- [ ] Review account/child/subscription obligations only when those capabilities are implemented.
- [ ] Build signed distribution artifacts and submit through the owner's developer accounts.

There is no IPA, APK, store publication, or guaranteed store acceptance in this delivery.
