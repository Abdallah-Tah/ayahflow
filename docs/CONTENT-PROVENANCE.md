# Quran and lesson provenance

## Quran text (full corpus)

The app ships the complete Quran: 114 surahs, 6236 ayahs, from **Tanzil Quran Text (Uthmani, Version 1.1)**, © Tanzil Project, licensed CC BY 3.0 (https://tanzil.net). The XML is committed **verbatim, including its copyright block**, in `content/tanzil/`:

| File | Source | SHA-256 |
| --- | --- | --- |
| `quran-uthmani.xml` | `https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&tatweel=true&quranType=uthmani&outType=xml&agree=true` | `c5052534d63d3856ce25413ff464d0b609f90169a202a1615aa8707efec81244` |
| `quran-data.xml` (metadata, CC BY) | `https://tanzil.net/res/text/metadata/quran-data.xml` | `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a` |

`scripts/import-quran.mjs` verifies both checksums (a changed file fails the build until reviewed), checks counts, numbering and global offsets, and generates `www/js/quran-data.js` with the notice. Ayah strings are copied exactly; only the XML attribute layer is decoded. The basmala is Tanzil's separate `bismillah` attribute and is shown as a heading, never merged into ayah 1. English surah names and meanings are Tanzil's transliterations as published. The notice and source files are copied into the built app (`www/content/tanzil/`), and the reader, library and settings credit Tanzil with a link.

**Why not Quran.com.** The September starter text was a Quran.com snapshot. The Quran Foundation Developer Terms (updated 2026-10-11) do not permit distributing a prepackaged or build-time bundle of their content; offline copies must come through their Content Sync API and be refreshed weekly. Tanzil's terms explicitly allow verbatim copies in any application with attribution and a link. Compared with the old 37 starter ayahs, Tanzil differs only in 108:1 (Unicode composition: the old copy was NFC-normalised, same rendering) and 109:4 and 110:2 (the old copy had an extra U+06ED small low meem; current Tanzil and the current Quran.com API both omit it).

Translations and tafsir remain external links (Quran.com), not bundled text.

## Adhkar and prayer-surah suggestions

`content/adhkar/spec.json` lists each dhikr with a cited hadith and two short boundary markers. `scripts/build-adhkar.mjs` slices the text **verbatim** from that hadith in the public-domain dataset `fawazahmed0/hadith-api@1` (Arabic editions); a marker that is not found fails the build, so no supplication is typed by hand. Every cited hadith is saved to `content/adhkar/sources.json`, and `tests/adhkar.test.mjs` re-checks offline that each text is an exact substring of its source. Quran-based adhkar (Ayat al-Kursi, the end of Al-Baqarah, the three Quls) are references into the Tanzil corpus.

Recorded per entry: collection, number, in-book reference (verified to match sunnah.com's in-book reference, so `https://sunnah.com/<collection>/<book>/<hadith>` resolves), and the dataset's grades. Decisions that need a reviewer's eye:

- The popular entering-home wording in Abu Dawud 5096 is graded *da‘if* by every grader in the dataset; it is not used. Entering home shows the authentic guidance (Muslim, in-book 36/136; Abu Dawud 3765, *sahih*) to remember Allah on entering, labelled as guidance rather than a fixed wording.
- Ayat al-Kursi before sleep cites al-Bukhari 2311, which is *mu‘allaq*; the app says so.
- The riding entry uses the narration's own wording (Abu Dawud 2602), which quotes Quran 43:13–14 from its second half; the Quran reference is shown beside it.
- "Arriving at / leaving work" have no narrated supplication in this library; they are shown as general reminders and never as a sunnah claim.
- Prayer-surah suggestions cite hadiths that name the surahs (e.g. Al-A‘la and Al-Ghashiyah in the Friday and Eid prayers, Muslim in-book 7/78 = Muslim 878). The app does **not** claim what any particular imam recites today; no reliable source for that was found.
- Numbering differs between hadith editions; the dataset's Sahih Muslim numbers are not the common Abd al-Baqi numbers, which is why texts are located by content and linked by in-book reference.

All adhkar carry `reviewStatus: awaiting-scholar-review`, shown in the app. Translations are not bundled (translations on hadith sites belong to their translators); each entry links to its source page.

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

Done for the text itself (Tanzil Uthmani 1.1, Hafs). Still required: choose and document the recitation convention for audio and annotations. Preserve the canonical strings and required notices. Version the source, importer, normalization-for-comparison policy, annotation spans and reviewer sign-offs. Validate chapter counts, numbering, duplicates and audio boundaries. Resolve text/audio/font discrepancies through review, not an AI-generated correction.

Add review samples on iOS and Android at large text sizes; verify joined Arabic glyphs, stacked marks and RTL reading order. Do not remove the draft labels until the corresponding content version has genuine approval.
