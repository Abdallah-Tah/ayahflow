# Third-party and content notices

The application code, interface artwork and launcher icon in this delivery were authored for this prototype. No proprietary font files or paid template assets are included. Interface text uses device/system fonts by name.

## Quran font

Quran text in the reader and the widgets uses **AyahFlow Quran**, a Modified Version of **DigitalKhatt Madina v1.0.0** by Amine Anane (sponsored by Tarteel), with two marks from **Amiri Quran 1.003** by the Amiri Project Authors. Both are licensed under the SIL Open Font License 1.1 with no Reserved Font Names; the notices and the licence are in `public/fonts/OFL-AyahFlowQuran.txt` (also beside the widget copy). Inputs, kept unmodified: `content/fonts/DigitalKhattMadina.otf`, the `madina.otf` asset of release v1.0.0 at github.com/DigitalKhatt/madinafont (SHA-256 `b739d35562ea8bd28367a0cb069f993f025e6d7c8b6882eae01456fd82c0e9ef`), and `content/fonts/AmiriQuran.ttf` from the official `Amiri-1.003.zip` (github.com/aliftype/amiri/releases/tag/1.003, archive SHA-256 `81af0aff7d2086d8af24cea7202f7546130997982534691373485cd96744d05e`; font SHA-256 `e2a47644762d16bdfb6d33e0d8db8c6ff30beae84150ef5a705316bbd829455c`). DigitalKhatt Madina draws the Madinah Mushaf calligraphy, as the print and Quran.com show it, from Tanzil's Unicode text. It replaced Amiri Quran on 2026-10-31 after a comparison of free candidates on 7:38 and all 6236 ayahs. Not used: the KFGQPC fonts, including the UthmanicHafs1Ver18 that Quran Foundation serves (the licence forbids modification and needs the Complex's approval to reproduce; with Tanzil's encoding it draws the sukun round and U+06DF as a dotted circle); me_quran (personal and non-commercial use only); KFGQPC Uthman Taha Naskh (no licence found); PDMS Saleem (IndoPak style, no clear licence).

`scripts/build-quran-font.py` (fontTools 4.55.3) changes only the drawing setup, never the text: (1) the default instance of the variable font (its tatweel axes serve a justifying layout engine iOS does not have) in TrueType outlines; (2) the word space widened from 0.1 to 0.28 em, since without that engine words ran together; (3) positioning lookups that lift the pause marks (U+06D6–U+06DB everywhere, U+06DC after a space) above the end of the word before them, because Tanzil writes a space before each pause mark, DigitalKhatt anchors them on letters, and the reader shapes each word on its own; (4) U+06EA (imala, 11:41) and U+06EB (ishmam, 12:11), absent from DigitalKhatt, added from Amiri Quran. CoreText shaping of all 6236 ayahs: no missing glyph and no fallback font. The result is named AyahFlow Quran (`AyahFlowQuran-Regular`, SHA-256 `62b923c1b2b5067bf7083d9969e4731edd648bdd8ae48f521e5cd73cae5b4f2e`); the copyright notices are kept and the licence travels with it.

**Quran font choices** (Settings → Quran font, and Reading style in the reader; `QURAN_FONTS` in `src/mushaf.ts`). The default is AyahFlow Quran above; only the chosen font is loaded, and the widgets always use the default. The text is the same in every font. Two more ship:

- **AyahFlow Quran Amiri** (`public/fonts/AyahFlowQuranAmiri-Regular.ttf`, SHA-256 `498f1c79416c27ff3320e074bcea8d0bc063e178af1e713cd369f325f834ebd6`), built by `scripts/build-quran-font-amiri.py` from `content/fonts/AmiriQuran.ttf` (above, SIL OFL 1.1): the sukun U+0652 drawn with the font's U+06E1 jazm glyph, the word-final meem tail shortened from about −520 to −270 units on the three outlines every word-final meem uses, and the pause marks (U+06D6–U+06DC), which Amiri draws high for loose line spacing, outlines moved down 620 units so they sit over the word end instead of in the line above. Licence in `public/fonts/OFL-AyahFlowQuran.txt`.
- **me_quran 1.003** (April 26, 2005) by Meor Ridzuan, shipped **unmodified** as `public/fonts/me_quran.ttf` (SHA-256 `83d56cab9933f9e3ac1361ac0e926324a1cc70f37c3bcc5b22f62f270160b4a0`), downloaded from tanzil.net/res/font/org/me_quran.ttf on 2026-10-31. Its embedded notice: "Free for non commercial use. Other use, contact meory@yahoo.com" (`public/fonts/LICENSE-me_quran.txt`). Included at the user's decision on 2026-10-31; AyahFlow is free, and any commercial use would first need the author's permission. With Tanzil's text it draws the sukun round and sets words close together (said in the chooser).

