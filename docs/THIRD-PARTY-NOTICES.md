# Third-party and content notices

The application code, interface artwork and launcher icon in this delivery were authored for this prototype. No proprietary font files or paid template assets are included. Interface text uses device/system fonts by name.

## Quran font

Quran text in the reader and the widgets uses **AyahFlow Quran**, a Modified Version of **Amiri Quran 1.003** (`AmiriQuran.ttf`) by the Amiri Project Authors, licensed under the SIL Open Font License 1.1 with no Reserved Font Names (`public/fonts/OFL-Amiri.txt`, also beside the widget copy). The upstream file comes from the official release archive `Amiri-1.003.zip` (github.com/aliftype/amiri/releases/tag/1.003, archive SHA-256 `81af0aff7d2086d8af24cea7202f7546130997982534691373485cd96744d05e`) and is kept unmodified as the build input in `content/fonts/AmiriQuran.ttf` (SHA-256 `e2a47644762d16bdfb6d33e0d8db8c6ff30beae84150ef5a705316bbd829455c`). It replaced Scheherazade New 4.500 on 2026-10-31: Amiri Quran's letter forms (meem, final yā', the small alif without a stretched joining line, kasra below a shadda) follow the printed Madinah Mushaf the user checked against. The KFGQPC Uthmanic Hafs font was not used: its licence forbids reproducing or modifying it without the King Fahd Complex's written approval.

`scripts/build-quran-font.py` (fontTools 4.55.3) makes two drawing changes: (1) a `ccmp` lookup, run before any other, draws the sukun U+0652 with the font's own U+06E1 glyph, the open "jazm" of the Madinah print (قَدۡ); (2) the word-final meem gets the short tail of the Madinah print and Quran.com (أُمَمٍ): the three outlines every word-final meem is built from (found by shaping all 6236 ayahs) have their tail shortened from about −520 to −270 units, the rounded tip kept. The KFGQPC Hafs font Quran Foundation serves (`UthmanicHafs1Ver18.ttf`, v0.18) was tested on 2026-10-31 and not used: its licence forbids modification, and with Tanzil's encoding it draws the sukun round, shows the small high rounded zero U+06DF as a dotted circle (3,988 places) and needs Quran Foundation's own text encoding. The text stays unchanged; only the drawing differs. CoreText shaping of all 6236 ayahs: no missing glyph, no fallback font, every one of the 37,148 sukuns drawn as the jazm. The final yā' stays dotless as the print writes it (the earlier rule dotting it, from the KFGQPC digital text, was dropped). Tanzil writes every tanween with U+064B–U+064D, so the staggered tanween of the print (U+08F0–U+08F2 in the KFGQPC encoding) is shown stacked; no font can tell them apart from this text. The result is named AyahFlow Quran (`AyahFlowQuran-Regular`, SHA-256 `7036835030a19708927b51bff99b7807fe8d8bc9b22dc68057f2010c3b72eea8`); the copyright notice is kept and the licence travels with it.

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
