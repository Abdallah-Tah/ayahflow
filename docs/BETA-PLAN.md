# Beta release plan — evidence-based checklist

Branch `feature/mushaf-reader-accuracy`, started 2026-11-08 from `24775ef` (on top of `17f8f2a`, `11878d9`, `3f11ebe`;
compared with `origin/main`, not the stale local `main`). Schema v27. This list is kept against the code: an item moves
only with evidence (test, browser, simulator, or a person on a device).

Postponed for this release (owner decision): LLM chatbot, cloud AI APIs, generative interpretation, subscriptions,
social features, accounts and sync.

## A. Implemented and verified

- Full Quran from Tanzil Uthmani 1.1, checksum-pinned, 6,236 verses, 604 Madani page boundaries; every page's text
  equals the corpus (`tests/quran-pages.test.mjs`).
- Mushaf page reader: word spans (fixes the Chromium 7:92 glyph fault), even spacing, 16 px minimum with vertical
  scroll, 26 em landscape column, page-turn sheet, one Tab stop a page, verse buttons named by their Arabic content.
  Simulator app (iOS 18.6) and Chromium; see `RELEASE-CHECKLIST.md`.
- Review engine (`src/engine.ts`): per-mode cards, spaced intervals, missed-answer priority, idempotent answer events,
  quiz accuracy kept apart from self-assessed recall, review stages.
- Highlights, notes, bookmarks, reading position, khatm plan, highlight review — unit tests and simulator.
- Export/backup/restore/delete of the app's own data; versioned migrations to v27 with tests.

## B. Implemented, not sufficiently tested

- VoiceOver on a device or simulator (markup verified only).
- Everything on Android: no Android build or device in recent rounds. iOS-only native pieces (AlarmKit Fajr alarm,
  WidgetKit widgets, smart reminders' native engine) must not be assumed to work there.
- Physical iPhone: reader changes since `17f8f2a`, microphone interruption, notifications after reboot, widgets after
  the latest changes, upgrade from an older installed build.
- Recitation following (`src/voice.ts`, `voice/worker.ts`): code exists; the model is not bundled in this working copy
  (`www/voice/` holds only the capture worklet), so it was not exercised.

## C. Confirmed defects (reader, from the 2026-11-08 audit) — fixed, iOS Simulator and Chromium

1. iOS app: switching the system appearance moved a scrolled landscape page (WebKit scrolls by itself) — fixed.
2. Hidden footer took touches — fixed.
3. Verse-menu preview clipped a line's first letter — fixed.
4. "Continue reading" (and `ayah/` links, search) opened a scrolling page at its top and saved the page's first verse —
   fixed.
5. Focus ring after a touch on a sheet's first button — fixed; keyboard focus unchanged.

Still to run: the same checks in an Android WebView and on a physical iPhone.

## D. Approved for this release

- **Done (phase 3, schema v28):** "Today's Quran" plan first on Home (`src/daily.ts`). It shows continue reading or
  today's khatm portion, the memorisation session, due reviews (engine `dueItems`), memorised ayahs due outside the
  chosen surahs, and difficult ayahs (engine `weakItems`). Today's line counts only saved records. The plan uses the
  existing 3/7/10-minute goal and the learner's days off; it schedules nothing itself.
- **Done:** the memorisation session is saved (`state.hifz`) and resumes after closing the app. One ayah at a time
  (or the whole passage); reveal one word or the whole ayah; repeat one ayah ×N with audio. "Remembered" / "Needs
  practice" is recorded through `applyAnswer` as self-assessed `recall` evidence, idempotent per session and ayah.
  Revealing words saves nothing.
- **Done:** days off (Settings › Daily goal). The practice reminder is scheduled only on the days the learner keeps.
  Its text is in the app's language and no longer claims "your next review is ready" when nothing is due.
- **Fixed (defect found in phase 3):** "Recite this surah from memory" on any surah over 15 ayahs saved a session
  the next launch rejected ("saved data could not be opened"). The limit is now 286 (Al-Baqarah); regression test in
  `tests/daily.test.mjs`.
- Optional recitation-following pack: not in the base app, downloaded on request with manifest, SHA-256, progress,
  atomic activation, removal and storage check. **Blocked on a licence and hosting decision** (section F).
- UI: Quran and learning first on Home; secondary features (steps, bead designs, Zakat, Eid, libraries) one level
  down; onboarding, empty states, small screens.

## E. Native audit (section 6 of the brief) — to do, item by item, with platform labels

Microphone permission and interruption; local playback and saved recordings; prayer times and athan; notification
scheduling and cancellation; background reminders; widgets; Salah tracking persistence; Qibla; backgrounding, restart,
upgrade; offline; export/restore/delete. Each gets iOS and Android status separately.

## F. Needs an external decision or a physical device

- **Voice model distribution.** Tilawa Zipformer and its phoneme corpus are NPL-1.2. Downloading them on demand means
  either the app fetches the upstream GitHub release (a new third-party network endpoint) or the owner hosts a copy
  (redistribution under NPL-1.2 terms). Both need the owner's decision after the licence review; until then the
  feature stays off with an accurate explanation.
- Apple Background Assets vs an in-app download: needs current Apple documentation and an App Store review stance.
- Physical iPhone and Android phone runs; VoiceOver and TalkBack; qualified review of Tajweed drafts and adhkar.
- Push, merge, TestFlight, store submission: owner approval.