Listed in the chooser as not available, with the reason: KFGQPC Uthman Taha Naskh v2.0 (official site, SHA-256 `f4a2b776261e390089ee108029d9a5f1ee862435ea52f571af2c5e0817c361ba`, tested, not shipped: no U+0671 alif waṣla and most Quranic marks missing, 25,000+ places, and its licence forbids modification); PDMS Saleem QuranFont (its EULA forbids distribution without a PDMS distribution licence; not downloaded); KFGQPC Uthmanic Hafs (above).

It replaced the system fallback (Geeza Pro on iPhone), which misplaced Mushaf marks such as the small waw and madd (e.g. 26:170). The KFGQPC Uthmanic Hafs font was not used: its licence forbids reproduction without the King Fahd Complex's written approval.

Quran chapter references, audio-provider references and the required review/rights limitations are documented in `CONTENT-PROVENANCE.md`. Modern translations and tafsir are linked externally, not bundled. No reference audio files are included. Accessibility of a source URL is not a grant of every kind of redistribution right.

Capacitor, its plugins, TypeScript and esbuild are declared as npm dependencies; native runtime packages are not vendored in this source archive. On installation/distribution, retain and review the actual dependency licenses and required notices from the resolved packages. The generated native bridge must be reviewed together with its installed dependencies.

The original application's licensing and public-release policy have not been chosen here. `package.json` is private to prevent unintended npm publication. Do not represent the project as endorsed by Quran.com, Islamic Network, Apple, Google or the authors of its development tools.

## Voice following (experimental)

"Follow my recitation" uses on-device speech recognition. It is included only in builds where `npm run voice:fetch` has downloaded and checksum-verified the model into `vendor/tilawa/` (gitignored; never committed).

| Component | Licence | Notes |
| --- | --- | --- |
| `@tilawa/core` 0.2.1 (Yazin Alirhayim) | MIT | Recognition pipeline, npm dependency |
| `onnxruntime-web` 1.24.2 (Microsoft) | MIT | WebAssembly inference runtime, bundled into `www/voice/` |
| `public/voice/capture-worklet.js` | MIT | Adapted from Tilawa's web demo `audio-processor.js` |
| Zipformer model `zipformer_interp_gentle_a05.int8.onnx` and phoneme corpus `zipformer_quran.json` (Quran-Lab / Tilawa release v0.3.0) | **NPL-1.2** (`licenses/NPL-1.2.txt`) | Shipped unmodified with its licence file at `www/voice/models/LICENSE-NPL-1.2.txt` |

**NPL-1.2 obligations.** Nothing may charge for the Work or any feature it powers: no price, subscription, paywall, trial or advertising on the app while it ships this feature. The licence file must travel with the model, and derivatives must stay under NPL-1.2. Whether distributing AyahFlow with the unmodified model makes the app itself a "Derivative" is not settled here; get a legal review before any store release.

The recogniser's Quran text is never displayed; AyahFlow highlights its own source text by position only. Recognition output is not stored, not uploaded, and never presented as a pronunciation or Tajweed assessment.

## Quran text, hadith texts and prayer times

| Component | Licence | Notes |
| --- | --- | --- |
| Tanzil Quran Text (Uthmani, Version 1.1) and metadata, © 2007-2026 Tanzil Project | CC BY 3.0, verbatim only | Committed unmodified with its copyright block in `content/tanzil/`; copied into the build; credited with a link to tanzil.net in the app |
| `fawazahmed0/hadith-api` Arabic hadith editions | The Unlicense (public domain dedication) | Only the cited hadiths are stored (`content/adhkar/sources.json`); dua texts are verbatim slices. No translation text is bundled |
| `adhan` 4.4.6 (adhan-js, Batoul Apps) | MIT | Bundled into `www/js/adhan.js` for offline prayer-time calculation |

sunnah.com is linked for reading and translations; nothing is copied from it. The app does not claim endorsement by Tanzil, sunnah.com, the dataset author or any scholar.

## Athan recordings

Prepared by `scripts/prepare-athan.mjs` (SHA-256 pinned, loudness-normalised, mono; a ≤30 s alert clip for iOS) from Wikimedia Commons. The in-app reciter list shows each author and licence with a link. Clips made from CC BY-SA recordings are shared under CC BY-SA.

