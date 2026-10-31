# Arabic du'a and adhkar audit (2026-10-30)

Scope: every Arabic du'a, dhikr, narration and name the app displays. Quran text (Tanzil Uthmani 1.1) was not edited;
Quran-based adhkar and the du'a of the day are references into that corpus and were only checked to point at the right
ayahs.

## Method, and its limits

- Source of truth: `content/adhkar/spec.json` → `scripts/build-adhkar.mjs` → `content/adhkar/adhkar.json` (also
  `scripts/build-ramadan.mjs`, `scripts/build-names.mjs`). Every hadith text is sliced from the sunnah.com Arabic
  editions in the public-domain `fawazahmed0/hadith-api` dataset, saved in `content/adhkar/sources.json`.
- Each entry was read against its full cited narration (wording, start and end, context, stated count, grades as the
  dataset publishes them) and against the wording Hisn al-Muslim is known to print. That comparison was made from the
  reviewer's (Claude's) knowledge of these well-known texts. **No external edition was consulted live and no
  qualified scholar has reviewed this pass.** The adhkar keep `reviewStatus: awaiting-scholar-review`.
- Nothing was typed by hand except the one common salawat formula (already flagged as common wording). Corrections are
  produced by a deterministic display layer whose output tests prove equivalent to the source.

## Totals

| | Count |
|---|---|
| Arabic texts displayed (adhkar 20 + 3 Quran references, counter steps 12, library 16 + 1 virtue, rotation 12, Ramadan 2, 99 Names + 1 statement) | 163 |
| Quran-reference entries (Ayat al-Kursi, end of Al-Baqarah, three Quls) | 3 |
| Entries checked against their cited narration | all |
| Texts with spelling (ى → ي) corrections | 9 |
| Texts with lām-alif mark-placement corrections | 25 |
| Texts given reading pauses «،» | 14 |
| Wording corrections to a narration | 0 |
| Incompleteness corrected (travel du'a) / added from the same narration (return) | 1 / 1 |
| Repetition counts changed | 0 (all verified) |
| Title translations corrected | 2 |
| Items flagged for scholar review | 9 (below) |

## Corrections

**Spelling (orthography, no wording change).** The dataset writes a final yā' without dots even where it carries a
vowel: شَىْءٌ, عَلَىَّ, الْحَىُّ. A dotless ى never carries sukun or shadda, so these are ي: «شَيْءٌ», «عَلَيَّ», «الْحَيُّ»
(la-yadurr, both sayyid al-istighfar entries, sleep-kafani, after-prayer, tahlil-100, the final tahlil of the tasbih,
the salawat virtue, the 99 Names).

**Mark placement.** The dataset types the fatha/shadda of lām-alif after the alif (لاَ, إِلاَّ, السَّلاَمُ). They belong
on the lām: «لَا», «إِلَّا», «السَّلَامُ». Same letters and marks; correct for screen readers and search.

**Reading pauses** (reading aids only, never inside a Quran quotation), e.g. after the obligatory prayer (Sahih Muslim,
book 5, hadith 179):

- before: لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ اللَّهُمَّ لاَ مَانِعَ …
- after: لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ

Also: leaving home, entering home, riding (istighfar), travel, kaffarat al-majlis, morning and evening «بك أصبحنا/أمسينا»,
«بسم الله الذي لا يضر», «الحمد لله الذي كفاني», waking, the final tahlil of the tasbih, the four words, the Laylat al-Qadr
du'a. Entries whose source already has commas (al-Bukhari edition) keep them unchanged.

**Quran quotations** inside narrations are shown in ﴿ ﴾ as Hisn al-Muslim prints them (riding, travel); the asterisk
between 43:13 and 43:14 is the source's own ayah separator.

**Travel du'a was incomplete.** It began at «اللَّهُمَّ إِنَّا نَسْأَلُكَ»; the narration (Sahih Muslim, book 15, hadith 479)
begins the quotation with «سُبْحَانَ الَّذِي سَخَّرَ لَنَا … لَمُنْقَلِبُونَ». It now starts there, with a note that the
narration first says Allahu akbar three times. The return addition from the same narration, «آيِبُونَ تَائِبُونَ عَابِدُونَ
لِرَبِّنَا حَامِدُونَ», is a new card after it.

**Riding sequence.** Abu Dawud 2602 interleaves narrator words, so its steps cannot be one slice. A note on the card now
gives the order: Bismillah, Alhamdulillah, the verse, Alhamdulillah ×3, Allahu akbar ×3, then «سبحانك إني ظلمت نفسي».

**Common salawat** «اللهم صلِّ وسلِّم على نبينا محمد» was partly voweled; now «اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ».

**Titles.** French riding-istighfar said "En voyage" (travelling): now "En montant dans un véhicule". Yunus was given ﷺ in
English and French (the Arabic says عليه السلام): now "(peace be upon him)" / "(paix sur lui)".

## Repetition counts (all verified against the cited text)

Tasbih after prayer: 33·33·33 + tahlil = 100 (Muslim, book 5, hadith 188), 33·33·34 = 100 (Muslim, book 5, hadith 186),
10·10·10 (al-Bukhari 6329), kept as three separate options with their own progress. «بسم الله الذي لا يضر» ×3 and the
three Quls ×3 (Abu Dawud 5088, 5082: «ثلاث مرات»); «سبحان الله وبحمده» ×100 (Muslim, book 48, hadith 39); istighfar
100/day (Muslim, book 48, hadith 52); «more than seventy» shown as 70+ (al-Bukhari 6307); library targets without a
stated number are labelled personal goals. Counters total the sum of their steps (tested).

## Translations and transliteration

The app bundles no translation or transliteration of the du'as (translations on hadith sites belong to their
translators; each card links its source). Titles and descriptions in English, French and Arabic were reviewed; two
corrected above.

