# Illustrated backgrounds: evidence and asset report (2026-11-09)

The owner's approved scenes (`AyahFlow_Optimized_Backgrounds`, 10 original AI-generated decorative images, 1200 × 675)
integrated without changing them: the WebP files in the app, the JPEG files in the iOS widget. Every word, time,
countdown, count and Quran text stays live text drawn over them.

## Where each scene is used

| Scene | App (WebP, `public/art`) | iOS widget (JPEG, `Backgrounds.xcassets`) |
| --- | --- | --- |
| `fajr_dawn`, `dhuhr_daylight`, `asr_afternoon`, `maghrib_sunset`, `isha_night` | next-prayer card on Home and Prayers: the scene of the next prayer (tomorrow's Fajr after Isha) in the arch top | Prayer page arch (medium, large) and the small arch, by the next prayer's key |
| `home_emerald` | Home: a vignette under the date row (never behind text) | not packaged |
| `dhikr_tasbih` | Adhkar banner | Dhikr page arch |
| `hifz_practice` | Memorise banner | not packaged |
| `quran_dua` | Daily Quranic du'a banner (cream, dark text) | Quran page arch, only when the du'a fits beside it; never behind the ayah |
| `daily_moments` | banner on the adhkar of riding, travelling, leaving and entering home, sleep | Moments page arch |

Dark scenes in the widget sit as a window along the bottom of the arch, fading in from the emerald, so the mosque is beside
the centred text. Light scenes (midday, the du'a) fill the arch like paper and take dark ink text. The tinted and clear
Home Screen looks and Increase Contrast fall back to the plain arch (no picture). Pictures are never mirrored in Arabic;
the app's banners crop to the other side of the scene instead.

## Exact sizes

Files added to the repository: 10 WebP (369,288 bytes) and 8 JPEG (742,088 bytes), all byte-identical to the
`optimized/` folder of the approved package.

| Build | Before | After | Difference | Of which images |
| --- | ---: | ---: | ---: | ---: |
| iOS app bundle, Debug simulator (`App.app`, all files) | 42,051,142 | 43,365,673 | +1,314,531 | 1,132,496 |
| · web content (`App.app/public`) | 30,031,686 | 30,406,158 | +374,472 | 369,288 (`public/art`, 10 WebP) |
| · widget extension (`AyahFlowWidget.appex`) | 5,294,004 | 6,235,434 | +941,430 | 763,208 (`Assets.car`, 8 JPEG renditions) |
| Android debug APK (`app-debug.apk`) | 37,026,857 | 37,425,722 | +398,865 | 369,288 (`assets/public/art`, stored, 10 WebP) |

The rest of each difference is code: the stylesheet grew by 4,296 bytes (111,596 → 115,892), and the Debug widget
binary by 178,016 bytes (Debug builds are unoptimised; the Android baseline APK predates the previous theme commit too).
Images that ship, per platform: **iOS +1,132,496 bytes (1.08 MiB)**, **Android +369,288 bytes (0.35 MiB)**.

Not packaged: `home_emerald` and `hifz_practice` in the widget (it never draws them); the PNG masters; the JPEGs in the
app or APK. The 8 scenes in both the app and the widget are stored twice on iOS (WebP for the web view, JPEG in the
extension's catalog): a widget extension cannot read the app's web content.

## Contrast

`swift scripts/art-contrast.swift > contrast.json` composites each picture as drawn (placement, crop, scrim, fade) and
measures every background pixel behind each text zone against the dimmest text colour there. 45 surfaces (widget
medium, large, small, Dhikr, Moments, Quran; app banners on phone and tablet, left to right and right to left; the
prayer card on phone and tablet; the Home band): **all pass, 99th percentile ≥ 4.5:1 (lowest 4.50)**. The single
brightest pixels (stars, lit windows) are listed as `worst`, not hidden.

## Screenshots

- Widget, iPhone 16 Pro simulator, Home Screen: `before-widget-prayer.jpg`; `after-widget-1-fajr.jpg` … `5-isha`, `6-fajr-dark`,
  `7-fajr-tinted-fallback`, `8-dhikr`, `9-moments`, `10-quran-long-dua-no-art`. To show each prayer without waiting for it, a
  temporary build (not committed) moved the widget's clock forward 0 to 12 hours; prayer times are the real ones for the
  shifted moment, the countdown runs on the real clock.
- App, simulator (full Debug build, Dark): `before-sim-app-home-dark.jpg`, `after-sim-app-home-dark.jpg`, `after-sim-app-adhkar-dark.jpg`.
- App, Chromium at 390 px: `after-app-home-light.jpg` (before: `before-app-home-light.jpg`), `after-app-adhkar.jpg`
  (`before-app-adhkar-light.jpg`), `after-app-hifz.jpg` (`before-app-hifz-light.jpg`), `after-app-daily-dua.jpg`,
  `after-app-moment-vehicle.jpg`, `after-app-prayers-dark.jpg`, Arabic `after-app-adhkar-arabic-rtl.jpg` and
  `after-app-home-band-arabic-rtl.jpg`, landscape 874 × 402 `after-app-adhkar-landscape.jpg`, tablet 768 × 1024 `after-app-home-tablet.jpg`.
