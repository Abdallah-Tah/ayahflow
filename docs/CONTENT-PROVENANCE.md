# Quran and lesson provenance

## Quran text (full corpus)

The app ships the complete Quran: 114 surahs, 6236 ayahs, from **Tanzil Quran Text (Uthmani, Version 1.1)**, © Tanzil Project, licensed CC BY 3.0 (https://tanzil.net). The XML is committed **verbatim, including its copyright block**, in `content/tanzil/`:

| File | Source | SHA-256 |
| --- | --- | --- |
| `quran-uthmani.xml` | `https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&tatweel=true&quranType=uthmani&outType=xml&agree=true` | `c5052534d63d3856ce25413ff464d0b609f90169a202a1615aa8707efec81244` |
| `quran-data.xml` (metadata, CC BY) | `https://tanzil.net/res/text/metadata/quran-data.xml` | `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a` |

`scripts/import-quran.mjs` verifies both checksums (a changed file fails the build until reviewed), checks counts, numbering and global offsets, and generates `www/js/quran-data.js` with the notice. Ayah strings are copied exactly; only the XML attribute layer is decoded. The basmala is Tanzil's separate `bismillah` attribute and is shown as a heading, never merged into ayah 1. English surah names and meanings are Tanzil's transliterations as published. The notice and source files are copied into the built app (`www/content/tanzil/`), and the reader, library and settings credit Tanzil with a link.

**Why not Quran.com.** The September starter text was a Quran.com snapshot. The Quran Foundation Developer Terms (updated 2026-10-11) do not permit distributing a prepackaged or build-time bundle of their content; offline copies must come through their Content Sync API and be refreshed weekly. Tanzil's terms explicitly allow verbatim copies in any application with attribution and a link. Compared with the old 37 starter ayahs, Tanzil differs only in 108:1 (Unicode composition: the old copy was NFC-normalised, same rendering) and 109:4 and 110:2 (the old copy had an extra U+06ED small low meem; current Tanzil and the current Quran.com API both omit it).

## English translation (Pickthall)

Shown under ayahs on Home, in saved verses and in Short Recitations (it can be hidden). `content/translations/en.pickthall.txt` is Tanzil's file for *The Meaning of the Glorious Koran* by Mohammed Marmaduke William Pickthall (1930), "Last Update: September 4, 2010", from `https://tanzil.net/trans/?transID=en.pickthall&type=txt-2`, SHA-256 `4aabbfa9d96796f5a6b0217d2c39dce1a3084f772bf6f2650e37082a774e3cc7`. `scripts/import-translation.mjs` checks the checksum, the 6236 lines and the order against the Arabic corpus; lines are copied exactly (only the `surah|ayah|` prefix is removed).

**Licence note (review before any paid release).** The translation is in the public domain (published 1930; the translator died in 1936). Tanzil states that the translations on its page are "for non-commercial purposes only" and asks for permission otherwise. AyahFlow is free today; if it is ever sold or carries paid features, either confirm Tanzil's terms or replace this file with another public-domain copy of Pickthall (same importer, new checksum).

Tafsir remains an external link (Quran.com), not bundled text.

## Adhkar and prayer-surah suggestions

`content/adhkar/spec.json` lists each dhikr with a cited hadith and two short boundary markers. `scripts/build-adhkar.mjs` slices the text **verbatim** from that hadith in the public-domain dataset `fawazahmed0/hadith-api@1` (Arabic editions); a marker that is not found fails the build, so no supplication is typed by hand. Every cited hadith is saved to `content/adhkar/sources.json`, and `tests/adhkar.test.mjs` re-checks offline that each text is an exact substring of its source. Quran-based adhkar (Ayat al-Kursi, the end of Al-Baqarah, the three Quls) are references into the Tanzil corpus.

Counters (`counters` in the spec) work the same way: every phrase is a verbatim slice of a cited hadith, and each counter's target is backed by `evidence` phrases that must occur in its `countSource` (e.g. "في اليوم مائة مرة" in Muslim in-book 48/52; "ثلاثا وثلاثين" and "تمام المائة" in Muslim in-book 5/188). Where the phrase wording comes from another narration (the tasbih phrases from Muslim in-book 38/16), the app shows that source too.

Recorded per entry: collection, number, in-book reference (verified to match sunnah.com's in-book reference, so `https://sunnah.com/<collection>/<book>/<hadith>` resolves), and the dataset's grades. Decisions that need a reviewer's eye:

- The popular entering-home wording in Abu Dawud 5096 is graded *da‘if* by every grader in the dataset; it is not used. Entering home shows the authentic guidance (Muslim, in-book 36/136; Abu Dawud 3765, *sahih*) to remember Allah on entering, labelled as guidance rather than a fixed wording.
- Ayat al-Kursi before sleep cites al-Bukhari 2311, which is *mu‘allaq*; the app says so.
- The riding entry uses the narration's own wording (Abu Dawud 2602), which quotes Quran 43:13–14 from its second half; the Quran reference is shown beside it.
- "Arriving at / leaving work" have no supplication narrated for a workplace. They show two general narrations, titled for what they are and not as a work sunnah: the du'a of one who stops at a place (Sahih Muslim 6878 in the dataset, in-book 48:72, i.e. 2708) and kaffarat al-majlis said before rising from a sitting (Jami' at-Tirmidhi 3433, also Sunan Abi Dawud 4859). A grouped notification (e.g. leaving work while riding a vehicle) takes its text from the first moment with a du'a of its own; a moment listed in `GENERAL_MOMENTS` never supplies it.
- Prayer-surah suggestions cite hadiths that name the surahs (e.g. Al-A‘la and Al-Ghashiyah in the Friday and Eid prayers, Muslim in-book 7/78 = Muslim 878). The app does **not** claim what any particular imam recites today; no reliable source for that was found.
- Numbering differs between hadith editions; the dataset's Sahih Muslim numbers are not the common Abd al-Baqi numbers, which is why texts are located by content and linked by in-book reference.

**Dhikr library** (`library` in the spec, v13). Sixteen counted adhkar, each a verbatim slice of its cited hadith, with a target that is either a **count stated in the hadith** (`targetKind: sunnah`, backed by `evidence` phrases found in the source: e.g. «في يوم مائة مرة» in al-Bukhari 6403 and 6405) or a **personal goal** (`personal`, where the hadith gives no number). Checks made while building it:

- *Salawat on the Prophet ﷺ* «اللهم صلِّ وسلِّم على نبينا محمد»: this exact wording is not in any narration of the dataset. It is kept as requested, marked `wording: 'common'` and labelled in the app as a common formula; the cited hadith (Muslim 408 = in-book 4/74) is about the virtue of sending salawat in general and is shown verbatim as such. It is the only entry whose text is not sliced from a hadith (enforced by the build and tests).
- *Ibrahimiyya*: al-Bukhari 3370 (Ka‘b ibn ‘Ujrah), both halves, as narrated.
- *Kalimatan*: al-Bukhari 6406 gives «سبحان الله العظيم، سبحان الله وبحمده» (the requested order); 6682 and 7563 give the reverse; 6682 is listed as also.
- *Four words*: the requested "Muslim 2695" is the dataset's muslim:6847, in-book 48/42.
- *Sayyid al-istighfar*: al-Bukhari 6306 reads «وأبوء **لك** بذنبي»; the request omitted «لك». The narrated wording is used.
- *Istighfar wa tawbah*: no fixed count; the app states "more than seventy times a day" (al-Bukhari 6307) and "a hundred times a day" (Muslim 2702 = in-book 48/52) and uses 100 as a personal goal.
- Yunus (Tirmidhi 3505, *sahih*), «حسبنا الله ونعم الوكيل» (al-Bukhari 4563) and «ربنا آتنا…» (al-Bukhari 6389) are sliced from those hadiths; their Quran references (21:87, 3:173, 2:201) are shown beside them.
- Daily duas added: entering the toilet (al-Bukhari 6322), after eating (5458), in distress (6346). The narration in Muslim 6908 (evening) and Abu Dawud 5074 contain narrator remarks inside the supplication, so they were not sliced.

**Tasbih after prayer.** Three narrated ways, each counted separately per prayer and day: 33·33·33 + tahlil (Muslim 597 = in-book 5/188), 33·33·34 (Muslim 596 = in-book 5/186), 10·10·10 (al-Bukhari 6329). Phrase wording comes from Muslim in-book 48/38 as before.

Sahih Muslim is shown in the app by its in-book reference ("book 4, hadith 74"), because the dataset's Muslim numbers differ from the common Abd al-Baqi numbers.

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

## Du'a of the day (Lock Screen and widgets)

`src/duas.ts` lists Quranic supplications by reference only (surah, first and last ayah), following the widely published "Rabbana" and "Rabbi" du'as; a du'a spanning several ayahs is kept together (e.g. 20:25–28, 40:8–9). The Arabic is read from the Tanzil corpus unchanged. Only du'as measured to fit the Lock Screen rectangle whole are picked (28 of 58, listed in `src/lock-duas.ts` and generated by `scripts/measure-lock-duas.mjs` with the widget's font on a 145×56 pt box, smaller than any iPhone's); the others, such as 2:286 and 2:250, stay in the list but are not shown daily. The text is never edited; if an ayah is ever too long for the Lock Screen (Ayah of the Moment), its opening words are shown unchanged with "…". A fixed hash of the local date picks one per day, so every device shows the same one; nothing is ranked, interpreted or translated (no licensed translation is bundled). `tests/adhkar.test.mjs` checks every reference exists and addresses رَبَّنَا or رَبِّ. Review status: the selection awaits scholar review.

## Ayah of the Moment and Short Recitations (v13)

**Ayah of the Moment** (`src/worship.ts`): the pool is the ayahs that open one of the 556 ruku' sections in Tanzil's metadata (`content/tanzil/quran-data.xml`, the same pinned file as the juz boundaries), so the card never begins in the middle of a passage. Of those, the 517 with 12–260 letters (marks ignored) are put once in a fixed shuffled order; local half-hour slot *n* shows entry *n* of that order, so no ayah repeats for about ten days and every device shows the same one. Ayahs shorter than 12 letters (stand-alone opening letters such as الٓمٓ) or longer than 260 are left out so the card always shows a whole ayah. This is a mechanical rule, not an editorial or scholarly selection: an opening ayah can still end where the next continues the sentence, and stern or narrative verses appear as they are. A reviewed, curated list would replace the pool without changing the slot logic; it awaits a qualified reviewer. Previous/next open the neighbouring ayahs (within the surah) and the reader keeps the whole Quran one tap away. The widget receives the next 48 slots' text (the corpus strings as they are); a widget too small for an ayah shows its reference and "Read it in its surah" rather than a cut-off or unreadably small text.

**Short Recitations for Salah**: references only (text from the corpus), chosen so each passage ends where its sentence ends: 67:1–5, 55:1–13, 23:1–11 (the request said 23:1–5, but 23:6 «إلا على أزواجهم» continues 23:5), 59:21–24, 76:1–6 (76:6 «عينا يشرب بها» continues 76:5), 2:1–5, 2:255, 2:285–286, 3:190–194, 24:35, 78:1–16 and 89:27–30. They are presented as optional suggestions for one's own recitation; none is claimed to be prescribed for a prayer. The selection awaits scholar review.

## Quran reader: Mushaf pages, fonts and the printed fifteen-line layout

**What ships.** Mushaf pages use the 604 page boundaries of the Madani Mushaf from Tanzil's `quran-data.xml` (pinned with the text, CC BY 3.0), imported by `scripts/import-quran.mjs`. The verses on each page match the printed Mushaf; the text is the Tanzil Uthmani text unchanged, set in the bundled AyahFlow Quran font (adapted from Scheherazade New, SIL Open Font License). The reader sizes the text so a whole page fits the screen, and lines break by screen width. The app never calls this the printed fifteen-line page. Everything works offline.

**Why not the printed fifteen-line page (checked 2026-10-27).**
- *Quran Foundation (quran.com) route.* The printed pages are drawn with QCF V1/V2 page fonts plus per-word glyph codes. Their Developer Terms and font guide allow caching or bundling the font files only if the developer keeps an active Developer Console account and credits Quran Foundation in the app. The files may be distributed only as part of the app. The glyph codes come from the authenticated Content API (`x-auth-token`, `x-client-id`); that content may be cached for at most one week unless kept through Content Sync, and a prepackaged database of it is not authorised. Using this route therefore needs: a Quran Foundation account held by the publisher, API credentials kept out of the repository (server-side token), new network endpoints with a consent design, an attribution line, and moving the displayed text from the Tanzil corpus to the QPC glyph encoding. None of that is in place, so it is not used.
  Sources: https://api-docs.quran.foundation/legal/developer-terms/, https://api-docs.quran.foundation/docs/tutorials/fonts/font-rendering/, https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/
- *QUL (Tarteel) layout data.* QUL publishes line-by-line Mushaf layouts (per page and line: `line_type` ayah / surah_name / basmallah, `is_centered`, `first_word_id`–`last_word_id`). The repository code is MIT, but no licence is stated for the layout data itself; its FAQ asks users to check each resource's licence. The word ids refer to QUL's own word database (QPC script), not to Tanzil's word segmentation, so using it with the Tanzil text would need a validated word alignment. Without a stated licence and that validation, it is not used.
  Sources: https://qul.tarteel.ai/docs/mushaf-layout, https://qul.tarteel.ai/mushaf_layouts, https://qul.tarteel.ai/faq, https://github.com/TarteelAI/quranic-universal-library
- *King Fahd Complex fonts directly.* The KFGQPC Uthmanic Script HAFS licence does not allow reproduction or modification without the Complex's written approval.

Colour-coded tajweed, IndoPak script and tafseer are listed as not available until a licensed, source-referenced dataset is added. Highlights and notes are the user's own data, stored locally (schema v16), included in exports and removed by delete. Reading theme and reader text size were added in schema v17.

## Qibla, Jumu'ah and voluntary fasts (v18)

- **Qibla:** the initial great-circle bearing from the place shown (a saved place, or a one-off current position that is not saved) to the Kaaba at 21.422487° N, 39.826206° E (WGS 84), computed on the phone. The live compass is iOS `CLLocationManager` heading, true north when location is allowed, magnetic otherwise; it runs only while the Qibla tab is on screen. No network, nothing stored.
- **Hijri dates:** the system's Umm al-Qura calendar (`Intl`, `islamic-umalqura`), labelled as an estimate that local sighting may change by a day.
- **Voluntary fasts:** Mondays, Thursdays and the 13th–15th of each Hijri month, never suggested in Ramadan, on Eid al-Fitr (1 Shawwal), Eid al-Adha (10 Dhu al-Hijjah) or the days of Tashreeq (11–13 Dhu al-Hijjah). Wording is a plain reminder ("a voluntary fast, if you choose to"); no hadith text is quoted.
- **Jumu'ah:** a Friday reminder for Surah Al-Kahf and salawat on the Prophet ﷺ, opening the reader at 18:1. No hadith text is quoted.
- These wordings and the excluded days await review by a qualified scholar (docs/RELEASE-CHECKLIST.md).

## The 99 Names (2026-10-29)

- The names are sliced verbatim from Jami' at-Tirmidhi 3507 (fawazahmed0/hadith-api, ara-tirmidhi) by `scripts/build-names.mjs`; none is typed by hand. The narration lists 98 names after "He is Allah, besides whom there is no god"; with the name Allah they are 99, and the app says so.
- The listing is graded Da'if by Ahmad Shakir, al-Albani and Zubair Ali Zai, as the dataset publishes; the app shows those grades next to the authentic statement that Allah has ninety-nine names (Tirmidhi 3506, Sahih).
- No meanings, explanations or per-name Quran references are shown: a matching Quran word is often not the name (al-mu'izz is also "goats" in 6:143). The screen shows 7:180, 17:110, 20:8 and 59:22–24 from the Tanzil text instead. Scholar review pending.
