# Architecture and decision record

## Boundary

The UI is a web-native TypeScript application. Capacitor supplies the mobile container and access to OS facilities. It is not React Native, Flutter, SwiftUI or Jetpack Compose. This gives a shared interface and learning engine with no remote backend required for the starter release. Native UI/performance/accessibility must still be evaluated on supported devices.

Official runtime documentation: https://capacitorjs.com/docs

No movie-rendering pipeline or `opus-js-animations` runtime is embedded. The motion layer consists of CSS transitions and original SVG artwork. Decorative wave shapes indicate activity; they are not phoneme analysis or a plotted recording waveform.

## Pure domain layer

`src/engine.ts` has no browser or network dependency. It exposes:

- a versioned app state and explicit review evidence;
- valid per-mode, per-surah, per-ayah card keys;
- deterministic question construction from a seed;
- due/new/optional-practice selection;
- immutable, idempotent answer application;
- progress calculations and import validation.

Each session persists its question queue, seed, index, feedback and answer state. A stable event ID combines session ID and question index. Repeated handling of a recent answer event cannot add points twice. The current audit trail is bounded to 5,000 attempts; this bound must be reconsidered before a full-library/database release.

For scalability, move the event journal and review projections into a transactional SQLite store, with migration tests, before adding large histories and sync. Native Preferences is intentionally only a small starter persistence adapter, not the long-term database.

Preferences documentation: https://capacitorjs.com/docs/apis/preferences

## Scheduler, exactly

The time guide maps 3 minutes to 5 cards, 7 minutes to 10 cards, and 10 minutes to 15 cards. These are estimated session sizes, not calibrated duration promises.

Daily sessions combine next-ayah, previous-ayah and hidden-text recall within the selected chapters. Listening is a separate practice mode because it needs online audio consent. The queue first takes cards due now, prioritizing greater lifetime misses and then older due dates; then unseen cards; then not-yet-due cards for optional practice. No duplicate card key is used to fill a short pool.

A successful review starts at one day. A later distinct successful local date increases the interval by a rounded factor of 2.2, capped at 90 days. Repeating successfully on the same local date does not increase the interval or count as another retention date. A failure resets the interval and successful-date sequence, and schedules a review in ten minutes. These constants are a transparent heuristic; there is no fitted forgetting model.

Retained status requires at least three successful dates spanning seven days. Failure removes that status. This is per-card evidence, not a score for an entire surah, a learner's spirituality, pronunciation, or independently verified memorization. Displayed practice counts indicate exposure by prompt ayah.

Recognition quizzes and self-assessment never share an accuracy denominator. Tajweed knowledge checks are a separate lesson log and do not update voice accuracy.

## Question safety

Questions use source strings in `src/data.ts`. Next-ayah excludes the last ayah; previous-ayah excludes the first. All wrong options are existing source ayahs, not generated imitations. Comparison keys remove selected marks only to catch textually equivalent distractors; source display remains unchanged. Al-Kafirun's repeated verses are included in the regression tests.

No claim is made that the current distractor selection is an expert-designed mutashabihat curriculum. That remains a separately reviewed feature.

## Persistence and failure behavior

Web progress: JSON in localStorage. Web clips: IndexedDB, resolving writes only after the transaction completes. Native progress: Preferences. Native clips: app-private Filesystem plus a Preferences metadata index. A browser that denies localStorage access explicitly enters a labelled temporary, in-memory preview mode.

Malformed saves fail closed and expose restore/delete controls. They are not silently replaced with a fresh profile. Writes report errors rather than showing a successful saved state. Import validation is structural validation, not proof that the learner really earned imported scores.

The native audio-file plus metadata-index write is not a multi-resource transaction. A crash between the writes may leave an orphan file; implement reconciliation before production and a database/file-journal design for larger deployments. Do not claim crash-consistent native recordings until fault-injection tests pass.

Progress backup intentionally excludes recordings. Native files exported for sharing exist temporarily in the app cache. Local deletion cannot revoke shared copies. Preferences/Filesystem are not application-level encrypted stores in this version; physical device security and OS backup settings matter.

Filesystem documentation: https://capacitorjs.com/docs/apis/filesystem

## Audio lifecycle

A single reference player avoids overlapping recitations. Loading timeout is 15 seconds. Starting a new player stops the old one; stale player errors cannot stop a newer player. Loading does not block navigation. Slow playback preserves pitch where the browser implements that option, but a slowed recording must not be used to measure Tajweed counts.

Recording requests the microphone only when the user presses record. The app selects a supported MediaRecorder MIME type, limits clips to 90 seconds, finalizes a Blob, and stops the tracks. Saving is explicit. A background event stops recording; there is no background microphone mode. Capture, replay and interruption behavior require real-device verification.

Native storage/reminders/sharing/haptics are contained in `native/bridge.mjs`. The web build loads that adapter only when Capacitor reports a native platform. The adapter is bundled separately after npm dependencies are installed.

## Security and next boundaries

No backend, authentication token, advertising identifier or analytics collector exists. Source strings are escaped before HTML rendering; trusted original SVG templates are static. Explicit reference audio and external source links are the intended external connections. Do not add generic HTML or model-generated religious text into these templates.

Production work should include a web Content Security Policy and HTTPS headers, dependency audit/lockfile, screen-reader and text-size review, OS backup policy, retention limits, native deep-link/external-navigation validation, schema migrations, transactional persistence, and native error monitoring that excludes recitation/audio/text content by default.
