# Beta release pack — AyahFlow 1.0 (build 1)

Prepared 2026-11-08 on `feature/mushaf-reader-accuracy`. Nothing here has been submitted: TestFlight, App Store and Google
Play submissions need the owner's approval. Store text below is a draft for the owner to edit; every claim in it is
backed by the build (see `RELEASE-CHECKLIST.md`, "Beta round 2026-11-08").

## Candidates

| Platform | Identifier | Version | State |
| --- | --- | --- | --- |
| iOS | `com.buildwithabdallah.ayahflow` (+ `AyahFlowWidget` extension) | 1.0 (1) | Development build signed (team KFHK4QSUC6) and installed on the owner's iPhone 16 Pro on 2026-11-08 as an in-place update; data verified before and after. A TestFlight build needs an Archive with distribution signing (owner's account). |
| Android | `com.buildwithabdallah.ayahflow` | 1.0 (versionCode 1), minSdk 24, targetSdk 36 | **Blocked on this Mac**: Gradle needs JDK 21 (only JDK 17 is installed), and both emulator system images are incomplete (no `system.img`; the emulator also lacks a Qt library). Not built or run in this round. |

Voice following (Tilawa, NPL-1.2) is **not included** (owner decision 2026-11-08). Beta builds are made without
`npm run voice:fetch`; `www/voice/` then holds only the capture worklet, and Settings says the feature is not included.

### Build commands (as run)

```sh
npm run typecheck && npm test                      # 314 tests
npm run native:prepare && npx cap sync ios         # check the output says "Copying web assets"; a plain `npm run build`
                                                   # before sync removes the native bridge and the copy hook refuses
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates -onlyUsePackageVersionsFromResolvedFile -disableAutomaticPackageResolution \
  -clonedSourcePackagesDirPath <SourcePackages> DEVELOPMENT_TEAM=KFHK4QSUC6 -derivedDataPath <out> build
xcrun devicectl device install app --device <iPhone UDID> <out>/Build/Products/Debug-iphoneos/App.app
```

For TestFlight: Xcode → Product → Archive (Release, automatic signing, team KFHK4QSUC6) → Distribute → App Store
Connect. Bump `CFBundleVersion` for every upload.

Android, once JDK 21 is installed (owner approval needed for the download):
`npm run native:prepare && npx cap sync android && cd android && ./gradlew bundleRelease` with an upload key the owner
keeps outside the repository (never commit a keystore or its passwords).

## App size (measured)

| Item | Size |
| --- | --- |
| iOS Debug `.app` for device, widget included (2026-11-08) | 36 MB on disk |
| … of which the web bundle (`public/`) | 29 MB: athan sounds 21 MB, JavaScript 3.8 MB, Quran fonts 2.2 MB, Quran text and data 1.5 MB |
| Voice model (not shipped) | ~75 MB; would only ever be an optional download, and is not in this beta |
| Android | not measured (not built in this round) |

The athan recordings are the largest part. If a smaller first download matters, the bundled reciters beyond the default
could become on-request downloads like the online ones (a product decision).

## Store listing draft (English)

**Name:** AyahFlow
**Subtitle (≤30):** Quran, hifz, prayer & adhkar
**Promotional text (≤170):** Read the whole Quran offline, keep a daily plan for reading and memorisation, and keep prayer
times and adhkar close — all on your device, with no account.

**Description:**

AyahFlow is a calm daily companion for the Quran, built to keep everything on your phone.

Quran
• The complete Quran (Tanzil Uthmani text, 6,236 ayahs) in a 604-page Madinah Mushaf layout, offline.
• Continue where you stopped; bookmarks, highlights and your own notes.
• Plan to finish the Quran over 7 to 60 days.

Memorisation and review
• Today's Quran: continue reading, your memorisation session, due reviews and difficult ayahs in one place, with days off.
• Memorise a few ayahs at a time: listen with repetition, recite with words hidden, reveal one word or the whole ayah.
• Your own "remembered / needs practice" answers schedule spaced reviews. AyahFlow does not grade pronunciation or
  Tajweed; for that, recite to a teacher.

Prayer and remembrance
• Prayer times calculated on the device for your saved place, athan and reminders, and a private Salah record.
• Adhkar for morning, evening and daily moments, each with its source.
• Qibla direction, tasbih counters and widgets.

Private by design
• No account, no analytics, no advertising. Your data stays on your device; export or delete it any time.