| Name in app | Source | Author | Licence |
| --- | --- | --- | --- |
| “Beautiful adhan” | [Beautiful adhan.ogg](https://commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg) | Adam-synagda | CC0 1.0 |
| Azan · Andrewler | [Azan.ogg](https://commons.wikimedia.org/wiki/File:Azan.ogg) | Andrewler | CC BY-SA 4.0 |
| The Prophet’s Mosque, Madinah | [33937 ejaz215 call-to-prayer-from-the-prophet-s-mo.ogg](https://commons.wikimedia.org/wiki/File:33937_ejaz215_call-to-prayer-from-the-prophet-s-mo.ogg) | ejaz215 (freesound.org/people/ejaz215/sounds/33937) | CC BY 3.0 |
| Hassan II Mosque, Casablanca | [Llamada a oración Mezquita Hassan II.wav](https://commons.wikimedia.org/wiki/File:Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav) | Fraguando | CC BY-SA 4.0 |
| Aaqib Azeez | [The Adhan - Muslim Call to Prayer - Aaqib Azeez.mp3](https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3) | Atcovi | CC BY-SA 4.0 |

None of these recordings has yet been listened to by a person for this app. Before release confirm for each: a complete athan with correct wording, whether it is the Fajr version (as-salatu khayrun min an-nawm), audio quality, and that the declared licence is credible. Derived clips of CC BY-SA recordings are shared under CC BY-SA.

A user may import their own athan recording; it stays on the device, is never exported, and its rights are the user's.

### Online athan library (not bundled)

| Reciter | File on cdn.aladhan.com | Length | Use |
| --- | --- | --- | --- |
| Mishary Rashid Alafasy · Dubai One | `a4.mp3` | 215 s |  |
| Mishary Rashid Alafasy · II | `a7.mp3` | 243 s |  |
| Mishary Rashid Alafasy · III | `a9.mp3` | 257 s |  |
| Mansour Al-Zahrani | `a11-mansour-al-zahrani.mp3` | 132 s |  |
| Hafiz Mustafa Özcan · Türkiye | `a2.mp3` | 238 s |  |
| Ahmad al-Nafees · Fajr | `a1.mp3` | 214 s | Fajr only |

Not bundled. Downloaded only when the user asks, behind the online-audio permission, checked against the pinned SHA-256, and kept on the device. Islamic Network's terms (2026-06-14) allow streaming and downloading its audio for personal use; copyright stays with the reciters, who may request removal. The terms do not name cdn.aladhan.com explicitly. Reciter names follow aladhan.com/download-adhans. a1 is the Fajr athan (as-salatu khayrun min an-nawm), so it is offered for Fajr only. Source and attribution: https://aladhan.com/download-adhans · Terms: https://alquran.cloud/terms-and-conditions.

**Network.** These files are fetched only when the user taps **Download** (or **Listen**, which streams the same file), from `https://cdn.aladhan.com` only. The native download checks the host, size (≤ 12 MB) and SHA-256 before saving. Nothing about the user is sent beyond an ordinary HTTPS request.

## Tajweed annotations (cpfair/quran-tajweed)

- Source: https://github.com/cpfair/quran-tajweed, commit `496f71cd191da00fa2a37ded79dbbddb033bb0ad` (2021-10-12),
  file `output/tajweed.hafs.uthmani-pause-sajdah.json`, sha256 `151d616ad37a4cc21a80f20d5e1104c5b408375107ddd4d71247dea4c05ebf67`.
- Licence: Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/), as stated in the
  repository README for the data file. Credit shown in the app: "Tajweed annotations: Collin Fair, cpfair/quran-tajweed, CC BY 4.0".
- Text the offsets refer to: Tanzil Uthmani text of about April 2017, attached to that repository
  (`quran-uthmani.txt`, sha256 `abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2`), used only at build time to
  align the spans and not shipped.
- Changes: `scripts/build-tajweed.py` carries each span over to the app's Tanzil Uthmani 1.1 text by character alignment and
  keeps it only when every annotated character is identical (59,282 kept, 775 dropped). Rules are grouped into colours.
  The Quran text is unchanged. Machine-made annotations, not reviewed by a qualified teacher.

## Hadith library texts (fawazahmed0/hadith-api)

- Source: https://github.com/fawazahmed0/hadith-api, editions `ara-nawawi` and `ara-qudsi` (via cdn.jsdelivr.net, `@1`), sha256
  recorded in `content/hadith/library.json`. Licence: The Unlicense (public domain dedication). Arabic text only, unchanged.
