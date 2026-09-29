# Release gates — do not mark complete without evidence

## Already verified in the delivery environment

- [x] Strict TypeScript web build succeeds.
- [x] 29 learning/data/localization unit tests pass.
- [x] 11 browser checks of the real single-file application pass.
- [x] Questionnaire evidence, self-checks and lesson understanding remain separate.
- [x] No fabricated AI pronunciation score is displayed.
- [x] Screenshots captured from the running UI, not generated marketing mockups.
- [x] No observed horizontal overflow in the four main views across 320/390/412/430/1024-pixel widths during the Arabic-layout test.
- [x] Microphone workflow exercised with a generated test stream and a real MediaRecorder Blob; tracks end on stop.
- [x] Temporary preview mode is visibly labelled; it does not claim durable saving.

## Native compilation and device testing

- [ ] Install dependencies; review resolved versions and generate a lockfile.
- [ ] Run a dependency audit and review vulnerabilities before distribution.
- [ ] Generate the iOS/Android platform projects and confirm native bridge bundling.
- [ ] Compile an iOS development build in Xcode and an Android development build in Android Studio.
- [ ] Test on at least one physical iPhone and one physical Android phone, not only emulators.
- [ ] Confirm durable Preferences state and Filesystem audio across relaunch, force-stop and upgrade.
- [ ] Confirm ordinary-browser localStorage / IndexedDB persistence and export/restore separately from the temporary preview test.
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
- [ ] Add versioned migrations before changing the state schema.
- [ ] Add native file/index reconciliation or transactional storage before claiming crash consistency.
- [ ] Introduce an appropriate database before large-corpus/history/sync growth; Preferences is not a database.
- [ ] Review browser CSP and HTTPS deployment headers.
- [ ] Test VoiceOver and TalkBack, focus order, touch targets, contrast, reduced motion and large Arabic text.
- [ ] No API keys, signing keys, credentials or identifiable recordings in source, logs or test fixtures.
- [ ] If any cloud/AI service is introduced, create explicit audio-consent, deletion, retention, access-control and data-location policies before upload.

## Distribution

- [ ] Confirm the AyahFlow name and bundle/application ID can be used for the intended release.
- [ ] Replace development signing with the owner's provisioning/signing workflow.
- [ ] Run TestFlight/internal Android testing and resolve device issues.
- [ ] Prepare actual store screenshots and accurate capability descriptions.
- [ ] Review account/child/subscription obligations only when those capabilities are implemented.
- [ ] Build signed distribution artifacts and submit through the owner's developer accounts.

There is no IPA, APK, store publication, or guaranteed store acceptance in this delivery.
