# Licence checks for proposed features (2026-11-01)

Checks only; nothing below was added to the app. "Blocked" means not built until the named condition is met.
Not legal advice: each source's own terms must be read in full before any data is copied.

| Item | Data needed | What was found | Status |
|---|---|---|---|
| 1, 2. Vocabulary course by word frequency; tap-a-word meaning and transliteration | Word segmentation, roots/lemmas, word-by-word gloss and transliteration | Quranic Arabic Corpus (corpus.quran.com): "available under the GNU public license with terms of use". GPL requires the whole combined work to be GPL, which this app is not. Quran Universal Library (qul.tarteel.ai) word-by-word resources: the FAQ says licences vary per resource and must be read per author; none was confirmed for a specific word-by-word set. | Blocked: needs a word dataset whose own licence permits bundling in a non-GPL app (or a decision to license the app under GPL) |
| 8. Word-by-word recitation highlighting | Word timing segments for a reciter whose audio the app may use | QUL lists recitation segments, but the FAQ gives no licence for them; Tarteel's own audio datasets are not part of QUL. The online audio the app streams (Islamic Network) has its own terms; segments must match that exact audio. | Blocked: needs a segments file with an explicit licence for the same recordings |
| 9. Tajweed colours | Tajweed-marked Quran text (rule spans) | Tanzil's plain Uthmani text, already used, is verbatim-only with attribution. No licence was found for a tajweed-marked edition from Tanzil or QUL. Colouring would be presentation only, never a judgement of the user's recitation. | Blocked: needs a licensed, source-referenced tajweed edition |
| 10. Hadith library | Hadith texts with grades | fawazahmed0/hadith-api (used for the adhkar and Eid narrations) is under the Unlicense (public domain dedication). Licence is not the blocker; AGENTS.md requires editorial review of religious content, and a library is far beyond the reviewed set. | Blocked on editorial review (not licence) |
| 11. IndoPak script | IndoPak-encoded text and a font licensed for bundling | No IndoPak text licence was confirmed (Tanzil does not publish one; QUL resources vary per author). Fonts need their own checked licence (AGENTS.md); KFGQPC fonts forbid modification. | Blocked: needs a licensed text and font |
| 12. Meanings of the 99 Names; rak'ah guide | A sourced, reviewed commentary | No commentary with a known licence and a qualified reviewer is available to the project. Writing meanings or a prayer guide here would be generated religious teaching, which AGENTS.md forbids. | Not added |

Sources: [Quranic Arabic Corpus licence](https://corpus.quran.com/license.jsp), [QUL FAQ](https://qul.tarteel.ai/faq),
[QUL credits](https://qul.tarteel.ai/credits), [hadith-api](https://github.com/fawazahmed0/hadith-api),
[Islamic Network terms](https://alquran.cloud/terms-and-conditions).

## Second search for free sources (2026-11-01, after the user asked to look for free GitHub data)

Accepted only CC0, public domain, MIT, Apache-2.0, BSD or CC BY, traced to the data's origin.

| Item | Candidates checked | Result |
|---|---|---|
| 1. Word-by-word meanings, transliteration, vocabulary course | Quranic Arabic Corpus (GPL), hablullah/data-quran word translations (CC BY-NC-ND 4.0), malekverse/quran-dataset (CC BY 4.0, ayah-level only, no word data), risan/quran-json (CC BY-SA 4.0, ayah-level), QUL word-by-word sets (licence per author, none confirmed) | Blocked: no word-level meaning or transliteration set under an accepted licence was found |
| 2. Word-by-word recitation highlighting | cpfair/quran-align timings (CC BY 4.0) for EveryAyah-style recordings; Tadabur alignments (CC BY-NC 4.0); EveryAyah audio (no published licence; one upstream file says "Recitation license: UNKNOWN") | Blocked: the timings are free, but the recordings they match have no traceable licence, and the app's streamed audio (Islamic Network) is not shown to be the same files |
| 3. Tajweed colours | cpfair/quran-tajweed (CC BY 4.0) on Tanzil text | **Adopted** (see THIRD-PARTY-NOTICES, CONTENT-PROVENANCE) |
| 4. Hadith library | fawazahmed0/hadith-api (Unlicense) | **Adopted** for an-Nawawi's Forty and the Forty Qudsi, Arabic only; no topics or grades exist in the data |
| 5. IndoPak script | marwan/indopak-quran-text (no licence found; text credited to QuranWBW/Quran.com, works only with its bundled font); OFL Nastaliq fonts exist (Noto Nastaliq Urdu) but are not IndoPak Quran fonts | Blocked: no licensed IndoPak Quran text, and no licensed IndoPak Quran font |
| 6. 99 Names meanings, rak'ah guide | asmaulhusna on PyPI (GPL-3.0), pub.dev asmaulhusna (MIT, short unsourced descriptions), IcyDrae/99-Names-of-Allah and a gist (no licence found) | Not added: nothing sourced to a scholarly reference under an accepted licence |

Sources: https://github.com/cpfair/quran-tajweed, https://github.com/cpfair/quran-align, https://github.com/hablullah/data-quran,
https://github.com/malekverse/quran-dataset, https://github.com/risan/quran-json, https://www.github.com/marwan/indopak-quran-text,
https://pypi.org/project/asmaulhusna/, https://pub.dev/packages/asmaulhusna, https://github.com/IcyDrae/99-Names-of-Allah