Notes for honesty in the listing: the four Tajweed lessons are drafts awaiting a qualified teacher (labelled in the app);
adhkar wording and sources are shown but have not yet been reviewed by a scholar for this app; prayer times should be
checked against the local mosque (said in the app).

**Keywords (≤100):** quran,hifz,memorize,mushaf,prayer times,adhkar,dhikr,salah,qibla,tasbih,islam,muslim

**What to test (TestFlight):** the Home plan (continue reading, memorise, review); closing the app during memorisation and
continuing; the Mushaf reader (page turns, scrolling a long page, highlights and notes); prayer times for your saved place
and the athan; reminders on your chosen days; widgets; backup and restore from Settings.

French and Arabic listings: translate from the in-app strings of the same features; have a native speaker check them.

## Screenshots (real, from the app)

`evidence/beta-2026-11-08/iphone-6.3-{1-home,2-reader,3-hifz,4-prayers,5-adhkar}.jpg` — iPhone 16 Pro simulator (iOS
18.6), 1206 × 2622, simulator test data with a New York place, status bar set to 9:41. App Store Connect requires the
6.9" set (1320 × 2868, iPhone 16 Pro Max simulator): the app is installed there, but taking that set needs the simulator
panel's access for that device, which was not granted in this session.

## App Store privacy ("nutrition label") and Play data safety

- **Data collected: none.** No analytics, advertising, tracking, crash reporting or account. `NSPrivacyTracking` false,
  no collected data types (`ios/App/App/PrivacyInfo.xcprivacy`; required-reason APIs: UserDefaults CA92.1, file
  timestamps C617.1).
- Network: only when the user turns on online recitation audio (`cdn.islamic.network`) or taps to download an athan
  (`cdn.aladhan.com`). These services see an IP address and the requested file, as any website does; AyahFlow sends
  nothing about the user. Play data safety: "No data collected", "No data shared".
- Privacy policy: `site/privacy/index.html` (updated 2026-11-08 for this beta) → ayahflow.buildwithabdallah.com/privacy.

## Permissions and the justifications reviewers will ask for

| Permission | When it is asked | Justification text |
| --- | --- | --- |
| Microphone (iOS, Android) | Only after the user taps record | Records the user's own recitation practice; stays on the device. |
| Notifications | When the user sets a reminder, athan or alarm | Reminders the user chooses. |
| Location When In Use | When saving a place | Prayer times and Qibla for saved places; coordinates stay on the device. |
| Location Always / `ACCESS_BACKGROUND_LOCATION` | Only if the user turns on place reminders | Dhikr reminder on leaving/arriving at a saved place with the app closed. **Google Play needs the background-location declaration form and a video; App Review needs the same explanation.** If not ready, ship the beta with place reminders labelled iOS-only or hidden on Android. |
| Motion / `ACTIVITY_RECOGNITION` | Only if the user turns on the travel reminder or steps | Riding du'a and the step count; on the device only. |
| AlarmKit (iOS 26+) | When the Fajr alarm is turned on | The Fajr alarm the user sets. |

Android `allowBackup="true"`: Google's device backup may include the app's data (disclosed in the policy). Keep, so a new
phone restores progress; revisit if the owner prefers backups to be opt-in only.

## Licences and notices

`docs/THIRD-PARTY-NOTICES.md` is current for this build: Tanzil text CC BY 3.0 (verbatim), AyahFlow Quran font (OFL, from
DigitalKhatt Madina and Amiri Quran), me_quran (non-commercial; included at the owner's decision of 2026-10-31 — confirm
that store distribution of a free app is acceptable, or remove the choice), adhan-js MIT, hadith texts Unlicense, athan
recordings CC0 / CC BY / CC BY-SA, Tajweed annotations CC BY 4.0. The NPL-1.2 model is not in this build.

## Decisions and actions only the owner can take

1. Approve: TestFlight upload; Play internal-testing upload.
2. Install JDK 21 and repair the Android emulator images (or connect an Android phone) so the Android candidate can be
   built and run.
3. Grant simulator-panel access to the iPhone 16 Pro Max simulator for the 6.9" screenshot set, or take them in Xcode.
4. Google Play background-location declaration, or keep place reminders off on Android for the beta.
5. Qualified review: Tajweed lesson drafts, adhkar wording and sources, the prayer notes. Labels stay "pending" until then.
6. Licence: Tilawa/NPL-1.2 distribution (feature stays off until resolved); me_quran store distribution.
7. On the iPhone: VoiceOver pass of the reader and the plan; widgets after this update; a Saturday (day off) with the
   practice reminder set.
