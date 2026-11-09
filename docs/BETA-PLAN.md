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
- **Done (phase 4):** Home order is Quran plan → prayer (next prayer, today's five) → remembrance (adhkar of the
  moment, quick dhikr) → ayah of the moment → Qibla → native pulse (istighfar, steps). The daily-verse and
  short-recitation tiles, previously on both Home and the Quran tab, are now only on the Quran tab. The Quran tab leads
  with continue reading, memorisation, review practice, khatm and highlight review. Tajweed drafts and recording are
  under "Learn and record". Zakat, Eid and the hadith and names libraries stay where they were, one level down
  (Occasions, Adhkar). Bead designs are in tasbih settings. Nothing removed, no setting or data changed.
- **Done:** a first-run welcome card (language, open the Quran, memorise, set up prayer times). It hides once the
  learner has any saved activity or taps "Got it". The dismissal is a browser-storage convenience, not part of the save.
- **Gap, documented:** UI text uses fixed pixel sizes. Android WebView applies the system font scale on its own.
  iOS WKWebView does not follow Dynamic Type for these. The Quran text has its own size controls (Settings, reader).
  A full rem conversion is a broad layout change, left for after the beta.

## E. Native audit (phase 6) — results in `RELEASE-CHECKLIST.md`, "Beta round 2026-11-08"

| Area | iOS | Android |
| --- | --- | --- |
| Microphone: asked on tap; stops on background | PASS simulator | NOT RUN (code shared) |
| Practice reminder, days off, permission on tap | PASS simulator | NOT RUN (`weekday` schedule, same plugin) |
| Upgrade with existing data (v27 → v28) | PASS simulator and owner's iPhone | NOT RUN |
| Restart / force-quit keeps memorisation | PASS simulator | NOT RUN |
| Deep links from widgets and reminders | PASS simulator | **Defect fixed**: the link filter took only `/moment`, so the prayer, du'a, istighfar, steps and Jumu'ah widgets opened nothing. Not run |
| Widgets | NOT TESTED this round | NOT RUN |
| Fajr alarm | AlarmKit (unchanged) | notification fallback only (says so) |
| Qibla live compass | iPhone only (unchanged) | bearing and distance only (says so) |
| Place reminders | unchanged | needs the Play background-location declaration |
| Offline | static only | static only |

Android is BLOCKED on this Mac (JDK 21, emulator images).

## F. Needs an external decision or a physical device

- **Voice model: decided 2026-11-08, not in the beta.** No model is included or downloaded; optional AI downloads and
  LLM features are postponed. Settings, the privacy policy and the iOS microphone string say so. Revisit only after
  the NPL-1.2 licence is resolved for store distribution.
- Apple Background Assets vs an in-app download: needs current Apple documentation and an App Store review stance.
- Physical iPhone and Android phone runs; VoiceOver and TalkBack; qualified review of Tajweed drafts and adhkar.
- Push, merge, TestFlight, store submission: owner approval. The beta pack (store text, privacy answers, permission
  justifications, screenshots, build commands) is in `BETA-RELEASE.md`.
- Android toolchain: JDK 21 and working emulator images, or an Android phone.
