# Product roadmap: earn the right to expand

## Product promise

Every observed learning difficulty should lead to a useful next exercise. The initial audience is a learner who already reads some Arabic and wants a calm, guided review habit. This starter does not yet teach a complete beginner to decode Arabic letters, and should not advertise that it does.

The differentiator is the connected review loop and trustworthy feedback, not a claim that no competitor has similar features. Success should be measured by retained unassisted recall and learner usefulness, not simply points, screen time or an unvalidated model score.

## Decision log

- 2026-10-22 — At the owner's request the corpus moved past the eight-surah gate: the full Quran is imported from Tanzil (licensed, versioned, checksum-pinned, reproducible), and context-aware adhkar reminders were added. Teacher/scholar review and physical-device testing remain open release gates (see `RELEASE-CHECKLIST.md`).

## Gate 1 — installable, trustworthy starter

Finish real-phone testing, durable storage, audio lifecycle, signed internal builds, teacher review and content provenance. Improve content/error reporting, accessibility and onboarding. Keep the eight-surah scope until these gates pass.

Acceptance: users can install on both platforms, practise, quit, resume, record, export and delete without losing data or misunderstanding assessment status. Teacher-approved lesson versions replace the explicitly marked drafts.

## Gate 2 — complete reading and reviewed practice content

Import a versioned full corpus from a licensed canonical source. Add a reviewed foundation curriculum, stable audio/text alignment, optional permitted offline audio and licensed translation/tafsir integrations. Introduce a transactional database and a migration strategy. Add a reviewed mutashabihat dataset with explicit source relationships and ambiguity tests.

Do not promise a whole-Quran Tajweed curriculum merely by adding more source strings.

## Gate 3 — learner and teacher pilot

Recruit a small consenting pilot cohort with qualified teachers. Compare scheduled review against a clearly defined baseline and test delayed recall after meaningful intervals. Record the difference between multiple-choice recognition, self-assessment, independently observed recitation and teacher verification.

Add narrowly scoped assignment/review workflow only after the consent and role model are ready. User-initiated sharing is currently the only teacher-related action; there is no teacher backend yet.

## Gate 4 — speech assistance, without inflated claims

First evaluate word-level following, omitted/repeated words, hesitation and alignment against an annotated dataset. Keep text recognition separate from pronunciation. Provide uncertainty and teacher escalation; unsupported cases must abstain rather than return a flattering score.

Tajweed/phoneme/makhraj analysis is a separate, later evaluation program requiring consented recordings, qualified annotations, specified recitation conventions, noise/device/accent tests and calibrated error rates. Do not display mock confidence scores or infer rule correctness from a transcript alone.

An interface for future observation events may distinguish:
`quiz_result`, `self_recall`, `teacher_review`, `asr_hypothesis`, `pronunciation_observation`.
Only genuine evidence should populate a field. This schema is a design direction, not an implemented AI system.

## Gate 5 — optional accounts and larger organizations

Add account sync, families and school workflows only with a clear need, permission model and funding plan. A Laravel backend could support reviewed content, assignments and optional sync without replacing the existing mobile domain model. Keep recording uploads optional and separately authorized.

Subscriptions, notifications beyond local reminders, competitions and public rankings are not needed to prove the core learning benefit. Avoid pressure mechanics and claims about religious reward.