## Flagged for scholar review (not changed)

1. **Laylat al-Qadr du'a** (Tirmidhi 3513) reads «عَفُوٌّ كَرِيمٌ». Al-Albani and others note «كَرِيمٌ» is not in the
   reliable manuscripts of Tirmidhi; Zubair Ali Zai grades this chain Da'if. Kept as the edition prints it.
2. **«وَهْوَ»** in the complete tahlil (al-Bukhari 6403): a valid reading in the al-Yunini text, not changed to «وَهُوَ».
3. **«السَّمَوَاتِ»** without alif in the distress du'a (al-Bukhari 6346): the edition's spelling, not modernised.
4. **«مَنْجَا»** in the sleep du'a (al-Bukhari 6311): narrated spelling, kept.
5. **Entering the mosque** (Abu Dawud 465): the narration first says to greet the Prophet ﷺ; only the du'a is shown.
6. **Common salawat**: wording not in a narration (labelled as such in the app).
7. **99 Names listing** (Tirmidhi 3507): graded Da'if, shown with its grades.
8. **Ayat al-Kursi before sleep** (al-Bukhari 2311) is mu'allaq; the app says so.
9. **Missing after-prayer adhkar** commonly recited first — «أستغفر الله» ×3 and «اللهم أنت السلام…» (Muslim 591),
   Ayat al-Kursi after each prayer — are not in the app. Adding them needs the narrations fetched (`REFETCH=1`) and review.

## Files

`content/adhkar/spec.json`, `content/adhkar/adhkar.json`, `content/ramadan/ramadan.json`, `content/names/names.json`,
`scripts/build-adhkar.mjs`, `scripts/build-ramadan.mjs`, `scripts/build-names.mjs`, `src/app.ts`, `src/i18n.ts`,
`src/adhkar-data.d.ts`, `tests/arabic-content.test.mjs` (new), `tests/adhkar.test.mjs`, `tests/worship.test.mjs`,
`tests/ramadan.test.mjs`, `tests/names.test.mjs`, `docs/CONTENT-PROVENANCE.md`.

User data: progress, favourites and counts are keyed by entry id; no id changed, one was added (`travel-return`), no
migration needed.
