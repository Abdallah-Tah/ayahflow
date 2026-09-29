# Third-party and content notices

The application code, interface artwork and launcher icon in this delivery were authored for this prototype. No proprietary font files or paid template assets are included. The interface requests device/system fonts by name.

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
