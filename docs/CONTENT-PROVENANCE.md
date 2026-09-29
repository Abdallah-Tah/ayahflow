# Quran and lesson provenance

## Scope and source

The starter file `src/data.ts` contains 37 Arabic ayahs in eight complete surahs. Source pages checked during preparation on 2026-09-28:

| Surah | Ayahs | Source |
| --- | --- | --- |
| Al-Fatihah (1) | 7 | https://quran.com/1 |
| Al-'Asr (103) | 3 | https://quran.com/103 |
| Al-Kawthar (108) | 3 | https://quran.com/108 |
| Al-Kafirun (109) | 6 | https://quran.com/109 |
| An-Nasr (110) | 3 | https://quran.com/110 |
| Al-Ikhlas (112) | 4 | https://quran.com/112 |
| Al-Falaq (113) | 5 | https://quran.com/113 |
| An-Nas (114) | 6 | https://quran.com/114 |

Named and numbered Quran.com chapter URLs may resolve to the same chapter. No modern copyrighted translation text or tafsir corpus is bundled. Translation/tafsir controls link out to the matching Quran.com ayah.

These source references and programmatic checks do **not** certify every mark, font glyph, recitation convention or teaching statement. A qualified teacher/editor has not yet signed off this build. The app does not claim affiliation with or endorsement by Quran.com or the audio provider.

The build produces `www/content-manifest.json`, including a SHA-256 hash of the entire data source file. A checksum detects file changes; it does not establish that the content is correct. Changes to a lesson also change this checksum.

## Audio mapping

Reference URL pattern:

`https://cdn.islamic.network/quran/audio/128/ar.alafasy/{globalAyah}.mp3`

The first global indices are 1, 6177, 6205, 6208, 6214, 6222, 6226 and 6231 for the chapters above. Boundary tests verify the mapping, including An-Nas 114:6 -> 6236. No audio file is bundled. Availability of the live files was not tested in the container.

The display identifies Mishary Alafasy / Islamic Network. The app requires online-audio consent before requesting reference audio. Rights to recordings are not conveyed simply because a URL is accessible. Review the provider and rights-holder terms for the intended commercial distribution, streaming, attribution, retention and offline downloads.

Primary references:
- https://alquran.cloud/api
- https://alquran.cloud/terms-and-conditions

## Tajweed lesson drafts

General rule reference: https://alquran.cloud/tajweed-guide

Four original short lesson explanations use source-linked examples: Ikhfa at Al-Falaq 113:2; ghunnah on the doubled noon in An-Nas 114:6; qalqalah on the final dal when stopping at Al-Ikhlas 112:1; and natural madd in Al-Falaq 113:2. Context such as stopping versus continuing matters. Highlights mark a focus phrase rather than asserting a complete letter-level tajweed annotation of the ayah.

Every lesson carries `reviewStatus: editorial-draft`; the interface repeats the review-pending notice. Teacher validation is required for rule wording, count descriptions, stopping conventions, examples, French/Arabic translations, highlights and reference-recitation consistency. Reference sites can contain errors or inconsistent terminology; do not treat a scraped rule table as automatic editorial approval.

The lesson assessment is a knowledge quiz. It does not listen to the user's performance or certify application of a rule. Natural-pace practice is advised; slowed playback is not a timing calibration for counts.

## Full corpus release procedure

Choose one explicit, licensed text source and recitation convention. Preserve the canonical strings and required notices. Version the source, importer, normalization-for-comparison policy, annotation spans and reviewer sign-offs. Validate chapter counts, numbering, duplicates and audio boundaries. Resolve text/audio/font discrepancies through review, not an AI-generated correction.

Add review samples on iOS and Android at large text sizes; verify joined Arabic glyphs, stacked marks and RTL reading order. Do not remove the draft labels until the corresponding content version has genuine approval.
