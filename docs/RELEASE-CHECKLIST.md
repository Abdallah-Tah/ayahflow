# Release gates — do not mark complete without evidence

Status as of 2026-10-25, branch `feature/mushaf-design-locate`. Each tick names its evidence. Browser and unit tests do
not stand in for native, simulator or device results, and nothing here is a store, privacy or accuracy certification.

## Beta round 2026-11-08 (`feature/mushaf-reader-accuracy`, phases 3–9)

PASS = run and passed, with the evidence named; FAIL = run and failed; BLOCKED = could not be run here (reason given);
NOT TESTED = not attempted in this round. Simulator = iPhone 16 Pro, iOS 18.6, Debug build of the commit under test.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | strict TS, app and voice worker |
| `npm test` | PASS | 314/314 (`tests/*.test.mjs`) |
| `npm run build`, `native:prepare`, `cap sync ios`, iOS simulator and device builds | PASS | BUILD SUCCEEDED; `codesign --verify --deep --strict` OK |
| Quran corpus and checksums | PASS | `quran-uthmani.xml` c5052534…81244, `quran-data.xml` 8867c1d8…c5c7a; `content/` and fonts unchanged vs `4fc670e` and `origin/main`; all 604 pages equal the corpus |
| Migration v27 → v28 (unit) | PASS | `tests/daily.test.mjs`: every v27 field kept; bad sessions and days off rejected, not reset |
| Migration v27 → v28 (simulator, existing data) | PASS | after the first save only `version`, `hifz`, `daysOff` differ from the pre-update snapshot |
| Migration v27 → v28 (owner's iPhone, real data) | PASS | backup copied and SHA-256-verified first; dry run on that data; after the in-place install the save is v28 with cards, attempts, bookmarks, khatm, places, reminder, counts, adhkar log and 191 Salah records identical; downloaded athan files byte-identical. `detections` changed by one new wake event (a rolling 50-entry log) |
| Daily plan: reading, memorisation, due reviews, difficult ayahs, today's records | PASS | unit tests; Chromium 320/375 px en + ar RTL; simulator |
| Memorisation saved and resumed after force-quit | PASS | simulator: `simctl terminate` → relaunch shows "Continue memorising" at the saved ayah; browser reload resumes at ayah 2 of 3 |
| Hifz answers are self-assessed recall, idempotent; revealing words saves nothing | PASS | unit tests; browser: one attempt `hifz:<session>:88`, evidence `self-assessed` |
| Practice reminder on weekdays (days off) | PASS (simulator) | Saturday off → weekday schedule; fired 19:29 Sunday with "A few minutes with the Quran today." Skipping on the day off itself: unit test only |
| Notification permission only after a tap | PASS (simulator) | prompt appeared on "Set reminder" |
| Microphone: no request before a tap; backgrounding stops recording and keeps the clip | PASS (simulator) | record → Home button → back: idle mic, "Your recording" listed |
| Deep links (`ayahflow://counter/…`, `/ayah/…`, `/home`) on iOS | PASS (simulator) | each opened the right screen |
| Android widget links (`/prayer`, `/ayah`, `/counter`, `/steps`, `/home`) | FIXED, NOT RUN | the manifest filter accepted only `/moment`; widened (static evidence, regression test) |
| Unreadable save can be copied out before reset | PASS (browser) | version-99 save: exported file identical, store untouched |
| Privacy policy and permission strings match the beta | PASS | voice following described as not included; OS backups disclosed; mic string updated; tests in `privacy.test.mjs` |
| Dependency audit | PASS (runtime) / NOTE (dev) | `npm audit --omit=dev`: 0. Dev tooling (Capacitor CLI → xcode → uuid; glob/minimatch/rimraf): 6 moderate, not shipped; `npm audit fix` left for a separate change |
| Secrets in the repository | PASS | pattern scan of tracked files: none |
| App icon | PASS | 1024 px, no alpha; Android mipmaps incl. adaptive |
| Android build, emulator or phone | BLOCKED | Gradle needs JDK 21 (JDK 17 installed); both AVD images lack `system.img`; emulator lacks a Qt library. Downloads need owner approval |
| VoiceOver / TalkBack | NOT TESTED | Accessibility Inspector access was declined earlier; no device session |
| iOS Dynamic Type for interface text | FAIL (known gap) | UI sizes are fixed px; documented in `BETA-PLAN.md` |
| Widgets after this update (iOS, Android) | NOT TESTED | |
| Offline (airplane mode) on a device | NOT TESTED | static: no network call except opt-in recitation audio and athan downloads |
| Physical-iPhone UI checks of this round's features | NOT TESTED | installed and data verified; UI not driven (devicectl cannot tap) |
| 6.9" App Store screenshots | BLOCKED | simulator-panel access not granted for the Pro Max simulator; 6.3" set in `evidence/beta-2026-11-08/` |

## 1. Automated tests (done)

- [x] `npm run typecheck` (strict TypeScript, app and voice worker) passes.
- [x] `npm test`: 130 Node tests in 8 files pass (engine, adhkar, worship, release, dst-athan, before-prayer, places, athan-home). They
  cover, among others: the corpus checksum and verbatim text, migrations up to schema v15 without reset, idempotent writes, prayer times for
  every method across both 2026 US DST changes, time-zone changes, Hanafi Asr, the prayer day around midnight,
  high-latitude Isha after midnight and at or after the next Fajr, unique athan ids for a year at 51–60°N, the Ayah of
  the Moment changing every 30 elapsed minutes across America/New_York 2026-03-08 and 2026-11-01 (and half-hour /
  45-minute zones), the widget's bundled verse pool matching the app's, and tracking that never changes by itself;
  the reminder before prayer (exactly N minutes before each chosen prayer, never sunrise, both 2026 New York DST changes,
  Oslo Isha after midnight, ids 18–22 × 10⁶ clear of every other kind, re-planning without duplicates, the 64-notification
  budget with athans first, the requested EN/FR/AR wording), the saved-place cards (one button per area, invalid areas ignored)
  and the athan at Home only (off after migration; needs athan sound, the switch and a saved Home; same alerts and times;
  the iOS swap plays the athan only when Home is known to be inside).
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
- [x] Build with the reminder before prayer and the places fix (Debug, iPhone 16 Pro, 2026-10-25 ~19:56): BUILD
  SUCCEEDED for app and widget, `codesign --verify --deep --strict` passes, installed in place with `devicectl` and
  launched. Data container after the update: schema 14, `athan.before` = off / 15 min (not switched on), method
  NorthAmerica, athan on with the same reciters, Home at 150 m, 4 salah records, 9 count days (712 in total), XP 54 and
  the reading position (18:10) unchanged. `Library/Sounds/ayahflow-prayer-chime.caf` (190 KB) installed beside the athan
  sounds. Console after launch: no reminder-sync error, 35 notifications pending (of 64).
- [x] iOS Simulator build (iPhone 16 Pro, iOS 18.6) of the same tree: BUILD SUCCEEDED. Not launched (simulator panel access
  was not granted), so the settings were checked in the browser instead: Places cards and the Prayers → Times & Athan
  section at 320/360/390/430 pt in EN/FR/AR, no overlap or horizontal scroll.
- [ ] The rest of section 5.

## 5. Not yet done (needs a person with the phone, or later work)

Widgets (iPhone, after 170a765):
- [ ] Before Fajr the widget shows the previous day's prayers and checkmarks (not part of the user-reported check).
- [ ] Ayah of the Moment widget keeps changing for more than a day without opening the app. Pending: the build was
  installed on 2026-10-25 around 17:20, so check on 2026-10-26 after 17:20 at the earliest (the extension computes the
  rotation; WidgetKit decides when it redraws, so a change can come a little after the half hour).
- [ ] A widget write failure is shown on the Prayers page (simulate only if a safe way exists; otherwise review Console logs,
  subsystem `com.buildwithabdallah.ayahflow`, category `widget`).

- [x] Build with "Soft beep away from Home" (Debug, iPhone 16 Pro, 2026-10-26): BUILD SUCCEEDED, `codesign --verify
  --deep` passes, installed in place with `devicectl`. Launch was refused because the phone was locked, so the v15
  migration on the device and the console were not checked yet.

Quran reader redesign (build of 2026-10-27; schema v17 adds reading theme and reader size, off-by-default changes none):
- [x] Browser (402×874, 375×667, 320×568): pages 1, 3, 50, 106, 153, 442, 604 and every 6th page fit with no scroll
  or overflow (text 18.7–22.9 px at 402×874); verse sheet, settings, go-to, reading styles, Easy reading, Night/Classic,
  Arabic RTL checked with real renders.
- [ ] iPhone: swipe and arrows turn pages; one tap hides and shows the bars; the place is restored after relaunch.
- [ ] VoiceOver: bar buttons, each ayah (reference, highlight/note), sheet actions. iOS Larger Text does not resize the
  web view; the reader has its own size control (Easy reading / verse by verse).
- [ ] Printed fifteen-line pages: needs a publisher decision (Quran Foundation account and terms, or a licensed layout);
  see docs/CONTENT-PROVENANCE.md.

Mushaf page accuracy and spacing (branch `feature/mushaf-reader-accuracy`, 2026-11-08; no schema change):
- [x] `tests/quran-pages.test.mjs`: every verse of all 604 pages, read back from the page markup, is the Tanzil string
  exactly (no normalisation), in page order, once; same code points and counts as the corpus; medallion numbers;
  headings and basmala only where a surah starts (none for 1 and 9); Juz' and Hizb from each page's first verse;
  pages 1, 2, 162 (7:88–95, Juz' 9, Hizb 17) and 604.
- [x] Browser (Chromium), all 604 pages at 320×568, 375×667, 375×812, 390×844, 430×932 and 844×390: no sideways
  scroll, no text outside the page, nothing under the running header or the page number. Widest word gap at 375×812:
  median 0.80 → 0.67 em, pages over 1 em 92 → 4. Pages that scroll at the 16 px minimum: 377 at 320×568, 1 at
  375×667, 12 at 844×390, none at 375×812 and wider.
- [x] Fixed: page 162 drew 7:92 with wrong glyphs after a line break (Chromium, default font).
- [x] The 7:92 glyph fault is Chromium-only. A test page narrowed page 162 until يَغْنَوْا۟ starts a line (the failing
  condition), at 20.65 px in AyahFlow Quran: the old one-run markup is garbled in Chromium and correct in WebKit (iOS
  18.6 Simulator Safari); the word-span markup is correct in both. The old markup in WebKit also showed a pause sign
  starting a line (page 162, «ۚ عَلَى ٱللَّهِ»); with the word spans it stays with its word.
- [x] iOS Simulator app (iPhone 16 Pro, iOS 18.6, Debug build of 11878d9), Madinah Mushaf (DigitalKhatt) chosen in
  Settings, page 162 from `ayahflow://ayah/7:92`, Classic and Night: 7:92 whole, nothing doubled or missing; tapping a
  verse opens its menu.
- [ ] Physical iPhone: the same pages with the default font; rotation refits the page; a scrolling page scrolls and
  still turns by swipe.

Landscape and tablets (2026-11-08): Mushaf lines stop at 26 em (about 12–14 words), centred, with the header and page
number on the same column; the 16 px minimum is kept, so a page that does not fit scrolls vertically.
- [x] Browser (Chromium), all 604 pages: 844×390 (489 scroll), 932×430 (268), 667×375 (586), 1024×768, 768×1024 and
  1366×1024 (none scroll, text 20–34 px). No sideways scroll, no text outside the page, nothing under the header or the
  page number, scrolling reaches the end. Portrait 320–430 px wide is unchanged (the column is wider than the screen).
- [x] iOS Simulator app (iPhone 16 Pro, iOS 18.6, Debug build with this change), Madinah Mushaf font, Night, page
  162: rotating to landscape refits the page into the centred column; it scrolls vertically to the end and the page
  number; 7:92 whole.
- [ ] iPad and a physical phone in landscape.

Reader accessibility, keyboard and reading place (2026-11-08, after 3f11ebe; no schema change):
- Fixed: each verse button had `aria-label="Al-A'raaf 7:92"`, which replaces its content, so a screen reader heard only
  the reference, never the Arabic. The button is now named by its content (the verse, `lang="ar"`, and its medallion
  "Ayah 92" in the app's language) and described (`aria-describedby`) by a hidden reference, highlight and note, kept
  outside the verse so its text stays exactly the corpus string (Arabic interface: «سورة الأعراف 7:92»).
- Fixed: every verse was a Tab stop (up to 42 on page 585, 286 in Easy reading of Al-Baqarah). A page or surah is now one
  Tab stop (the verse last opened or read); ↑/↓ and Home/End move between verses; ←/→ still turn the page. Enter/Space
  now also open a verse in Easy reading (they did nothing there). After keyboard use, closing the verse menu puts focus
  back on that verse; after a touch it does not (WebKit would draw the focus ring).
- Fixed: on a page that scrolls, a scroll that drifted sideways could turn the page (seen in the iOS Simulator app:
  up first, then left, turned 162 → 161). iOS WebKit can hold touchmove back while it scrolls, so the page now treats
  "it scrolled under the finger" as a scroll as well as "it moved up or down first".
- Fixed: opening and closing a reader sheet (verse menu, reading settings, jump) moved a scrolled page. WebKit's
  `showModal()` and `close()` scroll the page's own scroller (logged in iOS 18.6 Simulator Safari: 296 → 212 px), and
  closing the verse menu redrew the page at the top. The place is now kept across the sheet, a highlight, a bookmark, a
  theme change and a refit.
- [x] `npm run typecheck`, `npm test` (301 pass), `npm run build`; Chromium 667×375 and 874×402: accessible name
  inputs, one Tab stop, ↑/↓/Home/End, Enter/Space, Esc, focus back after keyboard only, scroll kept after Close,
  highlight and bookmark.
- [x] iOS Simulator app (iPhone 16 Pro, iOS 18.6, Debug), landscape, Madinah Mushaf font: page 162 correct in Classic,
  Night and Auto (Auto shows Night with the app appearance set to Dark), after rotation and after quitting and reopening
  the app; drift gesture keeps 162 and scrolls; a sideways swipe still turns to 163 and back; theme change from a
  scrolled page keeps the place; highlight, bookmark and "Continue reading" survive a relaunch.
- [x] iOS Simulator Safari (same WebKit): scroll kept across the verse menu and a highlight (329 px before and after).
- [x] Development build for the iPhone (`generic/platform=iOS`, team KFHK4QSUC6) builds and is signed with a profile that
  lists the paired iPhone 16 Pro. Not installed in this round.
- [ ] VoiceOver itself (simulator or device): not run. The markup and Chromium's DOM were checked; WebKit's
  accessibility tree was not read (Accessibility Inspector access was declined).
- [ ] Physical iPhone and Android: not run in this round.
- [x] Fixed (2026-11-08, second round): in the iOS app WebKit itself scrolled a landscape page when the system
  appearance changed (logged with a temporary on-screen probe: 264 → 45 px, no resize, render or font event before
  it). The app remembers the place the reader chose (touch, wheel, keys, or the app keeping it) and puts it back on the
  colour-scheme change and on returning to the app. Simulator: three switches, each jump undone at once (264 px kept).
- [x] Fixed: the hidden reader bar and footer let touches through; a drag that starts in the bottom band scrolls
  (simulator, logged).
- [x] Fixed: the verse-menu preview keeps the first letter of a line (7:92, 7:94 in landscape, simulator).
- [x] Fixed: "Continue reading", search results and `ayahflow://ayah/s:a` links open at the verse (saved as that verse,
  not the page's first) and bring it into view on a page that scrolls (`ayahflow://ayah/7:94` in the simulator).
- [x] Fixed: after a touch, a sheet focuses itself instead of its first button, so no focus ring is drawn; with the
  keyboard, focus still starts on the first action (Chromium; simulator screenshot shows no ring).
- [ ] Android: none of the reader fixes has been run on an Android WebView yet.

Reader pages, verse menu and Mushaf chooser (iPhone, build of 2026-10-26 ~19:15; schema v16 migrated on the phone with
all data kept; device screenshot shows the verse menu on 2:14, page 3):
- [ ] Turn pages by swiping (right = next) and with the arrows; the place is kept after closing the app.
- [ ] Highlight, change colour, remove; add, edit and delete a note; both survive a restart and appear in an export.
- [ ] Play to the end of the juz' plays verse after verse and stops with the banner's stop button; Repeat loops one verse.
- [ ] Copy and Share from the menu; the translation sheet shows Pickthall and says tafseer is unavailable.
- [ ] VoiceOver: each ayah on a page is a button with its reference; Larger Text keeps the page readable.

Athan at Home only (iPhone, build of 2026-10-26):
- [ ] Open the app once (migrates to v15; the new switch is off). Prayers → Times & Athan → Athan sound → turn on
  "Soft beep away from Home"; location must be Always. "Right now" shows at Home / away.
- [ ] At Home, "Test athan sound" plays the reciter; away from Home (past the Home area, a few minutes later) it plays the
  soft beep. Only the user can confirm what is heard.
- [ ] A real prayer while away gives the beep; at Home the athan. Times and taps unchanged.
- [ ] Android: not implemented (the switch is hidden there; Android takes the sound from the notification channel).

Reminder before prayer and notification sounds (iPhone, build of 2026-10-25 ~19:56):
- [ ] Places screen on the phone: Home card shows 100/150/200/300/500 m as separate buttons, gold on the chosen one.
- [ ] Turn on Prayers → Times & Athan → "Remind me before each prayer"; the "Next reminder" line shows the prayer time
  minus 15 minutes.
- [ ] "Test 15-minute reminder" with the phone locked and the Ring switch on: the chime is heard (only the user can confirm;
  the diagnostics only show permission, sound setting, sound file and that iOS kept the request).
- [ ] "Test athan sound": the selected reciter's alert is heard (separately from the chime).
- [ ] A real reminder 15 minutes before a prayer plays the chime, not the athan, and the athan still comes at the prayer
  time; tapping either opens the Prayers screen.
- [ ] With Silent mode on, both arrive without sound; with a Focus that silences AyahFlow, neither breaks through.
- [ ] The athan "Gentle alert" option now plays the chime on iOS (it had no sound property before this build).

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
- [x] Location access dropped to "While Using": Home and Adhkar show a paused card and Recently detected logs "Background location stopped/restored" (watch-off.test.mjs). On the iPhone 16 Pro it logged WATCH_OFF with whenInUse, which explained the missing trips after 26 Oct 16:11.
- [ ] Physical iPhone: switch Location back to Always and confirm "Background location restored" and the next trip appear.

## Qibla, Jumu'ah, voluntary fasts and highlight review (v18)

- [x] Unit tests: Qibla bearings for New York, London, Jakarta and Sydney within 0.5°; turn direction; Umm al-Qura dates; fasting days never in Ramadan, on either Eid or the days of Tashreeq; reminder ids (24, 25 × 10⁶) clear of every other reminder and inside the 64-notification budget; v17 → v18 migration; one review answer per verse and day, never scored (calendar-qibla-review.test.mjs).
- [x] Browser (402×874 and 320×568, Arabic RTL): Qibla tab dial and figures, four prayer tabs fit with no sideways scroll, fasting list, review screen (recall, show, answer).
- [x] iOS build succeeds (generic iOS device) and installs on the iPhone 16 Pro. Not yet opened there: the phone was locked.
- [ ] Physical iPhone: compass turns with the phone, "Turn left/right" and "facing the Qibla" agree with a known qibla; calibration message near metal; compass stops when leaving the tab or the app (no heading updates in the background).
- [ ] Physical iPhone: Jumu'ah reminder Friday 90 min before Dhuhr opens Al-Kahf 18:1; fast reminder the evening before; taps from a cold start.
- [ ] Android: no compass yet (the bearing and distance show; live heading is iPhone only).
- [ ] Scholar review of the Jumu'ah and voluntary-fast wording and the excluded days.

## Fajr wake-up alarm (v19)

- [x] Unit tests: a week of alarms at Fajr + offset, one stable AlarmKit id per day, today skipped once past, never later than 15 min before sunrise (also near-polar summer); fallback notifications (26 × 10⁶) clear of other ids and taken from the rotation budget; v18 → v19 migration; invalid settings rejected (fajr-alarm.test.mjs).
- [x] iOS build succeeds with AlarmKit (Xcode 27 SDK) and installs on the iPhone 16 Pro (iOS 27.0.1).
- [ ] Physical iPhone: permission prompt on first turn-on; alarm rings at the shown time on Silent and in a Focus, full screen on the Lock Screen; Snooze appears only while snoozes remain and stops after the chosen number; Stop with the wake check on rings once more after 5 min unless "I'm up" is held in the app; that ring has no further follow-up; a sync never cancels a ringing alarm; turning the alarm off removes every planned, snoozed and wake-check alarm.
- [ ] Older iPhone (iOS 15–25) and Android: notification fallback at the alarm time, opening the wake screen. Android has no full alarm yet.
- [ ] Settings → AyahFlow shows the Alarms permission with the purpose text.

## Quran completion plan (khatm, v20)

- [x] Unit tests: every page due exactly once for each plan length and start page, even daily share (±1 page), today's portion, behind/ahead, everything left due after the last day, starting mid-Quran; only a forward turn from the next unread page moves the plan (jumps, back turns and opening the reader do not); v19 → v20 migration; invalid plans rejected (khatm.test.mjs).
- [x] Browser (402×874 and 320×568, English and Arabic RTL): setup, plan screen, Home card, Quran entry, end-plan confirmation; no sideways scroll. Page turns in the Mushaf reader advanced the plan only in order.
- [ ] Physical iPhone: swipe page turns advance the plan; Home card updates the next day; Arabic counted nouns read naturally to a native speaker.

## Android widgets (2026-10-29)

- [x] `./gradlew assembleDebug` builds with OpenJDK 21 (Homebrew `openjdk@21`; Capacitor 8 needs Java 21): du'a, istighfar, steps and Jumu'ah-and-fasts widgets alongside the prayer widget (android-widgets.test.mjs).
- [ ] Run on an Android phone or emulator: the local emulator (Pixel_9_Pro) does not start (libQt6WebEngineCoreAndroidEmu missing from the SDK emulator package; reinstalling the emulator should fix it). Place each widget; check Arabic, taps and the change at midnight.
- [ ] Android still lacks: a full Fajr alarm (notification only), "I recited it" on smart-engine notifications, a live Qibla compass.

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

- [x] Privacy policy written from the code (`public/privacy.html`, linked from Settings → About); a test fails if the app downloads from a host the policy does not name. Contact details still to be added before publishing.
- [x] Release archive builds (Xcode 27, `xcodebuild … -configuration Release archive`, 2026-10-29), widget extension inside; `PrivacyInfo.xcprivacy` now ships inside App.app (it was missing from the target).
- [ ] App Store export and validation: blocked. Team KFHK4QSUC6 is a personal team ("does not have permission to create iOS App Store provisioning profiles", no "iOS Distribution" certificate). Needs a paid Apple Developer Program membership.
- [ ] Review privacy policy and any store data declarations against actual runtime behavior and provider traffic.
- [ ] Verify PrivacyInfo.xcprivacy is included in the correct Xcode target; reassess declarations when plugins or network services change.
- [ ] Review OS backup inclusion/exclusion, restoration and recording retention policy.
- [ ] Test corrupt/missing saves and explicit import without accidental overwrite.
- [x] Versioned migrations (schema v15) with tests; saved data is migrated, never reset.
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
