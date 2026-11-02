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
