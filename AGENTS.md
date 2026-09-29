# AyahFlow engineering contract

Preserve the approved charcoal/gold design and local-first core. Do not rewrite the app merely to change frameworks. Inspect README, source, tests and the release checklist first.

## Product truth

This is a v0.1 prototype, not a shipped native product. The current library is eight complete surahs / 37 ayahs. Four Tajweed lessons are drafts awaiting a qualified teacher. Never silently remove those limitations or their in-app labels.

Recognition, self-assessed recall, rule knowledge, speech recognition, and pronunciation verification are different evidence types. Never fabricate scores, heatmaps, model confidence, teacher approval, streaks, or user activity. Do not turn speech-to-text correctness into a Tajweed verdict.

## Quran content

Keep source Arabic strings unmodified in presentation and choices. Comparison normalization is allowed only on comparison keys. Distractors must be real, source-referenced text, never invented Quran-like phrases. Check repeated verses for ambiguity. Do not cross surah boundaries in next/previous mode. Do not generate religious teaching or quotations at runtime.

New lessons need source, recitation convention, qualified reviewer, review date and version. Do not label the starter drafts verified. Fonts require a separately checked license; never copy font files from a development machine into this repository by default.

## State and privacy

Do not reset user data to resolve a migration. Version and test migrations. Keep review calculations in the pure engine. Save explicit evidence separately from scheduling derivatives. Writes must be idempotent per session question. Storage failures must not be presented as success.

No microphone use without a user gesture. Stop tracks on completion/interruption. No recording uploads, analytics, model calls, or new network endpoints without an explicit consent design. Export and delete only the app's own data. Never add keys, tokens, certificates or developer account credentials to the source.

## Workflow

Run `npm run typecheck` and `npm test`. Add regression tests for changes. Inspect small-screen, Arabic RTL, large-text, keyboard and recording behavior. Use real screenshots for claims about the implemented interface.

Build native platforms only after dependencies/tooling are available. Report exact commands and results. Do not claim native compilation, privacy compliance, store acceptance, audio accuracy or physical-device compatibility from browser tests alone. Preserve manual native modifications; understand the configuration helper before rerunning it.

## Next release gate

Get an installable development build running on a real iPhone and Android phone; test durable storage, microphone lifecycle, native sharing and reminders. Then commission Quran/Tajweed editorial validation. Expand the corpus only with versioned, licensed, reproducible source ingestion. The roadmap contains later AI/teacher work; it is not implemented merely because it appears there.
